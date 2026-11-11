/**
 * Sudoku geometry shared by the solver, the logic grader and the game.
 * A grid is 81 numbers in row-major order, 0 for an empty cell. Candidates
 * are 9-bit masks: bit d-1 set means digit d is still possible.
 */
export type Grid = number[];

export const SIZE = 9;
export const CELLS = 81;
export const ALL = 0x1ff;

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
export const bit = (d: number) => 1 << (d - 1);

/** The 27 units: rows 0-8, columns 9-17, boxes 18-26. */
export const UNITS: readonly (readonly number[])[] = (() => {
  const units: number[][] = [];
  for (let r = 0; r < 9; r++) units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    units.push(Array.from({ length: 9 }, (_, k) => (r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3)));
  }
  return units;
})();

/** The 20 cells that share a row, column or box with each cell. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: CELLS }, (_, i) => {
  const set = new Set<number>();
  for (const u of [UNITS[rowOf(i)]!, UNITS[9 + colOf(i)]!, UNITS[18 + boxOf(i)]!]) for (const j of u) if (j !== i) set.add(j);
  return [...set];
});

export function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

/** Digits (1-9) present in a candidate mask, ascending. */
export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d);
  return out;
}

/** Candidate mask of an empty cell given the placed digits around it. */
export function candidatesAt(grid: readonly number[], i: number): number {
  let used = 0;
  for (const p of PEERS[i]!) if (grid[p]) used |= bit(grid[p]!);
  return ALL & ~used;
}

/** "row 3, column 5" style names for hints and screen readers (1-based). */
export const cellName = (i: number) => `row ${rowOf(i) + 1}, column ${colOf(i) + 1}`;
/** cellName for the start of a sentence. */
export const CellName = (i: number) => `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}`;

/** Parses an 81-character string ("." or "0" for empty) into a grid. */
export function parseGrid(s: string): Grid {
  const chars = s.replace(/\s+/g, '');
  if (chars.length !== CELLS) throw new Error(`Expected 81 cells, got ${chars.length}`);
  return [...chars].map((ch) => (ch >= '1' && ch <= '9' ? Number(ch) : 0));
}

export const gridToString = (g: readonly number[]) => g.map((v) => (v ? String(v) : '.')).join('');

/** True when no digit repeats in any unit (empty cells ignored). */
export function isConsistent(grid: readonly number[]): boolean {
  for (const u of UNITS) {
    let seen = 0;
    for (const i of u) {
      const v = grid[i]!;
      if (!v) continue;
      if (seen & bit(v)) return false;
      seen |= bit(v);
    }
  }
  return true;
}
