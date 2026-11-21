import { describe, expect, it } from 'vitest';
import { ChineseCheckers, HOLES, NEIGHBOURS, POINT_HOLES, POINTS, chooseMove, type CCLevel } from '../../src/engines/board/chinese-checkers';
import { createRng } from '../../src/engines/core/rng';

describe('chinese checkers board', () => {
  it('has 121 holes: a 61-hole hexagon and six points of 10', () => {
    expect(HOLES).toHaveLength(121);
    expect(HOLES.filter((h) => h.point === null)).toHaveLength(61);
    for (const p of POINTS) expect(POINT_HOLES[p]).toHaveLength(10);
  });
  it('neighbours are symmetric', () => {
    NEIGHBOURS.forEach((ns, i) => ns.forEach((n, d) => n >= 0 && expect(NEIGHBOURS[n]![(d + 3) % 6]).toBe(i)));
  });
});

describe('chinese checkers moves', () => {
  it('opening moves: steps and single hops out of the start point', () => {
    const g = new ChineseCheckers(2);
    const moves = g.legalMoves(0);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(g.s.board[m.to]).toBe(-1);
      expect(m.path[0]).toBe(m.from);
      expect(m.path[m.path.length - 1]).toBe(m.to);
    }
    expect(moves.some((m) => m.path.length === 2 && NEIGHBOURS[m.from]!.includes(m.to))).toBe(true);
  });

  it('follows multi-hop chains, each hop over an adjacent marble into the hole beyond', () => {
    const g = new ChineseCheckers(2);
    const board = g.s.board.map(() => -1);
    // A line of holes through the centre: marble at a, blockers at b and d, empties at c and e.
    const centre = HOLES.findIndex((h) => h.x === 0 && h.y === 0 && h.z === 0);
    const line = [-4, -3, -2, -1, 0].map((k) => HOLES.findIndex((h) => h.x === k && h.y === -k && h.z === 0));
    board[line[0]!] = 0;
    board[line[1]!] = 1;
    board[line[3]!] = 1;
    g.s.board = board;
    const to = g.movesFrom(line[0]!).find((m) => m.to === line[4]);
    expect(to?.path).toEqual([line[0], line[2], line[4]]);
    expect(line[4]).toBe(centre);
  });

  it('marbles may not end a move in a third player point', () => {
    const g = new ChineseCheckers(2);
    for (let n = 0; n < 200 && g.s.winner < 0; n++) {
      for (const m of g.legalMoves()) {
        const p = HOLES[m.to]!.point;
        expect(p === null || p === g.s.starts[g.s.turn] || p === g.target(g.s.turn)).toBe(true);
      }
      g.play(chooseMove(g, 'medium')!);
    }
  });

  it('undo restores the board and the turn', () => {
    const g = new ChineseCheckers(3);
    const before = JSON.stringify(g.s.board);
    g.play(g.legalMoves()[0]!);
    expect(g.s.turn).toBe(1);
    g.undo();
    expect(JSON.stringify(g.s.board)).toBe(before);
    expect(g.s.turn).toBe(0);
  });

  it('rejects moves out of turn or to occupied holes', () => {
    const g = new ChineseCheckers(2);
    const theirs = g.marbles(1)[0]!;
    expect(g.play({ from: theirs, to: theirs, path: [] })).toBe(false);
    const mine = g.marbles(0)[0]!;
    expect(g.play({ from: mine, to: g.marbles(0)[1]!, path: [] })).toBe(false);
  });
});

describe('chinese checkers computer', () => {
  for (const players of [2, 3, 4, 6])
    for (const level of ['easy', 'medium', 'hard'] as CCLevel[]) {
      it(`${players} computer players (${level}) finish a game`, () => {
        for (const seed of [1, 2]) {
          const g = new ChineseCheckers(players);
          const rng = createRng(`${seed}:${players}:${level}`);
          let n = 0;
          while (g.s.winner < 0 && n++ < 3000) {
            const m = chooseMove(g, level, rng);
            if (!m) break;
            expect(g.play(m)).toBe(true);
          }
          expect(g.s.winner, `${players}p ${level} seed ${seed} after ${n} moves`).toBeGreaterThanOrEqual(0);
          expect(g.hasWon(g.s.winner)).toBe(true);
        }
      }, 60_000);
    }

  it('restores from saved JSON', () => {
    const g = new ChineseCheckers(4);
    g.play(chooseMove(g)!);
    const copy = new ChineseCheckers(JSON.parse(JSON.stringify(g.s)));
    expect(copy.legalMoves()).toEqual(g.legalMoves());
  });
});
