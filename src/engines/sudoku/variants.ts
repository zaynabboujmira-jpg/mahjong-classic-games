import { createRng, randomInt, shuffleInPlace, type Rng } from '../core/rng';

/*
 * Sudoku variants on one engine: any size N, any region layout, optional
 * diagonals. A shape is just its units (rows, columns, regions and maybe the
 * two diagonals); each must hold 1..N once.
 *
 *  - 6×6: 2×3 boxes (a first Sudoku for children).
 *  - Diagonal: classic 9×9 plus both long diagonals.
 *  - Jigsaw: 9×9 with nine irregular regions of nine cells, a new layout for
 *    every puzzle, grown from the classic boxes by random swaps.
 *  - 16×16: 4×4 boxes, digits 1 to 16.
 *
 * Puzzles: fill a random full grid, then remove clues while the puzzle stays
 * solvable by singles alone (Easy: naked singles only; Medium: hidden singles
 * too, and at least one must be needed). A logical solve proves the puzzle
 * has exactly one solution.
 */
export const VARIANTS = ['6x6', 'diagonal', 'jigsaw', '16x16'] as const;
export type Variant = (typeof VARIANTS)[number];
export const VARIANT_LEVELS = ['easy', 'medium'] as const;
export type VariantLevel = (typeof VARIANT_LEVELS)[number];

export interface Shape {
  variant: Variant;
  n: number;
  /** Region (box) index of every cell. */
  region: number[];
  diagonals: boolean;
  units: number[][];
  peers: number[][];
}

const SIZE: Record<Variant, { n: number; bh: number; bw: number; diagonals: boolean }> = {
  '6x6': { n: 6, bh: 2, bw: 3, diagonals: false },
  diagonal: { n: 9, bh: 3, bw: 3, diagonals: true },
  jigsaw: { n: 9, bh: 3, bw: 3, diagonals: false },
  '16x16': { n: 16, bh: 4, bw: 4, diagonals: false },
};

export function makeShape(variant: Variant, region?: number[]): Shape {
  const { n, bh, bw, diagonals } = SIZE[variant];
  const reg = region ?? Array.from({ length: n * n }, (_, i) => Math.floor(Math.floor(i / n) / bh) * (n / bw) + Math.floor((i % n) / bw));
  const units: number[][] = [];
  for (let r = 0; r < n; r++) units.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) units.push(Array.from({ length: n }, (_, r) => r * n + c));
  for (let k = 0; k < n; k++) units.push(reg.flatMap((g, i) => (g === k ? [i] : [])));
  if (diagonals) {
    units.push(Array.from({ length: n }, (_, k) => k * n + k));
    units.push(Array.from({ length: n }, (_, k) => k * n + (n - 1 - k)));
  }
  const peers = Array.from({ length: n * n }, (_, i) => {
    const set = new Set<number>();
    for (const u of units) if (u.includes(i)) for (const j of u) if (j !== i) set.add(j);
    return [...set];
  });
  return { variant, n, region: reg, diagonals, units, peers };
}

/** Nine connected regions of nine cells: the classic boxes reshaped by random swaps along region borders. */
export function jigsawRegions(rng: Rng): number[] {
  const n = 9;
  const reg = makeShape('diagonal').region.slice();
  const nb = (i: number) => {
    const r = Math.floor(i / n);
    const c = i % n;
    return [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter((x) => x >= 0);
  };
  const connected = (k: number) => {
    const cells = reg.flatMap((g, i) => (g === k ? [i] : []));
    const seen = new Set([cells[0]!]);
    const stack = [cells[0]!];
    while (stack.length) for (const m of nb(stack.pop()!)) if (reg[m] === k && !seen.has(m)) seen.add(m), stack.push(m);
    return seen.size === cells.length;
  };
  for (let step = 0, done = 0; step < 4000 && done < 120; step++) {
    const a = randomInt(rng, n * n);
    const A = reg[a]!;
    const others = nb(a).filter((m) => reg[m] !== A);
    if (!others.length) continue;
    const B = reg[others[randomInt(rng, others.length)]!]!;
    // A cell of B touching A, to give back so both stay at nine cells.
    const backs = reg.flatMap((g, i) => (g === B && i !== a && nb(i).some((m) => reg[m] === A && m !== a) ? [i] : []));
    if (!backs.length) continue;
    const b = backs[randomInt(rng, backs.length)]!;
    reg[a] = B;
    reg[b] = A;
    if (connected(A) && connected(B)) done++;
    else {
      reg[a] = A;
      reg[b] = B;
    }
  }
  return reg;
}

/** Counts solutions up to `limit`; with an rng, digits are tried in random order (for filling). */
export function solveShape(shape: Shape, grid: readonly number[], limit = 2, rng?: Rng, budget = 200_000): { count: number; solution: number[] | null; exhausted: boolean } {
  const { n, peers } = shape;
  const all = (1 << n) - 1;
  const g = grid.slice();
  let count = 0;
  let solution: number[] | null = null;
  let nodes = 0;
  let exhausted = false;
  const mask = (i: number) => {
    let used = 0;
    for (const p of peers[i]!) if (g[p]) used |= 1 << (g[p]! - 1);
    return all & ~used;
  };
  const dfs = (): boolean => {
    if (++nodes > budget) return (exhausted = true);
    let best = -1;
    let bestMask = 0;
    let bestN = 99;
    for (let i = 0; i < g.length; i++) {
      if (g[i]) continue;
      const m = mask(i);
      let k = 0;
      for (let x = m; x; x &= x - 1) k++;
      if (!k) return false;
      if (k < bestN) (best = i), (bestMask = m), (bestN = k);
      if (k === 1) break;
    }
    if (best < 0) {
      count++;
      solution ??= g.slice();
      return count >= limit;
    }
    const digits: number[] = [];
    for (let d = 1; d <= n; d++) if (bestMask & (1 << (d - 1))) digits.push(d);
    if (rng) shuffleInPlace(digits, rng);
    for (const d of digits) {
      g[best] = d;
      if (dfs()) return true;
    }
    g[best] = 0;
    return false;
  };
  dfs();
  return { count, solution, exhausted };
}

/**
 * Solves with singles only. Level 1: naked singles. Level 2: hidden singles too.
 * Returns the hardest level used, or 0 if the puzzle cannot be finished that way.
 */
export function singlesSolve(shape: Shape, grid: readonly number[], maxLevel: number): number {
  const { n, peers, units } = shape;
  const all = (1 << n) - 1;
  const g = grid.slice();
  let used = 1;
  const cand = (i: number) => {
    let u = 0;
    for (const p of peers[i]!) if (g[p]) u |= 1 << (g[p]! - 1);
    return all & ~u;
  };
  for (;;) {
    let progress = false;
    let empty = 0;
    for (let i = 0; i < g.length; i++) {
      if (g[i]) continue;
      empty++;
      const m = cand(i);
      if (!m) return 0;
      if ((m & (m - 1)) === 0) {
        g[i] = 31 - Math.clz32(m) + 1;
        progress = true;
      }
    }
    if (!empty) return used;
    if (progress) continue;
    if (maxLevel < 2) return 0;
    for (const u of units) {
      for (let d = 1; d <= n; d++) {
        const b = 1 << (d - 1);
        if (u.some((i) => g[i] === d)) continue;
        const spots = u.filter((i) => !g[i] && cand(i) & b);
        if (spots.length === 1) {
          g[spots[0]!] = d;
          progress = true;
          used = 2;
        }
      }
    }
    if (!progress) return 0;
  }
}

export interface VariantPuzzle {
  variant: Variant;
  level: VariantLevel;
  seed: string;
  region: number[];
  givens: number[];
  solution: number[];
}

const TARGET: Record<Variant, Record<VariantLevel, number>> = {
  '6x6': { easy: 16, medium: 12 },
  diagonal: { easy: 34, medium: 26 },
  jigsaw: { easy: 34, medium: 26 },
  '16x16': { easy: 150, medium: 120 },
};

export function generateVariant(variant: Variant, level: VariantLevel, seed: string): VariantPuzzle {
  const rng = createRng(`variant:${variant}:${level}:${seed}`);
  const maxLevel = level === 'easy' ? 1 : 2;
  let fallback: VariantPuzzle | null = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const shape = makeShape(variant, variant === 'jigsaw' ? jigsawRegions(rng) : undefined);
    const full = solveShape(shape, new Array<number>(shape.n * shape.n).fill(0), 1, rng);
    if (!full.solution) continue;
    const solution = full.solution;
    const givens = solution.slice();
    let clues = givens.length;
    for (const i of shuffleInPlace(Array.from({ length: givens.length }, (_, k) => k), rng)) {
      if (clues <= TARGET[variant][level]) break;
      const v = givens[i]!;
      givens[i] = 0;
      if (singlesSolve(shape, givens, maxLevel)) clues--;
      else givens[i] = v;
    }
    const puzzle = { variant, level, seed, region: shape.region, givens, solution };
    const used = singlesSolve(shape, givens, maxLevel);
    if (used >= maxLevel) return puzzle;
    fallback ??= puzzle;
  }
  return fallback!;
}

/** Digit label: 1-9, then 10-16 for the big grid. */
export const digitLabel = (d: number) => String(d);
