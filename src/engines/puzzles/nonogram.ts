import { createRng, type Rng } from '../core/rng';

/*
 * Nonogram (picture logic): each row and column clue lists the lengths of the
 * runs of filled cells in order. Puzzles are generated from a seed and kept
 * only when a line-by-line solver can finish them, which proves the solution
 * is unique and can be found by logic alone, without guessing.
 */
export const NONO_SIZES = [5, 10, 15] as const;
export type NonoSize = (typeof NONO_SIZES)[number];

/** Cell states on the player's grid. */
export const EMPTY = 0;
export const FILLED = 1;
export const CROSSED = 2;
export type Cell = typeof EMPTY | typeof FILLED | typeof CROSSED;

/** Run lengths of a line of booleans; an empty line has the clue [0]. */
export function clueOf(line: readonly boolean[]): number[] {
  const out: number[] = [];
  let run = 0;
  for (const v of line) {
    if (v) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out.length ? out : [0];
}

/** Known state while solving: -1 unknown, 0 empty, 1 filled. */
type Known = -1 | 0 | 1;

/**
 * Settles every cell of one line that is the same in all arrangements of the
 * clue consistent with what is already known. Returns null on a contradiction.
 */
export function solveLine(clue: readonly number[], known: readonly Known[]): Known[] | null {
  const n = known.length;
  const runs = clue[0] === 0 ? [] : clue;
  const canFill = new Array<boolean>(n).fill(false);
  const canEmpty = new Array<boolean>(n).fill(false);
  // memo[i][k]: can runs k.. be placed from position i onward?
  const memo = new Map<number, boolean>();
  const rest = (i: number, k: number): boolean => {
    const key = i * 64 + k;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let ok = false;
    if (k === runs.length) {
      ok = true;
      for (let j = i; j < n; j++) if (known[j] === 1) ok = false;
      if (ok) for (let j = i; j < n; j++) canEmpty[j] = true;
    } else {
      const len = runs[k]!;
      for (let s = i; s + len <= n; s++) {
        // Cells i..s-1 are empty.
        let blocked = false;
        for (let j = i; j < s; j++) if (known[j] === 1) blocked = true;
        if (blocked) break;
        let fits = true;
        for (let j = s; j < s + len; j++) if (known[j] === 0) fits = false;
        if (!fits) continue;
        const end = s + len;
        if (end < n && known[end] === 1) continue;
        const nextStart = end < n ? end + 1 : end;
        if (rest(nextStart, k + 1)) {
          ok = true;
          for (let j = i; j < s; j++) canEmpty[j] = true;
          for (let j = s; j < end; j++) canFill[j] = true;
          if (end < n) canEmpty[end] = true;
        }
      }
    }
    memo.set(key, ok);
    return ok;
  };
  if (!rest(0, 0)) return null;
  return known.map((v, j) => (v !== -1 ? v : canFill[j] && !canEmpty[j] ? 1 : !canFill[j] && canEmpty[j] ? 0 : -1));
}

/** Solves with line logic only; returns the grid when that finishes it, else null. */
export function lineSolve(rows: readonly number[][], cols: readonly number[][]): boolean[][] | null {
  const h = rows.length;
  const w = cols.length;
  const g: Known[][] = Array.from({ length: h }, () => new Array<Known>(w).fill(-1));
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < h; r++) {
      const res = solveLine(rows[r]!, g[r]!);
      if (!res) return null;
      res.forEach((v, c) => {
        if (v !== g[r]![c]) {
          g[r]![c] = v;
          changed = true;
        }
      });
    }
    for (let c = 0; c < w; c++) {
      const res = solveLine(
        cols[c]!,
        g.map((row) => row[c]!),
      );
      if (!res) return null;
      res.forEach((v, r) => {
        if (v !== g[r]![c]) {
          g[r]![c] = v;
          changed = true;
        }
      });
    }
  }
  return g.every((row) => row.every((v) => v !== -1)) ? g.map((row) => row.map((v) => v === 1)) : null;
}

export interface Puzzle {
  size: NonoSize;
  seed: string;
  solution: boolean[][];
  rows: number[][];
  cols: number[][];
}

/** A random picture: clustered blobs read better than noise and solve more often. */
function picture(size: number, rng: Rng): boolean[][] {
  const density = 0.5 + rng() * 0.12;
  let g = Array.from({ length: size }, () => Array.from({ length: size }, () => rng() < density));
  // One smoothing pass: a cell follows the majority of its neighbourhood.
  g = g.map((row, r) =>
    row.map((v, c) => {
      let on = 0;
      let all = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const x = g[r + dr]?.[c + dc];
          if (x === undefined) continue;
          all++;
          if (x) on++;
        }
      const p = on / all;
      return p > 0.55 ? true : p < 0.4 ? false : v;
    }),
  );
  // Mirror half the time for a more picture-like shape.
  if (rng() < 0.5) g = g.map((row) => row.map((v, c) => (c >= size / 2 ? row[size - 1 - c]! : v)));
  return g;
}

/** Generates the puzzle for a seed: the same seed always gives the same puzzle. */
export function generate(size: NonoSize, seed: string): Puzzle {
  const rng = createRng(`nonogram:${size}:${seed}`);
  for (let attempt = 0; ; attempt++) {
    const solution = picture(size, rng);
    const filled = solution.flat().filter(Boolean).length;
    if (filled < size * size * 0.3 || filled > size * size * 0.75) continue;
    const rows = solution.map(clueOf);
    const cols = solution[0]!.map((_, c) => clueOf(solution.map((row) => row[c]!)));
    // Every row and column should have something to read.
    if (rows.some((x) => x[0] === 0) || cols.some((x) => x[0] === 0)) continue;
    if (lineSolve(rows, cols)) return { size, seed, solution, rows, cols };
    if (attempt > 5000) throw new Error(`No line-solvable ${size}×${size} nonogram for seed ${seed}`);
  }
}

export class NonogramGame {
  readonly puzzle: Puzzle;
  cells: Cell[][];
  checks = 0;

  constructor(size: NonoSize = 5, seed = '1') {
    this.puzzle = generate(size, seed);
    this.cells = Array.from({ length: size }, () => new Array<Cell>(size).fill(EMPTY));
  }

  get size() {
    return this.puzzle.size;
  }

  set(r: number, c: number, v: Cell) {
    this.cells[r]![c] = v;
  }

  /** Filled cells that are not in the picture, plus crossed cells that are. */
  mistakes(): [number, number][] {
    const out: [number, number][] = [];
    this.cells.forEach((row, r) =>
      row.forEach((v, c) => {
        const want = this.puzzle.solution[r]![c]!;
        if ((v === FILLED && !want) || (v === CROSSED && want)) out.push([r, c]);
      }),
    );
    return out;
  }

  /** Solved when the filled cells are exactly the picture (crosses are only notes). */
  get solved(): boolean {
    return this.cells.every((row, r) => row.every((v, c) => (v === FILLED) === this.puzzle.solution[r]![c]));
  }

  /** True when this row's (or column's) filled cells already match its clue. */
  rowDone(r: number) {
    return sameClue(clueOf(this.cells[r]!.map((v) => v === FILLED)), this.puzzle.rows[r]!);
  }
  colDone(c: number) {
    return sameClue(clueOf(this.cells.map((row) => row[c] === FILLED)), this.puzzle.cols[c]!);
  }
}

const sameClue = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
