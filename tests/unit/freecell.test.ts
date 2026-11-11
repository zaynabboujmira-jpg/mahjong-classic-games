import { describe, expect, it } from 'vitest';
import { FULL_DECK, RANK_LABELS, type Card } from '../../src/engines/solitaire/cards';
import { FreeCell, msDeal } from '../../src/engines/solitaire/freecell';
import { cell, foundation, tableau } from '../../src/engines/solitaire/table';

const c = (rank: number, suit: 's' | 'h' | 'd' | 'c'): Card => FULL_DECK['shdc'.indexOf(suit) * 13 + rank - 1]!;
/** Microsoft-style short name: "JD", "TC", "AS". */
const short = (x: Card) => `${x.rank === 10 ? 'T' : RANK_LABELS[x.rank]}${'SHDC'[x.suit]}`;
const row = (cascades: Card[][], r: number) => cascades.map((col) => col[r]).filter(Boolean).map((x) => short(x!)).join(' ');

describe('Microsoft deal numbers', () => {
  it('reproduces game #1', () => {
    const d = msDeal(1);
    expect(row(d, 0)).toBe('JD 2D 9H JC 5D 7H 7C 5H');
    expect(row(d, 1)).toBe('KD KC 9S 5S AD QC KH 3H');
    expect(row(d, 6)).toBe('6S 9C 2H 6H');
  });

  it('reproduces game #617', () => {
    const d = msDeal(617);
    expect(row(d, 0)).toBe('7D AD 5C 3S 5S 8C 2D AH');
    expect(row(d, 1)).toBe('TD 7S QD AC 6D 8H AS KH');
  });

  it('deals 7,7,7,7,6,6,6,6 using every card once', () => {
    for (const n of [1, 2, 11982, 32000, 999999]) {
      const d = msDeal(n);
      expect(d.map((col) => col.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
      expect(new Set(d.flat().map((x) => x.id)).size).toBe(52);
    }
  });
});

describe('rules', () => {
  it('free cells hold one card each', () => {
    const g = FreeCell.fromPosition([[c(9, 's')], [c(4, 'h')]]);
    expect(g.move(tableau(0), 0, cell(0))).toBe(true);
    expect(g.canMove(tableau(1), 0, cell(0))).toBe(false);
    expect(g.canMove(tableau(1), 0, cell(1))).toBe(true);
  });

  it('cascades build down in alternating colours; empty cascades take any card', () => {
    const g = FreeCell.fromPosition([[c(9, 's')], [c(8, 'h')], [c(8, 'c')], []]);
    expect(g.canMove(tableau(1), 0, tableau(0))).toBe(true);
    expect(g.canMove(tableau(2), 0, tableau(0))).toBe(false);
    expect(g.canMove(tableau(2), 0, tableau(3))).toBe(true);
  });

  it('limits run moves to (free cells + 1) x 2^(empty cascades)', () => {
    const fiveRun = [c(9, 'h'), c(8, 's'), c(7, 'h'), c(6, 's'), c(5, 'h')];
    const fill = [c(1, 'c'), c(1, 'd'), c(1, 's'), c(1, 'h')].map((x) => [c(13, 'd'), x]);
    // 4 free cells, 0 empty cascades: up to 5 cards.
    let g = FreeCell.fromPosition([fiveRun, [c(10, 's')], [c(13, 'c')], [c(12, 'c')], ...fill]);
    expect(g.maxRun(false)).toBe(5);
    expect(g.canMove(tableau(0), 0, tableau(1))).toBe(true);
    // 2 free cells: only 3 cards.
    g = FreeCell.fromPosition([fiveRun, [c(10, 's')], [c(13, 'c')], [c(12, 'c')], ...fill], [c(2, 'c'), c(2, 'd'), null, null]);
    expect(g.maxRun(false)).toBe(3);
    expect(g.canMove(tableau(0), 0, tableau(1))).toBe(false);
    expect(g.canMove(tableau(0), 2, tableau(1))).toBe(false); // 7H does not fit on 10S
    // An empty destination cascade does not count towards the limit.
    g = FreeCell.fromPosition([fiveRun, [], [c(13, 'c')], [c(12, 'c')], ...fill], [c(2, 'c'), c(2, 'd'), c(2, 'h'), null]);
    expect(g.maxRun(true)).toBe(2);
    expect(g.canMove(tableau(0), 3, tableau(1))).toBe(true);
    expect(g.canMove(tableau(0), 2, tableau(1))).toBe(false);
  });

  it('refuses runs that are not in sequence', () => {
    const g = FreeCell.fromPosition([[c(9, 'h'), c(4, 's')], [c(10, 's')]]);
    expect(g.pickUp(tableau(0), 0)).toBeNull();
  });

  it('auto-plays safe cards: Aces and 2s always, higher cards once both opposite-colour foundations are close', () => {
    const g = FreeCell.fromPosition([[c(9, 'd'), c(1, 'h')], [c(13, 's'), c(2, 'h')], [c(13, 'c'), c(3, 'h')], [c(12, 'd')]]);
    // Moving anything triggers auto-play: A♥ and 2♥ go up, 3♥ stays because no black 2 is up yet.
    g.move(tableau(3), 0, cell(0));
    expect(g.cardsIn(foundation(0)).map((x) => x.rank)).toEqual([1, 2]);
    expect(g.cardsIn(tableau(2)).at(-1)).toEqual(c(3, 'h'));
  });
});

describe('finishing and stuck detection', () => {
  it('auto-finishes ordered cascades to a win', () => {
    const cols: Card[][] = [];
    for (const s of ['s', 'h', 'd', 'c'] as const) {
      cols.push([...Array.from({ length: 7 }, (_, i) => c(13 - i, s))]);
      cols.push([...Array.from({ length: 6 }, (_, i) => c(6 - i, s))]);
    }
    const g = FreeCell.fromPosition(cols);
    expect(g.canAutoFinish).toBe(true);
    let guard = 0;
    while (g.autoFinishStep() && guard++ < 60);
    expect(g.isWon).toBe(true);
  });

  it('detects a position with no legal moves', () => {
    const g = FreeCell.fromPosition(
      [[c(5, 'c')], [c(5, 's')], [c(7, 'c')], [c(7, 's')], [c(9, 'c')], [c(9, 's')], [c(11, 'c')], [c(11, 's')]],
      [c(13, 'c'), c(13, 's'), c(13, 'h'), c(13, 'd')],
    );
    expect(g.legalMoves()).toEqual([]);
    expect(g.isStuck).toBe(true);
    expect(g.hint()).toBeNull();
  });

  it('following hints wins at least 18 of deals 1-20 (the hint is backed by a solver)', () => {
    let wins = 0;
    for (let deal = 1; deal <= 20; deal++) {
      const g = new FreeCell(deal);
      for (let step = 0; step < 400 && !g.isWon; step++) {
        const h = g.hint();
        if (!h || h.kind !== 'move') break;
        expect(g.move(h.from, h.index, h.to)).toBe(true);
      }
      if (g.isWon) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(18);
  });

  it('following hints on deals 1-60 never breaks a rule or loses a card, and undo returns to the deal', () => {
    for (let deal = 1; deal <= 60; deal++) {
      const g = new FreeCell(deal);
      const start = JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7].map((i) => g.cardsIn(tableau(i))));
      const seen = new Set<string>();
      for (let step = 0; step < 300 && !g.isWon; step++) {
        if (g.canAutoFinish) {
          while (g.autoFinishStep());
          break;
        }
        const h = g.hint();
        if (!h || h.kind !== 'move') break;
        expect(g.move(h.from, h.index, h.to)).toBe(true);
        const key = JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7].map((i) => g.cardsIn(tableau(i)).map((x) => x.id)));
        if (seen.has(key)) break; // greedy hints went in a circle; fine for a hint, not a solver
        seen.add(key);
        const total = [0, 1, 2, 3].reduce((n, i) => n + g.cardsIn(cell(i)).length + g.cardsIn(foundation(i)).length, 0) +
          [0, 1, 2, 3, 4, 5, 6, 7].reduce((n, i) => n + g.cardsIn(tableau(i)).length, 0);
        expect(total).toBe(52);
      }
      while (g.undo());
      expect(JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7].map((i) => g.cardsIn(tableau(i))))).toBe(start);
    }
  });
});
