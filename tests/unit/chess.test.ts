import { describe, expect, it } from 'vitest';
import { BLACK, Chess, QUEEN, START_FEN, WHITE, parseSquare, typeOf } from '../../src/engines/board/chess';
import { chooseMove, evaluate } from '../../src/engines/board/chess-ai';

const play = (g: Chess, ...sans: string[]) => {
  for (const s of sans) {
    const m = g.find(s);
    if (!m) throw new Error(`illegal ${s} in ${g.fen()}`);
    g.play(m);
  }
};

describe('Chess move generation (perft)', () => {
  it('start position', () => {
    const g = new Chess();
    expect(g.perft(1)).toBe(20);
    expect(g.perft(2)).toBe(400);
    expect(g.perft(3)).toBe(8902);
  });

  it('"Kiwipete": castling, en passant, promotions and pins', () => {
    const g = new Chess('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect(g.perft(1)).toBe(48);
    expect(g.perft(2)).toBe(2039);
    expect(g.perft(3)).toBe(97862);
  });

  it('endgame with en passant discovered checks', () => {
    const g = new Chess('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    expect(g.perft(1)).toBe(14);
    expect(g.perft(2)).toBe(191);
    expect(g.perft(3)).toBe(2812);
  });

  it('promotions and castling rights after captures', () => {
    expect(new Chess('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1').perft(3)).toBe(9467);
    expect(new Chess('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8').perft(2)).toBe(1486);
  });

  it('make and unmake restore the position exactly', () => {
    const g = new Chess('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    const fen = g.fen();
    for (const m of g.moves()) {
      g.makeMove(m);
      g.unmakeMove();
      expect(g.fen()).toBe(fen);
    }
  });
});

describe('Chess rules', () => {
  it('reads and writes FEN', () => {
    expect(new Chess().fen()).toBe(START_FEN);
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    expect(new Chess(fen).fen()).toBe(fen);
  });

  it('detects checkmate (the fastest mate)', () => {
    const g = new Chess();
    play(g, 'f3', 'e5', 'g4', 'Qh4#');
    expect(g.inCheck(WHITE)).toBe(true);
    expect(g.outcome()).toBe('checkmate');
  });

  it('detects stalemate', () => {
    const g = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(g.moves()).toHaveLength(0);
    expect(g.inCheck()).toBe(false);
    expect(g.outcome()).toBe('stalemate');
  });

  it('castles both ways, and not through or out of check', () => {
    const g = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const castles = g.moves().filter((m) => m.flags & 2).map((m) => g.san(m));
    expect(castles.sort()).toEqual(['O-O', 'O-O-O']);
    play(g, 'O-O');
    expect(g.board[parseSquare('g1')]).toBe(6);
    expect(g.board[parseSquare('f1')]).toBe(4);
    expect(g.castle & 3).toBe(0);
    // A rook attacking f8 stops black castling king side.
    const h = new Chess('r3k2r/8/8/8/8/8/1K6/5R2 b kq - 0 1');
    expect(h.moves().filter((m) => m.flags & 2).map((m) => h.san(m))).toEqual(['O-O-O']);
    // In check: no castling at all.
    const c = new Chess('r3k2r/8/8/8/8/8/8/4R2K b kq - 0 1');
    expect(c.moves().some((m) => m.flags & 2)).toBe(false);
  });

  it('captures en passant only right after the double step', () => {
    const g = new Chess();
    play(g, 'e4', 'a6', 'e5', 'd5');
    const ep = g.find('exd6');
    expect(ep).not.toBeNull();
    g.play(ep!);
    expect(g.board[parseSquare('d5')]).toBe(0);
    expect(g.board[parseSquare('d6')]).toBe(1);
    g.takeBack();
    play(g, 'Nf3', 'Nf6');
    expect(g.find('exd6')).toBeNull();
  });

  it('promotes to any piece and writes it in SAN', () => {
    const g = new Chess('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    const promos = g.moves().filter((m) => m.promo);
    expect(promos).toHaveLength(4);
    const q = promos.find((m) => m.promo === QUEEN)!;
    expect(g.san(q)).toBe('a8=Q');
    g.play(q);
    expect(typeOf(g.board[parseSquare('a8')]!)).toBe(QUEEN);
  });

  it('pinned pieces cannot move off the pin', () => {
    const g = new Chess('4k3/8/8/8/4r3/8/4N3/4K3 w - - 0 1');
    expect(g.moves(parseSquare('e2'))).toHaveLength(0);
  });

  it('disambiguates SAN', () => {
    const g = new Chess('4k3/8/8/8/8/8/4K3/R6R w - - 0 1');
    const m = g.moves().find((x) => x.from === parseSquare('a1') && x.to === parseSquare('d1'))!;
    expect(g.san(m)).toBe('Rad1');
  });

  it('draws by repetition, the fifty-move rule and insufficient material', () => {
    const g = new Chess();
    play(g, 'Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8');
    expect(g.outcome()).toBe('repetition');
    expect(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 100 80').outcome()).toBe('fifty-move');
    expect(new Chess('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1').outcome()).toBe('material');
    expect(new Chess('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1').outcome()).toBe('material');
    expect(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 0 1').outcome()).toBeNull();
  });

  it('takes moves back', () => {
    const g = new Chess();
    play(g, 'e4', 'e5', 'Nf3');
    g.takeBack();
    g.takeBack();
    expect(g.fen()).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    expect(g.turn).toBe(BLACK);
  });
});

describe('Chess AI', () => {
  it('evaluation is symmetric at the start', () => {
    expect(evaluate(new Chess())).toBe(0);
  });

  it('finds mate in one at Club and Tactician', () => {
    // Back-rank mate: Re8#.
    const fen = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
    for (const level of ['club', 'tactician'] as const) {
      const g = new Chess(fen);
      const m = chooseMove(g, level)!;
      expect(g.san(m)).toBe('Re8#');
    }
  });

  it('wins a hanging queen and avoids losing its own', () => {
    const g = new Chess('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1');
    expect(g.san(chooseMove(g, 'club')!)).toBe('Rxd5');
    // Black queen attacked by a pawn: it should move away.
    const h = new Chess('4k3/8/8/3q4/4P3/8/8/4K3 b - - 0 1');
    const m = chooseMove(h, 'tactician')!;
    expect(m.from).toBe(parseSquare('d5'));
  });

  it('answers in time and always with a legal move', () => {
    const g = new Chess('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
    const t = Date.now();
    const m = chooseMove(g, 'tactician')!;
    expect(Date.now() - t).toBeLessThan(2500);
    expect(g.moves().some((x) => x.from === m.from && x.to === m.to)).toBe(true);
    for (const level of ['beginner', 'club'] as const) expect(chooseMove(g, level)).not.toBeNull();
  });

  it('Club outplays Beginner', () => {
    const g = new Chess();
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let ply = 0; ply < 24 && !g.outcome(); ply++) g.play(chooseMove(g, g.turn === WHITE ? 'club' : 'beginner', rng)!);
    // White (Club) is clearly ahead in material, or has already mated.
    const material = g.board.reduce((n, p) => n + (p ? (p >> 3 ? -1 : 1) * [0, 1, 3, 3, 5, 9, 0][p & 7]! : 0), 0);
    expect(g.outcome() === 'checkmate' || material >= 3).toBe(true);
  }, 60_000);
});
