import { createRng, shuffleInPlace } from '../core/rng';
import { CELLS, type Grid } from './grid';
import { grade } from './logic';
import { randomFullGrid } from './solver';

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

interface Tier {
  /** Hardest technique level the puzzle may need (see TECHNIQUE_LEVEL). */
  maxLevel: number;
  /** Hardest technique level the puzzle must need, so tiers do not overlap. */
  minLevel: number;
  /** Stop removing clues at this count. */
  targetClues: number;
}

/**
 * Easy: naked singles, many clues. Medium: needs hidden singles. Hard: needs
 * locked candidates or pairs/triples. Expert: needs an X-Wing, XY-Wing or
 * Swordfish. Every tier is solvable by logic alone, with no guessing.
 */
export const TIERS: Record<Difficulty, Tier> = {
  easy: { maxLevel: 1, minLevel: 1, targetClues: 38 },
  medium: { maxLevel: 2, minLevel: 2, targetClues: 30 },
  hard: { maxLevel: 3, minLevel: 3, targetClues: 26 },
  expert: { maxLevel: 4, minLevel: 4, targetClues: 22 },
};

export interface Puzzle {
  difficulty: Difficulty;
  seed: string;
  givens: Grid;
  solution: Grid;
  /** Hardest technique level actually needed (1-4). */
  level: number;
}

const MAX_ATTEMPTS = 60;

/**
 * Deterministic: the same seed and difficulty always give the same puzzle.
 * Fills a random grid, then removes clues in symmetric pairs, keeping a
 * removal only while the puzzle stays solvable by logic up to the tier's
 * hardest technique. A logical solve is a proof of a unique solution.
 */
export function generate(difficulty: Difficulty, seed: string): Puzzle {
  const tier = TIERS[difficulty];
  const rng = createRng(`sudoku:${difficulty}:${seed}`);
  let fallback: Puzzle | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = randomFullGrid(rng);
    const givens = solution.slice();
    let clues = CELLS;
    const order = shuffleInPlace(Array.from({ length: 41 }, (_, i) => i), rng);
    /** Removes the clues if the puzzle stays solvable; returns the new grade level, or 0 if kept. */
    const tryRemove = (pair: number[]): number => {
      const saved = pair.map((c) => givens[c]!);
      if (saved.some((v) => !v)) return 0;
      for (const c of pair) givens[c] = 0;
      const g = grade(givens, tier.maxLevel);
      if (g.solved) {
        clues -= pair.length;
        return g.level;
      }
      pair.forEach((c, k) => (givens[c] = saved[k]!));
      return 0;
    };
    for (const i of order) {
      if (clues <= tier.targetClues) break;
      const j = CELLS - 1 - i;
      tryRemove(i === j ? [i] : [i, j]);
    }
    let level = grade(givens, tier.maxLevel).level;
    // Harder tiers: if symmetric removal stalled short of the tier, keep
    // digging one clue at a time (breaking symmetry) until the tier is met.
    if (level < tier.minLevel && tier.minLevel >= 3) {
      for (const i of shuffleInPlace(Array.from({ length: CELLS }, (_, k) => k), rng)) {
        if (clues <= tier.targetClues - 2) break;
        level = tryRemove([i]) || level;
        if (level >= tier.minLevel) break;
      }
    }
    const puzzle: Puzzle = { difficulty, seed, givens, solution, level };
    if (level >= tier.minLevel) return puzzle;
    if (!fallback || level > fallback.level) fallback = puzzle;
  }
  return fallback!;
}
