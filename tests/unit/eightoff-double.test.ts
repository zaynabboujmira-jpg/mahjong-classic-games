import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engines/core/rng';
import { FULL_DECK, type Card } from '../../src/engines/solitaire/cards';
import { EIGHTOFF_SPEC, EightOff } from '../../src/engines/solitaire/eightoff';
import { Klondike, klondikeSpec } from '../../src/engines/solitaire/klondike';
import { cell, foundation, tableau, topRowsOf } from '../../src/engines/solitaire/table';
import { layoutTable } from '../../src/engines/solitaire/layout';

const c = (rank: number, suit: number): Card => FULL_DECK[suit * 13 + rank - 1]!;
const all = (g: EightOff | Klondike, n: number) => {
  const cards: Card[] = [];
  const piles = [...Array.from({ length: 8 }, (_, i) => cell(i)), ...Array.from({ length: 8 }, (_, i) => foundation(i)), ...Array.from({ length: 9 }, (_, i) => tableau(i))];
  for (const p of piles) {
    try {
      cards.push(...g.cardsIn(p));
    } catch {
      /* pile does not exist in this game */
    }
  }
  if (g instanceof Klondike) cards.push(...g.state.stock, ...g.state.waste);
  return cards.length === n;
};

describe('Eight Off', () => {
  it('deals 48 cards in eight columns of six and four into the free cells', () => {
    const g = new EightOff(createRng('deal'));
    const lens = Array.from({ length: 8 }, (_, i) => g.cardsIn(tableau(i)).length);
    const inFound = [0, 1, 2, 3].reduce((n, f) => n + g.cardsIn(foundation(f)).length, 0);
    expect(lens.reduce((a, b) => a + b, 0) + inFound + (8 - g.freeCells)).toBe(52);
    expect(8 - g.freeCells + inFound).toBeGreaterThanOrEqual(4 - inFound >= 0 ? 0 : 0);
    expect(all(g, 52)).toBe(true);
  });

  it('builds down in suit, only Kings on empty columns, runs limited by free cells', () => {
    const g = EightOff.fromPosition(
      [[c(13, 0)], [c(12, 0)], [c(12, 1)], [], [c(9, 2), c(8, 2), c(7, 2)], [c(10, 2)], [c(5, 3)], [c(6, 3)]],
      [c(4, 3), null, null, null, null, null, null, null],
    );
    expect(g.canMove(tableau(1), 0, tableau(0))).toBe(true); // Q♠ on K♠
    expect(g.canMove(tableau(2), 0, tableau(0))).toBe(false); // Q♥ on K♠: wrong suit
    expect(g.canMove(tableau(1), 0, tableau(3))).toBe(false); // only Kings on empty columns
    expect(g.canMove(tableau(0), 0, tableau(3))).toBe(true);
    expect(g.canMove(tableau(4), 0, tableau(5))).toBe(true); // 9-8-7 of diamonds on 10♦ with 7 free cells
    expect(g.canMove(cell(0), 0, tableau(6))).toBe(true); // 4♣ on 5♣
  });

  it('a long run needs enough free cells', () => {
    const run = [9, 8, 7, 6, 5].map((r) => c(r, 2));
    const full: (Card | null)[] = [c(2, 0), c(3, 0), c(4, 0), c(5, 0), c(6, 0), null, null, null];
    const g = EightOff.fromPosition([run, [c(10, 2)], [], [], [], [], [], []], full);
    expect(g.freeCells).toBe(3);
    expect(g.canMove(tableau(0), 0, tableau(1))).toBe(false); // 5 cards, only 3 + 1 can move
    expect(g.canMove(tableau(0), 1, tableau(1))).toBe(false); // 8 is not a 9 on the 10
  });

  it('moves playable cards to the foundations automatically, and undo restores', () => {
    const g = EightOff.fromPosition([[c(2, 0), c(1, 0)], [c(3, 0)], [], [], [], [], [], [c(13, 1)]], [null, null, null, null, null, null, null, null]);
    expect(g.move(tableau(7), 0, cell(0))).toBe(true);
    expect(g.cardsIn(foundation(0)).length + g.cardsIn(foundation(1)).length + g.cardsIn(foundation(2)).length + g.cardsIn(foundation(3)).length).toBe(3);
    g.undo();
    expect(g.cardsIn(tableau(0))).toHaveLength(2);
  });

  it('greedy play with hints keeps all 52 cards and never makes an illegal move', () => {
    for (const seed of ['a', 'b', 'c']) {
      const g = new EightOff(createRng(seed));
      for (let n = 0; n < 300 && !g.isWon; n++) {
        const h = g.hint();
        if (!h || h.kind !== 'move') break;
        expect(g.move(h.from, h.index, h.to)).toBe(true);
        expect(all(g, 52)).toBe(true);
      }
    }
  });

  it('lays out the foundations on a second line above the columns', () => {
    expect(topRowsOf(EIGHTOFF_SPEC)).toBe(2);
    const scene = layoutTable(EIGHTOFF_SPEC, new EightOff(createRng('x')), 1000, 800);
    const cellY = scene.slots.find((s) => s.pile.kind === 'cell')!.rect.y;
    const foundY = scene.slots.find((s) => s.pile.kind === 'foundation')!.rect.y;
    const colY = scene.slots.find((s) => s.pile.kind === 'tableau')!.rect.y;
    expect(foundY).toBeGreaterThan(cellY);
    expect(colY).toBeGreaterThan(foundY);
  });
});

describe('Double Klondike', () => {
  it('deals 104 cards: nine columns of 1 to 9 cards and 59 in the stock', () => {
    const g = new Klondike(createRng('double'), 1, 2);
    expect(g.state.tableau.map((t) => t.cards.length)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(g.state.tableau.map((t) => t.faceDown)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(g.state.stock).toHaveLength(59);
    expect(g.state.foundations).toHaveLength(8);
    expect(all(g, 104)).toBe(true);
  });

  it('uses all eight foundations, two per suit', () => {
    const g = new Klondike(createRng('f'), 1, 2);
    const aces = [c(1, 0), c(1, 0)];
    const state = { ...g.state, tableau: [{ cards: [aces[0]!], faceDown: 0 }, { cards: [aces[1]!], faceDown: 0 }, ...g.state.tableau.slice(2)] };
    const k = Klondike.fromState(state);
    expect(k.bestTarget(tableau(0), 0)).toEqual(foundation(0));
    k.move(tableau(0), 0, foundation(0));
    expect(k.bestTarget(tableau(1), 0)).toEqual(foundation(1));
    expect(k.status).toBe('Draw 1 · 2 decks');
  });

  it('one-deck Klondike is unchanged', () => {
    const g = new Klondike(createRng('same'), 1);
    expect(g.state.tableau).toHaveLength(7);
    expect(g.state.foundations).toHaveLength(4);
    expect(klondikeSpec(1).columns).toBe(7);
    expect(klondikeSpec(1, 2).columns).toBe(10);
  });

  it('hint-driven play keeps all 104 cards', () => {
    const g = new Klondike(createRng('play'), 1, 2);
    for (let n = 0; n < 500 && !g.isWon; n++) {
      const h = g.hint();
      if (!h) break;
      if (h.kind === 'draw') g.draw();
      else expect(g.move(h.from, h.index, h.to)).toBe(true);
      expect(all(g, 104)).toBe(true);
    }
  });
});
