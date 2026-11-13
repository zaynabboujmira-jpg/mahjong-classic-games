import { describe, expect, it } from 'vitest';
import { Checkers, RED, RED_KING, RED_MAN, WHITE, WHITE_MAN, chooseCheckersMove, evaluate, isDark } from '../../src/engines/board/checkers';
import { Dominoes, chooseDominoPlay, fullSet, isDouble, pips } from '../../src/engines/board/dominoes';

const board = (...rows: string[]) => rows.join('');
const sq = (r: number, c: number) => r * 8 + c;

describe('Checkers', () => {
  it('sets up 12 men each on the dark squares; Red has 7 opening moves', () => {
    const g = new Checkers();
    expect(g.count(RED)).toBe(12);
    expect(g.count(WHITE)).toBe(12);
    expect(g.board.every((p, s) => !p || isDark(s))).toBe(true);
    expect(g.moves()).toHaveLength(7);
    expect(g.moves().every((m) => m.path[1]! >> 3 === 4)).toBe(true);
  });

  it('men only move forward; kings both ways', () => {
    const g = new Checkers(board('........', '........', '........', '...r....', '........', '........', '........', '........'));
    expect(g.moves().map((m) => m.path[1]).sort()).toEqual([sq(2, 2), sq(2, 4)].sort());
    const k = new Checkers(board('........', '........', '........', '...R....', '........', '........', '........', '........'));
    expect(k.moves()).toHaveLength(4);
  });

  it('jumping is compulsory', () => {
    const g = new Checkers(board('........', '........', '........', '........', '....w...', '...r....', '........', 'r.......'));
    const moves = g.moves();
    expect(moves).toHaveLength(1);
    expect(moves[0]!.captures).toEqual([sq(4, 4)]);
    expect(moves[0]!.path).toEqual([sq(5, 3), sq(3, 5)]);
  });

  it('follows multi-jump chains to the end, with branches', () => {
    // Red man at (7,0) can jump (6,1) to (5,2), then (4,3) to (3,4), then branch.
    const g = new Checkers(board('........', '........', '...w.w..', '........', '...w....', '........', '.w......', 'r.......'));
    const moves = g.moves();
    expect(moves.every((m) => m.captures.length === 3)).toBe(true);
    expect(moves.map((m) => m.path[m.path.length - 1]).sort()).toEqual([sq(1, 2), sq(1, 6)].sort());
    g.play(moves[0]!);
    expect(g.count(WHITE)).toBe(1);
    expect(g.turn).toBe(WHITE);
  });

  it('a jump cannot take the same piece twice', () => {
    const g = new Checkers(board('........', '........', '...w....', '........', '...w....', '..R.....', '........', '........'));
    const moves = g.moves();
    expect(moves.every((m) => new Set(m.captures).size === m.captures.length)).toBe(true);
    expect(moves).toHaveLength(1);
    expect(moves[0]!.captures).toHaveLength(2);
  });

  it('a man is crowned on the far row and its move ends there', () => {
    // After jumping to row 0 the new king could jump again, but the move ends.
    const g = new Checkers(board('........', '.w.w....', '..r.....', '........', '........', '........', '........', '........'));
    const moves = g.moves();
    expect(moves.every((m) => m.captures.length === 1)).toBe(true);
    g.play(moves.find((m) => m.path[1] === sq(0, 4))!);
    expect(g.board[sq(0, 4)]).toBe(RED_KING);
    expect(g.turn).toBe(WHITE);
  });

  it('undo restores the board and turn', () => {
    const g = new Checkers();
    const before = [...g.board];
    g.play(g.moves()[0]!);
    g.undo();
    expect(g.board).toEqual(before);
    expect(g.turn).toBe(RED);
  });

  it('declares a win when the opponent has no moves or pieces, and a draw after 40 quiet moves each', () => {
    const g = new Checkers(board('........', '........', '........', '........', '........', '........', '........', 'r.......'), WHITE);
    expect(g.result()).toBe(RED);
    const blocked = new Checkers(board('w.......', '.r......', '..r.....', '........', '........', '........', '........', '........'), WHITE);
    expect(blocked.result()).toBe(RED);
    const quiet = new Checkers(board('........', '........', '...W....', '........', '........', '....R...', '........', '........'));
    quiet.quiet = 80;
    expect(quiet.result()).toBe('draw');
  });

  it('the AI takes a free piece and avoids giving one away', () => {
    const g = new Checkers(board('........', '........', '........', '........', '........', '..w.....', '...r....', '........'), WHITE);
    // White must capture.
    expect(chooseCheckersMove(g, 'medium')!.captures).toEqual([sq(6, 3)]);
    // Red: moving to (4,3) next to the white man would be jumped; the other move is safe.
    const h = new Checkers(board('........', '........', '........', '..w.....', '........', '...r....', '........', '........'));
    const m = chooseCheckersMove(h, 'hard')!;
    expect(m.path[1]).toBe(sq(4, 4));
  });

  it('Hard beats Easy and thinks quickly', () => {
    let hardWins = 0;
    let worst = 0;
    for (let game = 0; game < 2; game++) {
      const g = new Checkers();
      let n = 0;
      let seed = game + 3;
      const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      while (!g.result() && n++ < 300) {
        const t = performance.now();
        const m = chooseCheckersMove(g, g.turn === RED ? 'hard' : 'easy', rng)!;
        if (g.turn === RED) worst = Math.max(worst, performance.now() - t);
        g.play(m);
      }
      if (g.result() === RED) hardWins++;
    }
    expect(hardWins).toBe(2);
    expect(worst).toBeLessThan(2000);
  }, 60_000);

  it('evaluation favours the side with more material', () => {
    const g = new Checkers(board('........', '........', '...w....', '........', '........', '....r...', '.r......', '........'));
    expect(evaluate(g, RED)).toBeGreaterThan(50);
    expect(evaluate(g, WHITE)).toBeLessThan(-50);
    expect(RED_MAN).toBe(1);
    expect(WHITE_MAN).toBe(3);
  });
});

describe('Dominoes', () => {
  it('uses the 28 tiles of a double-six set (168 pips)', () => {
    const set = fullSet();
    expect(set).toHaveLength(28);
    expect(new Set(set.map((t) => t.join())).size).toBe(28);
    expect(set.reduce((n, t) => n + pips(t), 0)).toBe(168);
    expect(set.filter(isDouble)).toHaveLength(7);
  });

  it('deals 7 tiles each for two players and 5 for three or four', () => {
    const two = new Dominoes(2, 'draw', 'a');
    expect(two.hands.map((h) => h.length)).toEqual([7, 7]);
    expect(two.boneyard).toHaveLength(14);
    const four = new Dominoes(4, 'block', 'a');
    expect(four.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
  });

  it('the holder of the highest double leads with it', () => {
    const g = new Dominoes(2, 'draw', 'lead');
    const hand = g.hands[g.turn]!;
    const lead = hand[g.openingTile()]!;
    const allDoubles = g.hands.flat().filter(isDouble);
    if (allDoubles.length) expect(pips(lead)).toBe(Math.max(...allDoubles.map(pips)));
    expect(g.legal()).toEqual([{ tile: g.openingTile(), end: 'left' }]);
  });

  it('plays tiles on matching ends and turns them the right way', () => {
    const g = new Dominoes(2, 'block', 'x');
    g.hands = [
      [
        [6, 6],
        [2, 6],
      ],
      [
        [6, 3],
        [1, 1],
      ],
    ];
    g.turn = 0;
    g.play(0, 0, 'left');
    expect(g.ends).toEqual([6, 6]);
    g.play(1, 0, 'right');
    expect(g.ends).toEqual([6, 3]);
    expect(g.line[1]).toMatchObject({ a: 6, b: 3 });
    expect(g.legal(0)).toEqual([{ tile: 0, end: 'left' }]);
    expect(g.fits(0, 0)).toEqual(['left']);
    g.play(0, 0, 'left');
    expect(g.ends).toEqual([2, 3]);
    expect(g.line[0]).toMatchObject({ a: 2, b: 6 });
  });

  it('draw game: draw until you can play, then pass when the boneyard is empty', () => {
    const g = new Dominoes(2, 'draw', 'd');
    g.hands = [[[0, 0]], [[5, 5]]];
    g.line = [{ tile: [3, 4], a: 3, b: 4, by: 0 }];
    g.boneyard = [[1, 2], [4, 6], [0, 1]];
    g.turn = 1;
    expect(() => g.pass(1)).toThrow();
    expect(g.draw(1)).toEqual([0, 1]);
    expect(g.draw(1)).toEqual([4, 6]);
    expect(g.canPlay(1)).toBe(true);
    expect(g.draw(1)).toBeNull();
    expect(g.lacks[1]!.has(3)).toBe(true);
  });

  it('going out scores the pips left in the other hands', () => {
    const g = new Dominoes(3, 'block', 'o');
    g.hands = [[[2, 3]], [[6, 6]], [[1, 0], [4, 4]]];
    g.line = [{ tile: [3, 5], a: 3, b: 5, by: 1 }];
    g.turn = 0;
    g.play(0, 0, 'left');
    expect(g.result).toMatchObject({ winner: 0, points: 12 + 9, blocked: false });
    expect(g.scores).toEqual([21, 0, 0]);
  });

  it('a blocked round goes to the lowest hand; a tie scores nothing', () => {
    const g = new Dominoes(2, 'block', 'b');
    g.hands = [[[1, 1]], [[2, 2]]];
    g.line = [{ tile: [5, 6], a: 5, b: 6, by: 0 }];
    g.turn = 0;
    g.pass(0);
    g.pass(1);
    expect(g.result).toMatchObject({ winner: 0, points: 4, blocked: true });
    const t = new Dominoes(2, 'block', 't');
    t.hands = [[[1, 2]], [[0, 3]]];
    t.line = [{ tile: [5, 6], a: 5, b: 6, by: 0 }];
    t.turn = 0;
    t.pass(0);
    t.pass(1);
    expect(t.result!.winner).toBeNull();
  });

  it('the AI prefers blocking ends the next player lacks', () => {
    const g = new Dominoes(2, 'block', 'ai');
    g.hands = [
      [
        [4, 1],
        [4, 2],
      ],
      [[0, 0]],
    ];
    g.line = [{ tile: [4, 4], a: 4, b: 4, by: 1 }];
    g.lacks[1] = new Set([1]);
    g.turn = 0;
    const p = chooseDominoPlay(g)!;
    expect(g.hands[0]![p.tile]).toEqual([4, 1]);
  });

  it('whole matches between computer players always finish', () => {
    for (const [players, mode] of [
      [2, 'draw'],
      [3, 'block'],
      [4, 'draw'],
    ] as const) {
      const g = new Dominoes(players, mode, `m${players}`, 100);
      let guard = 0;
      while (g.matchWinner === null && guard++ < 5000) {
        if (g.result) {
          g.nextRound();
          continue;
        }
        const play = chooseDominoPlay(g);
        if (play) g.play(g.turn, play.tile, play.end);
        else if (!g.draw()) g.pass();
      }
      expect(g.matchWinner).not.toBeNull();
      // Every tile is accounted for in each round.
      expect(g.hands.flat().length + g.boneyard.length + g.line.length).toBe(28);
    }
  });
});
