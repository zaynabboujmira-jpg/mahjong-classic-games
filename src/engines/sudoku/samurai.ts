import { createRng, shuffleInPlace } from '../core/rng';
import { bit, boxOf, colOf, rowOf } from './grid';
import { grade, nextPlacement, TECHNIQUE_NAMES, unitName } from './logic';
import { randomFullGrid } from './solver';

/*
 * Samurai Sudoku: five 9×9 Sudoku grids in an X. The centre grid shares each
 * of its corner boxes with one of the four corner grids. Every grid follows
 * the normal rules (rows, columns and boxes hold 1 to 9 once).
 *
 * Cells are numbered on the 21×21 square the grids sit in (441 positions, of
 * which 369 belong to a grid).
 *
 * Generation: fill the centre grid at random, then give each corner grid a
 * random full grid relabelled so that its shared box matches the centre.
 * Clues are removed in random order while every grid that contains the cell
 * can still be solved on its own by logic up to the level's hardest
 * technique. A logical solve of each grid proves the whole puzzle has
 * exactly one solution, with no guessing.
 */
export const SIDE = 21;
export const SIZE = SIDE * SIDE;
/** Top-left corner (row, column) of each grid: top-left, top-right, centre, bottom-left, bottom-right. */
export const ORIGINS = [
  [0, 0],
  [0, 12],
  [6, 6],
  [12, 0],
  [12, 12],
] as const;
export const GRID_NAMES = ['top-left', 'top-right', 'centre', 'bottom-left', 'bottom-right'] as const;

/** GRID_CELLS[g][k]: the global cell of local cell k (row-major 0..80) of grid g. */
export const GRID_CELLS: readonly (readonly number[])[] = ORIGINS.map(([r0, c0]) => Array.from({ length: 81 }, (_, k) => (r0 + rowOf(k)) * SIDE + c0 + colOf(k)));
export const ACTIVE: readonly boolean[] = (() => {
  const a = new Array<boolean>(SIZE).fill(false);
  for (const g of GRID_CELLS) for (const c of g) a[c] = true;
  return a;
})();
/** Grids each cell belongs to (two for cells in a shared box). */
export const GRIDS_OF: readonly number[][] = Array.from({ length: SIZE }, (_, c) => GRID_CELLS.flatMap((g, i) => (g.includes(c) ? [i] : [])));
/** Every cell that shares a row, column or box with each cell, in any grid. */
export const PEERS: readonly number[][] = Array.from({ length: SIZE }, (_, c) => {
  if (!ACTIVE[c]) return [];
  const set = new Set<number>();
  for (const g of GRIDS_OF[c]!) {
    const cells = GRID_CELLS[g]!;
    const k = cells.indexOf(c);
    for (let j = 0; j < 81; j++) if (j !== k && (rowOf(j) === rowOf(k) || colOf(j) === colOf(k) || boxOf(j) === boxOf(k))) set.add(cells[j]!);
  }
  return [...set];
});
/** The rows, columns and boxes of all five grids, as lists of global cells. */
export const UNITS: readonly number[][] = GRID_CELLS.flatMap((cells) => {
  const u: number[][] = [];
  for (let r = 0; r < 9; r++) u.push(Array.from({ length: 9 }, (_, c) => cells[r * 9 + c]!));
  for (let c = 0; c < 9; c++) u.push(Array.from({ length: 9 }, (_, r) => cells[r * 9 + c]!));
  for (let b = 0; b < 9; b++) u.push(Array.from({ length: 9 }, (_, k) => cells[(Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3)]!));
  return u;
});

export const SAMURAI_LEVELS = ['easy', 'medium', 'hard'] as const;
export type SamuraiLevel = (typeof SAMURAI_LEVELS)[number];
/** Hardest technique allowed, the level at least one grid must need, and the fewest clues per grid. */
const TIERS: Record<SamuraiLevel, { maxLevel: number; minLevel: number; clues: number }> = {
  easy: { maxLevel: 1, minLevel: 1, clues: 34 },
  medium: { maxLevel: 2, minLevel: 2, clues: 28 },
  hard: { maxLevel: 3, minLevel: 3, clues: 23 },
};

export interface SamuraiPuzzle {
  level: SamuraiLevel;
  seed: string;
  givens: number[];
  solution: number[];
}

const local = (grid: readonly number[], g: number) => GRID_CELLS[g]!.map((c) => grid[c]!);

export function generateSamurai(level: SamuraiLevel, seed: string): SamuraiPuzzle {
  const rng = createRng(`samurai:${level}:${seed}`);
  const tier = TIERS[level];
  let fallback: { puzzle: SamuraiPuzzle; level: number } | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const solution = new Array<number>(SIZE).fill(0);
    const centre = randomFullGrid(rng);
    GRID_CELLS[2]!.forEach((c, k) => (solution[c] = centre[k]!));
    for (const g of [0, 1, 3, 4]) {
      const full = randomFullGrid(rng);
      // Relabel the digits so the box this grid shares with the centre matches it.
      const map = new Array<number>(10).fill(0);
      GRID_CELLS[g]!.forEach((c, k) => {
        if (GRIDS_OF[c]!.includes(2)) map[full[k]!] = solution[c]!;
      });
      GRID_CELLS[g]!.forEach((c, k) => (solution[c] = map[full[k]!]!));
    }
    const givens = solution.slice();
    const clues = GRID_CELLS.map(() => 81);
    const cells = shuffleInPlace(
      Array.from({ length: SIZE }, (_, c) => c).filter((c) => ACTIVE[c]),
      rng,
    );
    for (const c of cells) {
      const grids = GRIDS_OF[c]!;
      if (grids.some((g) => clues[g]! <= tier.clues)) continue;
      givens[c] = 0;
      if (grids.every((g) => grade(local(givens, g), tier.maxLevel).solved)) grids.forEach((g) => clues[g]!--);
      else givens[c] = solution[c]!;
    }
    const hardest = Math.max(...GRID_CELLS.map((_, g) => grade(local(givens, g), tier.maxLevel).level));
    const puzzle = { level, seed, givens, solution };
    if (hardest >= tier.minLevel) return puzzle;
    if (!fallback || hardest > fallback.level) fallback = { puzzle, level: hardest };
  }
  return fallback!.puzzle;
}

/** Each grid's own logic grade (1-4), the hardest technique it needs. */
export const gridLevels = (givens: readonly number[]) => GRID_CELLS.map((_, g) => grade(local(givens, g), 4));

type Change = { cell: number; value: number; notes: number }[];
export type SamuraiHint = { kind: 'wrong' | 'place'; cell: number; digit: number; message: string } | { kind: 'none'; message: string };

const cellText = (c: number) => {
  const g = GRIDS_OF[c]![0]!;
  const k = GRID_CELLS[g]!.indexOf(c);
  return `row ${rowOf(k) + 1}, column ${colOf(k) + 1} of the ${GRID_NAMES[g]} grid`;
};
export const samuraiCellName = cellText;

/** A Samurai Sudoku in play: digits, pencil marks, undo, hints and saving. */
export class SamuraiGame {
  readonly givens: readonly number[];
  readonly solution: readonly number[];
  readonly values: number[];
  readonly notes: number[];
  private history: Change[] = [];
  moves = 0;
  mistakes = 0;
  hintsUsed = 0;

  constructor(givens: readonly number[], solution: readonly number[]) {
    this.givens = givens.slice();
    this.solution = solution.slice();
    this.values = givens.slice();
    this.notes = new Array<number>(SIZE).fill(0);
  }

  isGiven = (c: number) => this.givens[c] !== 0;
  isWrong = (c: number) => this.values[c] !== 0 && this.values[c] !== this.solution[c];
  get canUndo() {
    return this.history.length > 0;
  }
  get isWon() {
    for (let c = 0; c < SIZE; c++) if (ACTIVE[c] && this.values[c] !== this.solution[c]) return false;
    return true;
  }

  conflicts(): Set<number> {
    const out = new Set<number>();
    for (const u of UNITS)
      for (let d = 1; d <= 9; d++) {
        const at = u.filter((c) => this.values[c] === d);
        if (at.length > 1) at.forEach((c) => out.add(c));
      }
    return out;
  }

  /** How many of each digit are still to place across the whole puzzle (369 cells, 41 of each). */
  remaining(): number[] {
    const left = new Array<number>(10).fill(41);
    left[0] = 0;
    for (let c = 0; c < SIZE; c++) if (ACTIVE[c] && this.values[c]) left[this.values[c]!]!--;
    return left;
  }

  private snapshot(cells: Iterable<number>): Change {
    return [...cells].map((cell) => ({ cell, value: this.values[cell]!, notes: this.notes[cell]! }));
  }
  private commit(ch: Change) {
    if (!ch.length) return;
    this.history.push(ch);
    this.moves++;
  }

  setValue(c: number, d: number): boolean {
    if (!ACTIVE[c] || this.isGiven(c)) return false;
    if (this.values[c] === d) return this.erase(c);
    const touched = [c, ...PEERS[c]!.filter((p) => this.notes[p]! & bit(d))];
    const ch = this.snapshot(touched);
    this.values[c] = d;
    this.notes[c] = 0;
    for (const p of touched.slice(1)) this.notes[p]! &= ~bit(d);
    if (d !== this.solution[c]) this.mistakes++;
    this.commit(ch);
    return true;
  }

  toggleNote(c: number, d: number): boolean {
    if (!ACTIVE[c] || this.isGiven(c) || this.values[c]) return false;
    const ch = this.snapshot([c]);
    this.notes[c]! ^= bit(d);
    this.commit(ch);
    return true;
  }

  erase(c: number): boolean {
    if (!ACTIVE[c] || this.isGiven(c) || (!this.values[c] && !this.notes[c])) return false;
    const ch = this.snapshot([c]);
    this.values[c] = 0;
    this.notes[c] = 0;
    this.commit(ch);
    return true;
  }

  fillNotes(): boolean {
    const empty: number[] = [];
    for (let c = 0; c < SIZE; c++) if (ACTIVE[c] && !this.values[c]) empty.push(c);
    if (!empty.length) return false;
    const ch = this.snapshot(empty);
    for (const c of empty) {
      let used = 0;
      for (const p of PEERS[c]!) if (this.values[p]) used |= bit(this.values[p]!);
      this.notes[c] = 0x1ff & ~used;
    }
    this.commit(ch);
    return true;
  }

  undo(): boolean {
    const ch = this.history.pop();
    if (!ch) return false;
    for (const { cell, value, notes } of ch) {
      this.values[cell] = value;
      this.notes[cell] = notes;
    }
    this.moves++;
    return true;
  }

  /** A wrong digit first; then the easiest logical step in any grid. */
  hint(): SamuraiHint {
    for (let c = 0; c < SIZE; c++) if (ACTIVE[c] && this.isWrong(c)) return { kind: 'wrong', cell: c, digit: this.values[c]!, message: `The ${this.values[c]} at ${cellText(c)} is not right.` };
    let best: { cell: number; digit: number; message: string; rank: number } | null = null;
    for (let g = 0; g < 5; g++) {
      const vals = local(this.values, g);
      if (vals.every(Boolean)) continue;
      const n = nextPlacement(vals);
      if (!n) continue;
      const rank = n.technique === 'naked-single' ? 1 : n.technique === 'hidden-single' ? 2 : 3;
      if (best && best.rank <= rank) continue;
      const cell = GRID_CELLS[g]![n.cell]!;
      const how =
        n.technique === 'naked-single'
          ? 'It is the only digit that fits there.'
          : n.technique === 'hidden-single' && n.unit !== undefined
            ? `It is the only place for a ${n.digit} in ${unitName(n.unit)} of that grid.`
            : `Look for a ${TECHNIQUE_NAMES[n.technique]} first.`;
      best = { cell, digit: n.digit, rank, message: `${cellText(cell)[0]!.toUpperCase()}${cellText(cell).slice(1)} is ${n.digit}. ${how}` };
    }
    if (best) return { kind: 'place', cell: best.cell, digit: best.digit, message: best.message };
    const c = this.values.findIndex((v, i) => ACTIVE[i] && !v);
    if (c < 0) return { kind: 'none', message: 'The puzzle is complete.' };
    return { kind: 'place', cell: c, digit: this.solution[c]!, message: `${cellText(c)} is ${this.solution[c]}.` };
  }

  applyHint(h: SamuraiHint): boolean {
    if (h.kind === 'none') return false;
    this.hintsUsed++;
    return h.kind === 'wrong' ? this.erase(h.cell) : this.setValue(h.cell, h.digit);
  }

  serialize() {
    return { values: this.values.slice(), notes: this.notes.slice(), moves: this.moves, mistakes: this.mistakes, hintsUsed: this.hintsUsed };
  }

  restore(s: { values: number[]; notes: number[]; moves: number; mistakes: number; hintsUsed: number }): boolean {
    if (s.values?.length !== SIZE || s.notes?.length !== SIZE) return false;
    for (let c = 0; c < SIZE; c++) if (this.givens[c] && s.values[c] !== this.givens[c]) return false;
    s.values.forEach((v, i) => (this.values[i] = v));
    s.notes.forEach((v, i) => (this.notes[i] = v));
    this.moves = s.moves;
    this.mistakes = s.mistakes;
    this.hintsUsed = s.hintsUsed;
    this.history = [];
    return true;
  }
}
