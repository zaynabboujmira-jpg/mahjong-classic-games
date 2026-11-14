import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FULL_DECK } from '../../src/engines/solitaire/cards';
import { Pyramid, pIndex, rowOf } from '../../src/engines/solitaire/pyramid';
import { Grid, O, X, bestGomoku, bestTicTacToe } from '../../src/engines/board/tictactoe';
import { BASE_WORDS, WordBuilder, buildWheel, canSpell, pickBase, unpack } from '../../src/engines/puzzles/wordbuilder';

const card = (rank: number, suit = 0) => FULL_DECK.find((c) => c.rank === rank && c.suit === suit)!;

describe('Pyramid Solitaire', () => {
  it('deals a 28-card pyramid and a 24-card stock, reproducibly', () => {
    const g = new Pyramid('7');
    expect(g.pyramid).toHaveLength(28);
    expect(g.stock).toHaveLength(24);
    expect(new Set([...g.pyramid, ...g.stock].map((c) => c!.id)).size).toBe(52);
    expect(new Pyramid('7').pyramid).toEqual(g.pyramid);
    expect(pIndex(6, 0)).toBe(21);
    expect(rowOf(27)).toBe(6);
    expect(rowOf(0)).toBe(0);
  });

  it('only the bottom row starts exposed', () => {
    const g = new Pyramid('e');
    const exposed = g.available().filter((a) => a.source.kind === 'pyramid');
    expect(exposed.map((a) => (a.source as { index: number }).index)).toEqual([21, 22, 23, 24, 25, 26, 27]);
  });

  it('removes pairs adding to 13 and kings alone, exposing the cards above', () => {
    const g = new Pyramid('r');
    g.pyramid[21] = card(6);
    g.pyramid[22] = card(7, 1);
    g.pyramid[23] = card(13);
    g.pyramid[24] = card(5);
    expect(g.remove({ kind: 'pyramid', index: 21 }, { kind: 'pyramid', index: 24 })).toBe(false);
    expect(g.remove({ kind: 'pyramid', index: 21 }, { kind: 'pyramid', index: 22 })).toBe(true);
    expect(g.isExposed(15)).toBe(true);
    expect(g.remove({ kind: 'pyramid', index: 23 })).toBe(true);
    expect(g.isExposed(16)).toBe(true);
    expect(g.remove({ kind: 'pyramid', index: 24 })).toBe(false);
    expect(g.score).toBe(30);
    expect(g.undo()).toBe(true);
    expect(g.pyramid[23]).not.toBeNull();
  });

  it('pairs a pyramid card with the waste, and limits passes in Classic', () => {
    const g = new Pyramid('w');
    g.pyramid[21] = card(4);
    g.stock = [card(9, 2)];
    expect(g.draw()).toBe(true);
    expect(g.remove({ kind: 'pyramid', index: 21 }, { kind: 'waste' })).toBe(true);
    const c = new Pyramid('c');
    for (let i = 0; i < 24; i++) c.draw();
    expect(c.canRecycle).toBe(true);
    c.draw();
    expect(c.pass).toBe(2);
    for (let i = 0; i < 24; i++) c.draw();
    c.draw();
    for (let i = 0; i < 24; i++) c.draw();
    expect(c.pass).toBe(3);
    expect(c.canRecycle).toBe(false);
    expect(c.draw()).toBe(false);
    const relaxed = new Pyramid('c', 'relaxed');
    expect(relaxed.passesLeft).toBe(Infinity);
  });

  it('wins when the pyramid is cleared', () => {
    const g = new Pyramid('win');
    g.pyramid = g.pyramid.map(() => null);
    g.pyramid[27] = card(13);
    g.remove({ kind: 'pyramid', index: 27 });
    expect(g.won).toBe(true);
  });

  it('hints point at a legal removal', () => {
    for (let s = 0; s < 10; s++) {
      const g = new Pyramid(String(s));
      let guard = 0;
      while (!g.won && !g.stuck && guard++ < 400) {
        const h = g.hint();
        if (h) expect(g.remove(h[0]!, h[1])).toBe(true);
        else g.draw();
      }
      expect(g.won || g.stuck).toBe(true);
    }
  });
});

describe('Tic Tac Toe and Five in a Row', () => {
  it('detects wins, draws and undo on 3×3', () => {
    const g = new Grid(3);
    for (const i of [0, 3, 1, 4, 2]) g.play(i);
    expect(g.winner).toBe(X);
    expect(g.line).toEqual([0, 1, 2]);
    expect(g.play(5)).toBe(false);
    g.undo();
    expect(g.winner).toBe(0);
    const d = new Grid(3);
    for (const i of [0, 1, 2, 4, 3, 5, 7, 6, 8]) d.play(i);
    expect(d.winner).toBe(0);
    expect(d.full).toBe(true);
  });

  it('Hard never loses on 3×3, whoever starts', () => {
    // Play every possible opponent line against the Hard computer.
    let losses = 0;
    const explore = (g: Grid, ai: 1 | 2) => {
      if (g.over) {
        if (g.winner && g.winner !== ai) losses++;
        return;
      }
      if (g.turn === ai) {
        g.play(bestTicTacToe(g, 'hard', () => 0.5));
        explore(g, ai);
        g.undo();
      } else
        for (let i = 0; i < 9; i++) {
          if (g.cells[i]) continue;
          g.play(i);
          explore(g, ai);
          g.undo();
        }
    };
    explore(new Grid(3), X);
    explore(new Grid(3), O);
    expect(losses).toBe(0);
  });

  it('every level takes a winning move and Hard blocks one', () => {
    const g = new Grid(3);
    for (const i of [0, 3, 1, 4]) g.play(i);
    for (const level of ['easy', 'medium', 'hard'] as const) expect(bestTicTacToe(g, level, () => 0.99)).toBe(2);
    const b = new Grid(3);
    for (const i of [0, 4, 1]) b.play(i);
    expect(bestTicTacToe(b, 'hard')).toBe(2);
  });

  it('Five in a Row needs five; six also wins', () => {
    const g = new Grid(15);
    expect(g.need).toBe(5);
    const row = (c: number) => 7 * 15 + c;
    for (let k = 0; k < 4; k++) {
      g.play(row(k));
      g.play(k);
    }
    expect(g.winner).toBe(0);
    g.play(row(4));
    expect(g.winner).toBe(X);
    expect(g.line).toHaveLength(5);
  });

  it('the Five in a Row computer opens in the centre, blocks a four and completes its own', () => {
    const g = new Grid(15);
    expect(bestGomoku(g, 'hard')).toBe(7 * 15 + 7);
    // X has four in a row open at both ends; O must block.
    for (const [x, o] of [
      [100, 0],
      [101, 1],
      [102, 30],
    ]) {
      g.play(x!);
      g.play(o!);
    }
    g.play(103);
    const block = bestGomoku(g, 'hard');
    expect([99, 104]).toContain(block);
    // O to complete five.
    const h = new Grid(15);
    for (const [x, o] of [
      [0, 50],
      [2, 51],
      [4, 52],
      [6, 53],
    ]) {
      h.play(x!);
      h.play(o!);
    }
    h.play(8);
    expect([49, 54]).toContain(bestGomoku(h, 'hard'));
  });

  it('Hard beats Easy at Five in a Row', () => {
    let wins = 0;
    for (let n = 0; n < 8; n++) {
      const g = new Grid(15);
      let seed = n + 1;
      const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      while (!g.over) g.play(bestGomoku(g, g.turn === X ? 'hard' : 'easy', rng));
      if (g.winner === X) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  });
});

describe('Word Builder', () => {
  const dict = [4, 5, 6].flatMap((n) => unpack(readFileSync(`public/words/${n}.txt`, 'utf8'), n));

  it('reads the packed word files', () => {
    expect(dict.length).toBeGreaterThan(25_000);
    expect(dict).toContain('stone');
  });

  it('spells only with the wheel letters, each as often as it appears', () => {
    expect(canSpell('tone', 'another')).toBe(true);
    expect(canSpell('teeth', 'another')).toBe(false);
    expect(canSpell('heat', 'another')).toBe(true);
  });

  it('every base word gives a playable wheel', () => {
    expect(BASE_WORDS.length).toBeGreaterThan(100);
    expect(new Set(BASE_WORDS).size).toBe(BASE_WORDS.length);
    for (const base of BASE_WORDS) {
      const p = buildWheel(base, dict);
      expect(p.letters.sort().join('')).toBe([...base].sort().join(''));
      expect(p.answers.length, base).toBeGreaterThanOrEqual(12);
    }
  });

  it('scores words, rejects bad ones and climbs the ranks', () => {
    const g = new WordBuilder(buildWheel('another', dict));
    expect(g.submit('the').result).toBe('short');
    expect(g.submit('zebra').result).toBe('letters');
    expect(g.submit('hoten').result).toBe('unknown');
    expect(g.submit('tone')).toEqual({ result: 'ok', points: 1 });
    expect(g.submit('TONE').result).toBe('repeat');
    expect(g.submit('another')).toEqual({ result: 'ok', points: 14 });
    expect(g.score).toBe(15);
    expect(g.rank).not.toBe('');
    for (const w of g.puzzle.answers) g.submit(w);
    expect(g.rank).toBe('Genius');
    expect(g.nextRank).toBeNull();
  });

  it('the daily wheel is the same for everyone', () => {
    expect(pickBase('daily300')).toBe(pickBase('daily300'));
    const bases = new Set(Array.from({ length: 30 }, (_, i) => pickBase(`daily${i}`)));
    expect(bases.size).toBeGreaterThan(10);
  });
});
