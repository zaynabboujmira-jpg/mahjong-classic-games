import { describe, expect, it } from 'vitest';
import PUZZLES from '../../src/data/chess-puzzles.json';
import { Chess } from '../../src/engines/board/chess';
import { bestDefence, dailyIndex, matingMoves, uci, verifyPuzzle, type ChessPuzzle } from '../../src/engines/board/chess-puzzles';
import { dailyLink } from '../../src/engines/core/progress';

const mate1 = PUZZLES.mate1 as ChessPuzzle[];
const mate2 = PUZZLES.mate2 as ChessPuzzle[];

describe('chess puzzle set', () => {
  it('has plenty of mate-in-1 and mate-in-2 puzzles, all different positions', () => {
    expect(mate1.length).toBeGreaterThanOrEqual(150);
    expect(mate2.length).toBeGreaterThanOrEqual(140);
    const boards = [...mate1, ...mate2].map((p) => p.fen.split(' ').slice(0, 2).join(' '));
    expect(new Set(boards).size).toBe(boards.length);
  });

  it('every mate in 1 has exactly one mating move: the key', () => {
    for (const p of mate1) {
      expect(p.mate).toBe(1);
      expect(verifyPuzzle(p), p.fen).toBe(true);
    }
  });

  it('every mate in 2 has no mate in 1 and exactly one key move that mates against every defence', () => {
    for (const p of mate2) {
      expect(p.mate).toBe(2);
      expect(verifyPuzzle(p), p.fen).toBe(true);
    }
  }, 120_000);

  it('after the key move the chosen defence still allows a mate', () => {
    for (const p of mate2.slice(0, 40)) {
      const g = new Chess(p.fen);
      g.play(g.moves().find((m) => uci(m) === p.key)!);
      const r = bestDefence(g)!;
      g.play(r);
      expect(matingMoves(g).length, p.fen).toBeGreaterThan(0);
    }
  });

  it('a wrong puzzle fails verification', () => {
    const p = mate1[0]!;
    const other = new Chess(p.fen).moves().find((m) => uci(m) !== p.key)!;
    expect(verifyPuzzle({ ...p, key: uci(other) })).toBe(false);
  });
});

describe('daily chess puzzle', () => {
  it('picks a valid mate in 2 for every day and does not repeat for many days', () => {
    const picks = Array.from({ length: mate2.length }, (_, d) => dailyIndex(1000 + d, mate2.length));
    for (const i of picks) expect(i).toBeGreaterThanOrEqual(0);
    expect(new Set(picks).size).toBe(mate2.length);
    expect(dailyLink('chess-puzzles', 5)).toBe('/board/chess-puzzles/?mode=daily');
  });
});
