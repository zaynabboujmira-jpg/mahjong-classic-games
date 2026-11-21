import { createRng, randomInt, shuffleInPlace, type Rng } from '../core/rng';
import { ALL, CELLS, UNITS, boxOf, colOf, rowOf, type Grid } from './grid';
import { randomFullGrid } from './solver';

/*
 * Killer Sudoku: the normal Sudoku rules, plus cages. Each cage (a group of
 * orthogonally connected cells drawn with a dashed outline) shows a sum; its
 * digits must add up to that sum and may not repeat inside the cage.
 *
 * Generation: fill a random grid, grow random cages over it (digits inside a
 * cage are distinct because the grid is valid only if we keep them so), then
 * prove uniqueness with a cage-aware solver. While a second solution exists,
 * reveal one cell where the two solutions differ as a given. Easy puzzles use
 * smaller cages and start with extra givens; Hard puzzles use larger cages
 * and only the givens uniqueness needs (usually none).
 */
export const KILLER_LEVELS = ['easy', 'hard'] as const;
export type KillerLevel = (typeof KILLER_LEVELS)[number];

export interface Cage {
  cells: number[];
  sum: number;
}

export interface KillerPuzzle {
  level: KillerLevel;
  seed: string;
  cages: Cage[];
  givens: Grid;
  solution: Grid;
}

const ROW = Array.from({ length: CELLS }, (_, i) => rowOf(i));
const COL = Array.from({ length: CELLS }, (_, i) => colOf(i));
const BOX = Array.from({ length: CELLS }, (_, i) => boxOf(i));
const NEIGHBOURS = Array.from({ length: CELLS }, (_, i) => {
  const out: number[] = [];
  if (ROW[i]! > 0) out.push(i - 9);
  if (ROW[i]! < 8) out.push(i + 9);
  if (COL[i]! > 0) out.push(i - 1);
  if (COL[i]! < 8) out.push(i + 1);
  return out;
});

/** Splits the grid into cages of distinct digits, sizes drawn from `sizes`. */
export function makeCages(solution: Grid, rng: Rng, sizes: readonly number[]): Cage[] {
  const owner = new Array<number>(CELLS).fill(-1);
  const cages: number[][] = [];
  for (const start of shuffleInPlace(Array.from({ length: CELLS }, (_, i) => i), rng)) {
    if (owner[start] !== -1) continue;
    const target = sizes[randomInt(rng, sizes.length)]!;
    const cage = [start];
    owner[start] = cages.length;
    let used = 1 << solution[start]!;
    while (cage.length < target) {
      const options: number[] = [];
      for (const c of cage) for (const n of NEIGHBOURS[c]!) if (owner[n] === -1 && !(used & (1 << solution[n]!)) && !options.includes(n)) options.push(n);
      if (!options.length) break;
      const n = options[randomInt(rng, options.length)]!;
      cage.push(n);
      owner[n] = cages.length;
      used |= 1 << solution[n]!;
    }
    cages.push(cage);
  }
  // Fold single cells into a neighbouring cage where the digit is new to it.
  for (let k = 0; k < cages.length; k++) {
    const cage = cages[k]!;
    if (cage.length !== 1) continue;
    const c = cage[0]!;
    for (const n of shuffleInPlace(NEIGHBOURS[c]!.slice(), rng)) {
      const other = cages[owner[n]!]!;
      if (other.length >= 5 || other.some((x) => solution[x] === solution[c])) continue;
      other.push(c);
      owner[c] = owner[n]!;
      cages[k] = [];
      break;
    }
  }
  return cages
    .filter((c) => c.length)
    .map((cells) => ({ cells: cells.sort((a, b) => a - b), sum: cells.reduce((t, i) => t + solution[i]!, 0) }));
}

/** COMBOS[k][sum]: every set of k distinct digits (as a 9-bit mask) adding up to sum. */
const COMBOS: number[][][] = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => []));
for (let m = 1; m <= ALL; m++) {
  let n = 0;
  let sum = 0;
  for (let d = 1; d <= 9; d++) if (m & (1 << (d - 1))) n++, (sum += d);
  COMBOS[n]![sum]!.push(m);
}

let required = 0;
/** Digits the empty cells of a cage may still take: the union of the digit sets that complete its sum (their intersection is left in `required`). */
function cageAllowed(cage: Cage, values: readonly number[], skip = -1): number {
  required = 0;
  let used = 0;
  let sum = 0;
  let empty = 0;
  for (const c of cage.cells) {
    const v = c === skip ? 0 : values[c]!;
    if (v) {
      if (used & (1 << (v - 1))) return 0;
      used |= 1 << (v - 1);
      sum += v;
    } else empty++;
  }
  const rest = cage.sum - sum;
  if (!empty) return 0;
  if (rest < 0 || rest > 45) return 0;
  let out = 0;
  let all = ALL;
  for (const m of COMBOS[empty]![rest]!)
    if (!(m & used)) {
      out |= m;
      all &= m;
    }
  required = out ? all : 0;
  return out;
}

/** Digits a cell may take inside its cage, given the cage's other entries. */
export const cageMask = (cage: Cage, values: readonly number[], cell: number) => cageAllowed(cage, values, cell);

/** Cage index of every cell. */
export const cageIndex = (cages: readonly Cage[]) => {
  const out = new Array<number>(CELLS).fill(-1);
  cages.forEach((c, k) => c.cells.forEach((i) => (out[i] = k)));
  return out;
};

/** Counts solutions of a killer grid (cages plus givens), stopping at `limit`. */
export function killerSolve(cages: readonly Cage[], givens: readonly number[], limit = 2, budget = 400_000): { count: number; first: Grid | null; all: Grid[]; exhausted: boolean } {
  const g = givens.slice();
  const owner = cageIndex(cages);
  const rows = new Int32Array(9);
  const cols = new Int32Array(9);
  const boxes = new Int32Array(9);
  for (let i = 0; i < CELLS; i++) {
    const v = g[i]!;
    if (!v) continue;
    const b = 1 << (v - 1);
    rows[ROW[i]!]! |= b;
    cols[COL[i]!]! |= b;
    boxes[BOX[i]!]! |= b;
  }
  let count = 0;
  let first: Grid | null = null;
  const all: Grid[] = [];
  let nodes = 0;
  let exhausted = false;
  const allowed = new Int32Array(cages.length);
  const masks = new Int32Array(CELLS);
  const need = new Int32Array(cages.length);
  const dfs = (): boolean => {
    if (++nodes > budget) return (exhausted = true);
    for (let k = 0; k < cages.length; k++) {
      allowed[k] = cageAllowed(cages[k]!, g);
      need[k] = required;
    }
    let best = -1;
    let bestMask = 0;
    let bestN = 10;
    for (let i = 0; i < CELLS; i++) {
      if (g[i]) continue;
      const mask = ALL & ~(rows[ROW[i]!]! | cols[COL[i]!]! | boxes[BOX[i]!]!) & allowed[owner[i]!]!;
      masks[i] = mask;
      let n = 0;
      for (let m = mask; m; m &= m - 1) n++;
      if (!n) return false;
      if (n < bestN) {
        best = i;
        bestMask = mask;
        bestN = n;
      }
    }
    // Hidden singles: a digit with one place left in a row, column or box is forced; none left is a dead end.
    if (bestN > 1 && best >= 0) {
      for (const u of UNITS) {
        let seen = 0;
        for (const i of u) if (g[i]) seen |= 1 << (g[i]! - 1);
        for (let d = 1; d <= 9; d++) {
          const b = 1 << (d - 1);
          if (seen & b) continue;
          let at = -1;
          let n = 0;
          for (const i of u) if (!g[i] && masks[i]! & b) (at = i), n++;
          if (!n) return false;
          if (n === 1 && bestN > 1) (best = at), (bestMask = b), (bestN = 1);
        }
      }
      // A digit every completion of a cage needs must still have a cell in that cage.
      for (let k = 0; k < cages.length; k++) {
        const req = need[k]!;
        if (!req) continue;
        for (let d = 1; d <= 9; d++) {
          const b = 1 << (d - 1);
          if (!(req & b)) continue;
          let at = -1;
          let n = 0;
          for (const i of cages[k]!.cells) if (!g[i] && masks[i]! & b) (at = i), n++;
          if (!n) return false;
          if (n === 1 && bestN > 1) (best = at), (bestMask = b), (bestN = 1);
        }
      }
    }
    if (best < 0) {
      count++;
      if (!first) first = g.slice();
      all.push(g.slice());
      return count >= limit;
    }
    for (let d = 1; d <= 9; d++) {
      const b = 1 << (d - 1);
      if (!(bestMask & b)) continue;
      g[best] = d;
      rows[ROW[best]!]! |= b;
      cols[COL[best]!]! |= b;
      boxes[BOX[best]!]! |= b;
      const stop = dfs();
      g[best] = 0;
      rows[ROW[best]!]! &= ~b;
      cols[COL[best]!]! &= ~b;
      boxes[BOX[best]!]! &= ~b;
      if (stop) return true;
    }
    return false;
  };
  dfs();
  return { count, first, all, exhausted };
}

const SETTINGS: Record<KillerLevel, { sizes: number[]; extraGivens: number }> = {
  easy: { sizes: [2, 2, 2, 3, 3], extraGivens: 10 },
  hard: { sizes: [2, 3, 3, 4, 4, 5], extraGivens: 2 },
};

/**
 * Deterministic for a level and seed. Every puzzle returned has exactly one
 * solution: the solver proves it, revealing givens where needed.
 */
export function generateKiller(level: KillerLevel, seed: string): KillerPuzzle {
  const rng = createRng(`killer:${level}:${seed}`);
  for (;;) {
    const solution = randomFullGrid(rng);
    const cages = makeCages(solution, rng, SETTINGS[level].sizes);
    const givens = new Array<number>(CELLS).fill(0);
    for (const i of shuffleInPlace(Array.from({ length: CELLS }, (_, k) => k), rng).slice(0, SETTINGS[level].extraGivens)) givens[i] = solution[i]!;
    let ok = false;
    for (let tries = 0; tries < 60; tries++) {
      const r = killerSolve(cages, givens, 2, 12_000);
      if (!r.exhausted && r.count === 1) {
        ok = true;
        break;
      }
      // Two solutions: reveal a cell where the other differs. Search too long: reveal any empty cell.
      const other = r.all.find((x) => x.some((v, i) => v !== solution[i]));
      const open = Array.from({ length: CELLS }, (_, i) => i).filter((i) => !givens[i] && (!other || other[i] !== solution[i]));
      if (!open.length) break;
      const pick = open[randomInt(rng, open.length)]!;
      givens[pick] = solution[pick]!;
    }
    if (ok) return { level, seed, cages, givens, solution };
  }
}


/**
 * Cells breaking a cage rule: a digit repeated inside a cage, or a full cage
 * whose digits do not add up to its sum (or an unfinished one already over it).
 */
export function cageErrors(cages: readonly Cage[], values: readonly number[]): Set<number> {
  const out = new Set<number>();
  for (const cage of cages) {
    let sum = 0;
    let filled = 0;
    for (const c of cage.cells) {
      const v = values[c]!;
      if (!v) continue;
      sum += v;
      filled++;
      const twins = cage.cells.filter((x) => values[x] === v);
      if (twins.length > 1) twins.forEach((x) => out.add(x));
    }
    if ((filled === cage.cells.length && sum !== cage.sum) || sum > cage.sum) for (const c of cage.cells) if (values[c]) out.add(c);
  }
  return out;
}
