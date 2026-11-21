import { describe, expect, it } from 'vitest';
import { Chess, FLAG_CASTLE, START_FEN, backRank960, fen960, parseSquare } from '../../src/engines/board/chess';
import { chooseMove } from '../../src/engines/board/chess-ai';
import { createRng } from '../../src/engines/core/rng';

describe('Chess960 start positions', () => {
  it('uses the standard numbering: 518 is the normal set-up, 0 is BBQNNRKR', () => {
    expect(backRank960(518)).toBe('RNBQKBNR');
    expect(backRank960(0)).toBe('BBQNNRKR');
  });

  it('gives 960 different legal set-ups: bishops on opposite colours, king between the rooks', () => {
    const all = new Set<string>();
    for (let n = 0; n < 960; n++) {
      const r = backRank960(n);
      all.add(r);
      expect([...r].sort().join('')).toBe('BBKNNQRR');
      const b = [...r].flatMap((p, i) => (p === 'B' ? [i] : []));
      expect((b[0]! + b[1]!) % 2).toBe(1);
      const k = r.indexOf('K');
      expect(r.indexOf('R')).toBeLessThan(k);
      expect(r.lastIndexOf('R')).toBeGreaterThan(k);
    }
    expect(all.size).toBe(960);
  });

  it('position 518 in 960 mode has the same move counts as normal chess', () => {
    const perft = (g: Chess, d: number): number => {
      if (!d) return 1;
      let n = 0;
      for (const m of g.moves()) {
        g.makeMove(m);
        n += perft(g, d - 1);
        g.unmakeMove();
      }
      return n;
    };
    expect(perft(new Chess(fen960(518), { chess960: true }), 3)).toBe(8902);
    expect(new Chess(fen960(518), { chess960: true }).fen()).toBe(START_FEN);
  });
});

describe('Chess960 castling', () => {
  it('king on b1 and rook on a1: queen-side castling puts the king on c1 and the rook on d1', () => {
    // Back rank RK......; only kings and rooks, black mirrored.
    const g = new Chess('rk5r/8/8/8/8/8/8/RK5R w KQkq - 0 1', { chess960: true });
    expect(g.castleFiles).toEqual([7, 0]);
    const qs = g.moves().find((m) => m.flags & FLAG_CASTLE && m.to === parseSquare('a1'))!;
    expect(qs).toBeDefined();
    expect(g.san(qs)).toBe('O-O-O');
    g.play(qs);
    expect(g.board[parseSquare('c1')]).toBe(6); // white king
    expect(g.board[parseSquare('d1')]).toBe(4); // white rook
    expect(g.board[parseSquare('a1')]).toBe(0);
    expect(g.board[parseSquare('b1')]).toBe(0);
    g.takeBack();
    expect(g.fen()).toBe('rk5r/8/8/8/8/8/8/RK5R w KQkq - 0 1');
  });

  it('king-side castling when the king already stands on g1 just moves the rook to f1', () => {
    const g = new Chess('r5kr/8/8/8/8/8/8/R5KR w KQkq - 0 1', { chess960: true });
    const ks = g.moves().find((m) => m.flags & FLAG_CASTLE && m.to === parseSquare('h1'))!;
    expect(ks).toBeDefined();
    g.play(ks);
    expect(g.board[parseSquare('g1')]).toBe(6);
    expect(g.board[parseSquare('f1')]).toBe(4);
    expect(g.castle & 3).toBe(0);
  });

  it('is not allowed through a piece, through check, or after the rook has moved', () => {
    expect(new Chess('rk5r/8/8/8/8/8/8/RKN4R w KQkq - 0 1', { chess960: true }).moves().some((m) => m.flags & FLAG_CASTLE && m.to === parseSquare('a1'))).toBe(false);
    // A black rook on the c-file attacks c1, where the king would pass.
    expect(new Chess('1k5r/8/8/8/8/2r5/8/RK5R w KQ - 0 1', { chess960: true }).moves().some((m) => m.flags & FLAG_CASTLE && m.to === parseSquare('a1'))).toBe(false);
    const g = new Chess('rk5r/8/8/8/8/8/8/RK5R w KQkq - 0 1', { chess960: true });
    g.play(g.find('a1a2')!);
    g.play(g.find('h8h7')!);
    g.play(g.find('a2a1')!);
    g.play(g.find('h7h8')!);
    expect(g.moves().some((m) => m.flags & FLAG_CASTLE && m.to === parseSquare('a1'))).toBe(false);
  });

  it('random games from many start positions: every move and take-back restores the position', () => {
    for (const n of [0, 1, 100, 357, 518, 700, 959]) {
      const g = new Chess(fen960(n), { chess960: true });
      const rng = createRng(`960:${n}`);
      for (let ply = 0; ply < 120 && !g.outcome(); ply++) {
        const before = g.fen();
        const moves = g.moves();
        for (const m of moves) {
          g.makeMove(m);
          g.unmakeMove();
          expect(g.fen()).toBe(before);
        }
        g.play(moves[Math.floor(rng() * moves.length)]!);
        // Exactly one king per side, always.
        expect(g.board.filter((p) => p === 6)).toHaveLength(1);
        expect(g.board.filter((p) => p === 14)).toHaveLength(1);
      }
    }
  });

  it('the computer plays legal Chess960 moves (its search keeps the variant)', () => {
    const g = new Chess(fen960(0), { chess960: true });
    for (let ply = 0; ply < 16 && !g.outcome(); ply++) {
      const m = chooseMove(g, 'beginner', createRng(ply));
      expect(m).not.toBeNull();
      expect(g.moves().some((x) => x.from === m!.from && x.to === m!.to && x.promo === m!.promo)).toBe(true);
      g.play(m!);
    }
  });
});
