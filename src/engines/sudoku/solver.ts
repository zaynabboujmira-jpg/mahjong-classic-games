import { randomInt, type Rng } from '../core/rng';
import { ALL, CELLS, boxOf, colOf, rowOf, type Grid } from './grid';

const BOX = Array.from({ length: CELLS }, (_, i) => boxOf(i));
const ROW = Array.from({ length: CELLS }, (_, i) => rowOf(i));
const COL = Array.from({ length: CELLS }, (_, i) => colOf(i));

/**
 * Depth-first search with bitmasks and "fewest candidates first". Fast enough
 * to count solutions (stopping at `limit`) on every cell removal, and with an
 * rng it doubles as the random full-grid filler for the generator.
 */
function search(grid: readonly number[], limit: number, rng?: Rng): { count: number; solution: Grid | null } {
  const g = grid.slice();
  const rows = new Int32Array(9);
  const cols = new Int32Array(9);
  const boxes = new Int32Array(9);
  for (let i = 0; i < CELLS; i++) {
    const v = g[i]!;
    if (!v) continue;
    const b = 1 << (v - 1);
    if (rows[ROW[i]!]! & b || cols[COL[i]!]! & b || boxes[BOX[i]!]! & b) return { count: 0, solution: null };
    rows[ROW[i]!]! |= b;
    cols[COL[i]!]! |= b;
    boxes[BOX[i]!]! |= b;
  }
  const empties: number[] = [];
  for (let i = 0; i < CELLS; i++) if (!g[i]) empties.push(i);

  let count = 0;
  let solution: Grid | null = null;

  const dfs = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (const i of empties) {
      if (g[i]) continue;
      const mask = ALL & ~(rows[ROW[i]!]! | cols[COL[i]!]! | boxes[BOX[i]!]!);
      let n = 0;
      for (let m = mask; m; m &= m - 1) n++;
      if (n === 0) return false;
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n === 1) break;
      }
    }
    if (best < 0) {
      count++;
      if (!solution) solution = g.slice();
      return count >= limit;
    }
    const digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << (d - 1))) digits.push(d);
    if (rng) {
      for (let k = digits.length - 1; k > 0; k--) {
        const j = randomInt(rng, k + 1);
        [digits[k], digits[j]] = [digits[j]!, digits[k]!];
      }
    }
    const r = ROW[best]!;
    const c = COL[best]!;
    const bx = BOX[best]!;
    for (const d of digits) {
      const b = 1 << (d - 1);
      g[best] = d;
      rows[r]! |= b;
      cols[c]! |= b;
      boxes[bx]! |= b;
      const stop = dfs();
      g[best] = 0;
      rows[r]! &= ~b;
      cols[c]! &= ~b;
      boxes[bx]! &= ~b;
      if (stop) return true;
    }
    return false;
  };

  dfs();
  return { count, solution };
}

/** Number of solutions, counting no further than `limit` (2 is enough to test uniqueness). */
export const countSolutions = (grid: readonly number[], limit = 2) => search(grid, limit).count;

/** The first solution found, or null when the grid has none. */
export const solve = (grid: readonly number[]): Grid | null => search(grid, 1).solution;

/** A uniformly shuffled, complete and valid grid. */
export function randomFullGrid(rng: Rng): Grid {
  const { solution } = search(new Array<number>(CELLS).fill(0), 1, rng);
  return solution!;
}
