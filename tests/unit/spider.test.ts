import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engines/core/rng';
import { FULL_DECK, type Card } from '../../src/engines/solitaire/cards';
import { Spider, spiderDeck, type SuitCount } from '../../src/engines/solitaire/spider';
import { tableau } from '../../src/engines/solitaire/table';

const c = (rank: number, suit: 's' | 'h' | 'd' | 'c'): Card => FULL_DECK['shdc'.indexOf(suit) * 13 + rank - 1]!;
const run = (from: number, to: number, suit: 's' | 'h' | 'd' | 'c') => {
  const out: Card[] = [];
  for (let r = from; r >= to; r--) out.push(c(r, suit));
  return out;
};
const allCards = (g: Spider) => {
  let n = g.cardsIn({ kind: 'stock', index: 0 }).length;
  for (let i = 0; i < 10; i++) n += g.cardsIn(tableau(i)).length;
  for (let f = 0; f < 8; f++) n += g.cardsIn({ kind: 'foundation', index: f }).length;
  return n;
};

describe('deck and deal', () => {
  it.each([1, 2, 4] as SuitCount[])('%i-suit deck has 104 cards, 8 of each rank, spread over the right suits', (suits) => {
    const deck = spiderDeck(suits);
    expect(deck).toHaveLength(104);
    expect(new Set(deck.map((x) => x.suit)).size).toBe(suits);
    for (let r = 1; r <= 13; r++) expect(deck.filter((x) => x.rank === r)).toHaveLength(8);
  });

  it('deals 6,6,6,6,5,5,5,5,5,5 with the top card face up and 50 in the stock', () => {
    const g = new Spider(createRng('deal'), 2);
    for (let i = 0; i < 10; i++) {
      const n = i < 4 ? 6 : 5;
      expect(g.cardsIn(tableau(i))).toHaveLength(n);
      expect(g.faceDownIn(tableau(i))).toBe(n - 1);
    }
    expect(g.cardsIn({ kind: 'stock', index: 0 })).toHaveLength(50);
    expect(g.stockDeals).toBe(5);
  });
});

describe('moves', () => {
  it('moves only same-suit descending runs, onto any card one rank higher', () => {
    const g = Spider.fromColumns([
      { cards: [c(9, 'h'), c(8, 'h'), c(7, 'h')] },
      { cards: [c(10, 's')] },
      { cards: [c(9, 's'), c(8, 'h')] },
    ]);
    expect(g.pickUp(tableau(0), 0)).toHaveLength(3);
    expect(g.canMove(tableau(0), 0, tableau(1))).toBe(true); // hearts run on a spade 10
    expect(g.pickUp(tableau(2), 0)).toBeNull(); // mixed suits cannot move together
    expect(g.pickUp(tableau(2), 1)).toHaveLength(1);
  });

  it('accepts any card or run on an empty column', () => {
    const g = Spider.fromColumns([{ cards: [c(5, 'd'), c(4, 'd')] }, { cards: [] }]);
    expect(g.canMove(tableau(0), 0, tableau(1))).toBe(true);
  });

  it('turns over the card left behind', () => {
    const g = Spider.fromColumns([{ cards: [c(2, 'c'), c(6, 'h')], faceDown: 1 }, { cards: [c(7, 's')] }]);
    expect(g.move(tableau(0), 1, tableau(1))).toBe(true);
    expect(g.faceDownIn(tableau(0))).toBe(0);
  });

  it('clears a completed King-to-Ace run automatically and counts towards the win', () => {
    const g = Spider.fromColumns([{ cards: [c(5, 'c'), ...run(13, 2, 's')], faceDown: 1 }, { cards: [c(1, 's')] }]);
    expect(g.move(tableau(1), 0, tableau(0))).toBe(true);
    expect(g.completed).toBe(1);
    expect(g.cardsIn(tableau(0))).toEqual([c(5, 'c')]);
    expect(g.faceDownIn(tableau(0))).toBe(0);
    expect(g.cardsIn({ kind: 'foundation', index: 0 }).at(-1)).toEqual(c(13, 's'));
  });

  it('does not clear a run of mixed suits', () => {
    const g = Spider.fromColumns([{ cards: [...run(13, 2, 's')] }, { cards: [c(1, 'h')] }]);
    g.move(tableau(1), 0, tableau(0));
    expect(g.completed).toBe(0);
  });

  it('undo restores moves, deals and cleared runs', () => {
    const g = Spider.fromColumns([{ cards: [...run(13, 2, 's')] }, { cards: [c(1, 's')] }, ...Array.from({ length: 8 }, () => ({ cards: [c(3, 'h')] }))]);
    g.move(tableau(1), 0, tableau(0));
    expect(g.completed).toBe(1);
    g.undo();
    expect(g.completed).toBe(0);
    expect(g.cardsIn(tableau(0))).toHaveLength(12);
  });
});

describe('dealing from the stock', () => {
  it('deals one card to each column', () => {
    const g = new Spider(createRng('d'), 1);
    expect(g.draw()).toMatch(/Dealt/);
    for (let i = 0; i < 10; i++) expect(g.cardsIn(tableau(i))).toHaveLength((i < 4 ? 6 : 5) + 1);
    expect(g.stockDeals).toBe(4);
  });

  it('refuses to deal while a column is empty, and explains why', () => {
    const g = Spider.fromColumns([{ cards: [c(5, 'h')] }], spiderDeck(4).slice(0, 10));
    expect(g.drawBlockedReason()).toMatch(/empty column/);
    expect(g.draw()).toBeNull();
  });

  it('refuses to deal from an empty stock', () => {
    const g = Spider.fromColumns(Array.from({ length: 10 }, () => ({ cards: [c(5, 'h')] })));
    expect(g.draw()).toBeNull();
    expect(g.drawBlockedReason()).toMatch(/No deals left/);
  });
});

describe('hints and stuck detection', () => {
  it('prefers building a same-suit run', () => {
    const g = Spider.fromColumns(
      [{ cards: [c(3, 'c'), c(8, 'd')] }, { cards: [c(9, 's')] }, { cards: [c(9, 'd')] }, ...Array.from({ length: 7 }, () => ({ cards: [c(1, 'c')] }))],
      spiderDeck(4).slice(0, 10),
    );
    // 9 of Spades would also take the 8, but the same-suit 9 of Diamonds is better.
    expect(g.hint()).toEqual({ kind: 'move', from: tableau(0), index: 1, to: tableau(2) });
  });

  it('suggests dealing when nothing productive is left, then reports stuck when the stock is empty', () => {
    const tens = Array.from({ length: 10 }, () => ({ cards: [c(10, 'h')] }));
    expect(Spider.fromColumns(tens, spiderDeck(1).slice(0, 10)).hint()).toEqual({ kind: 'draw' });
    const g = Spider.fromColumns(tens);
    expect(g.hint()).toBeNull();
    expect(g.isStuck).toBe(true);
  });

  it.each([1, 2, 4] as SuitCount[])('following hints in %i-suit games never breaks a rule, loses a card or goes in circles', (suits) => {
    for (let seed = 0; seed < 40; seed++) {
      const g = new Spider(createRng(`spider-${suits}-${seed}`), suits);
      const seen = new Map<string, number>();
      for (let step = 0; step < 1500 && !g.isWon; step++) {
        const h = g.hint();
        if (!h) break;
        if (h.kind === 'draw') expect(g.draw()).not.toBeNull();
        else expect(g.move(h.from, h.index, h.to)).toBe(true);
        expect(allCards(g)).toBe(104);
        const key = JSON.stringify(Array.from({ length: 10 }, (_, k) => [g.faceDownIn(tableau(k)), g.cardsIn(tableau(k)).map((x) => x.id)])) + g.stockDeals;
        const n = (seen.get(key) ?? 0) + 1;
        seen.set(key, n);
        expect(n, `hint loop in seed ${seed}`).toBeLessThan(3);
      }
    }
  });

  it('only reports stuck when no deal and no legal move remain', () => {
    // Hints have nothing useful here, but the 5 can still legally move onto the 6.
    const g = Spider.fromColumns([{ cards: [c(6, 'h'), c(5, 'h')] }, { cards: [c(6, 's')] }, ...Array.from({ length: 8 }, () => ({ cards: [c(10, 'c')] }))]);
    expect(g.canMove(tableau(0), 1, tableau(1))).toBe(true);
    expect(g.isStuck).toBe(false);
  });

  it('a 1-suit game can be won by following hints (sanity check of clearing and the win state)', () => {
    let wins = 0;
    for (let seed = 0; seed < 100 && wins === 0; seed++) {
      const g = new Spider(createRng(`win-${seed}`), 1);
      for (let step = 0; step < 1500 && !g.isWon; step++) {
        const h = g.hint();
        if (!h) break;
        if (h.kind === 'draw') g.draw();
        else g.move(h.from, h.index, h.to);
      }
      if (g.isWon) {
        wins++;
        expect(g.completed).toBe(8);
      }
    }
    expect(wins).toBeGreaterThan(0);
  });
});
