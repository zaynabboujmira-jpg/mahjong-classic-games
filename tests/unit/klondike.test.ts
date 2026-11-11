import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engines/core/rng';
import { FULL_DECK, cardLabel, type Card } from '../../src/engines/solitaire/cards';
import { Klondike, STOCK, WASTE, foundation, tableau, type KlondikeState } from '../../src/engines/solitaire/klondike';

/** Card by rank and suit letter, e.g. c(12, 'h') = Queen of Hearts. */
const c = (rank: number, suit: 's' | 'h' | 'd' | 'c'): Card => FULL_DECK['shdc'.indexOf(suit) * 13 + rank - 1]!;

const emptyState = (over: Partial<KlondikeState> = {}): KlondikeState => ({
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: Array.from({ length: 7 }, () => ({ cards: [], faceDown: 0 })),
  moves: 0,
  ...over,
});

const withTableau = (cols: { cards: Card[]; faceDown?: number }[], over: Partial<KlondikeState> = {}) =>
  emptyState({
    tableau: Array.from({ length: 7 }, (_, i) => ({ cards: cols[i]?.cards ?? [], faceDown: cols[i]?.faceDown ?? 0 })),
    ...over,
  });

describe('deal', () => {
  const g = new Klondike(createRng('deal'));
  it('deals 1..7 cards with only the top card face up', () => {
    g.state.tableau.forEach((t, i) => {
      expect(t.cards).toHaveLength(i + 1);
      expect(t.faceDown).toBe(i);
    });
  });
  it('puts the remaining 24 cards in the stock and uses all 52 once', () => {
    expect(g.state.stock).toHaveLength(24);
    const ids = [...g.state.stock, ...g.state.tableau.flatMap((t) => t.cards)].map((x) => x.id).sort((a, b) => a - b);
    expect(ids).toEqual(FULL_DECK.map((x) => x.id));
  });
  it('is reproducible from a seed', () => {
    const a = new Klondike(createRng('same')).state.stock.map((x) => x.id);
    const b = new Klondike(createRng('same')).state.stock.map((x) => x.id);
    expect(a).toEqual(b);
  });
  it('labels cards for screen readers', () => {
    expect(cardLabel(c(12, 'h'))).toBe('Queen of Hearts');
    expect(cardLabel(c(1, 's'))).toBe('Ace of Spades');
  });
});

describe('stock and waste', () => {
  it('draw 1 turns one card; draw 3 turns three', () => {
    const one = new Klondike(createRng('s'), 1);
    one.draw();
    expect(one.state.waste).toHaveLength(1);
    const three = new Klondike(createRng('s'), 3);
    three.draw();
    expect(three.state.waste).toHaveLength(3);
    expect(three.state.stock).toHaveLength(21);
  });
  it('recycles the waste in the original order when the stock runs out', () => {
    const g = new Klondike(createRng('r'), 3);
    const firstPass: number[] = [];
    for (let k = 0; k < 8; k++) {
      g.draw();
      firstPass.push(...g.state.waste.slice(-3).map((x) => x.id));
    }
    expect(g.state.stock).toHaveLength(0);
    g.draw(); // recycle
    expect(g.state.stock).toHaveLength(24);
    expect(g.state.waste).toHaveLength(0);
    g.draw();
    expect(g.state.waste.map((x) => x.id)).toEqual(firstPass.slice(0, 3));
  });
  it('cannot draw from an empty stock and waste', () => {
    expect(Klondike.fromState(emptyState()).draw()).toBeNull();
  });
  it('only the top waste card can be picked up', () => {
    const g = Klondike.fromState(emptyState({ waste: [c(5, 's'), c(9, 'h')] }));
    expect(g.pickUp(WASTE, 0)).toBeNull();
    expect(g.pickUp(WASTE, 1)).toEqual([c(9, 'h')]);
    expect(g.pickUp(STOCK, 0)).toBeNull();
  });
});

describe('tableau rules', () => {
  it('builds down in alternating colours', () => {
    const g = Klondike.fromState(withTableau([{ cards: [c(8, 's')] }, { cards: [c(7, 'h')] }, { cards: [c(7, 'c')] }]));
    expect(g.canMove(tableau(1), 0, tableau(0))).toBe(true); // red 7 on black 8
    expect(g.canMove(tableau(2), 0, tableau(0))).toBe(false); // black 7 on black 8
  });
  it('only accepts a King on an empty column', () => {
    const g = Klondike.fromState(withTableau([{ cards: [c(13, 'd')] }, { cards: [c(12, 's')] }, { cards: [] }]));
    expect(g.canMove(tableau(0), 0, tableau(2))).toBe(true);
    expect(g.canMove(tableau(1), 0, tableau(2))).toBe(false);
  });
  it('moves whole face-up runs and turns over the exposed card', () => {
    const g = Klondike.fromState(
      withTableau([{ cards: [c(2, 'c'), c(9, 'd'), c(8, 's')], faceDown: 1 }, { cards: [c(10, 'c')] }]),
    );
    expect(g.pickUp(tableau(0), 0)).toBeNull(); // face down
    expect(g.move(tableau(0), 1, tableau(1))).toBe(true);
    expect(g.state.tableau[1]!.cards).toEqual([c(10, 'c'), c(9, 'd'), c(8, 's')]);
    expect(g.state.tableau[0]).toEqual({ cards: [c(2, 'c')], faceDown: 0 });
  });
  it('refuses runs that are not in sequence', () => {
    const g = Klondike.fromState(withTableau([{ cards: [c(9, 'd'), c(4, 's')] }, { cards: [c(10, 'c')] }]));
    expect(g.pickUp(tableau(0), 0)).toBeNull();
  });
});

describe('foundations', () => {
  it('start with an Ace and build up by suit', () => {
    const g = Klondike.fromState(withTableau([{ cards: [c(1, 'h')] }, { cards: [c(2, 'h')] }, { cards: [c(2, 's')] }]));
    expect(g.canMove(tableau(1), 0, foundation(0))).toBe(false);
    expect(g.move(tableau(0), 0, foundation(0))).toBe(true);
    expect(g.canMove(tableau(2), 0, foundation(0))).toBe(false);
    expect(g.move(tableau(1), 0, foundation(0))).toBe(true);
  });
  it('accepts single cards only, and a foundation card can come back down', () => {
    const g = Klondike.fromState(
      withTableau([{ cards: [c(3, 's'), c(2, 'h')] }, { cards: [c(3, 'c')] }], { foundations: [[c(1, 'h')], [], [], []] }),
    );
    expect(g.canMove(tableau(0), 0, foundation(0))).toBe(false);
    expect(g.move(tableau(0), 1, foundation(0))).toBe(true);
    expect(g.move(foundation(0), 1, tableau(1))).toBe(true);
  });
});

describe('helpers', () => {
  it('bestTarget prefers a foundation, then a non-empty column', () => {
    const g = Klondike.fromState(
      withTableau([{ cards: [c(1, 'd')] }, { cards: [c(9, 'h')] }, { cards: [] }, { cards: [c(9, 's')] }], {
        waste: [c(8, 'c')],
      }),
    );
    expect(g.bestTarget(tableau(0), 0)).toEqual(foundation(0));
    expect(g.bestTarget(WASTE, 0)).toEqual(tableau(1));
  });
  it('bestTarget does not shuffle a column-heading King between empty columns', () => {
    const g = Klondike.fromState(withTableau([{ cards: [c(13, 's')] }, { cards: [] }]));
    expect(g.bestTarget(tableau(0), 0)).toBeNull();
  });
  it('hint suggests foundation moves first, then drawing', () => {
    const g = Klondike.fromState(withTableau([{ cards: [c(1, 'c')] }], { stock: [c(5, 'h')] }));
    expect(g.hint()).toEqual({ kind: 'move', from: tableau(0), index: 0, to: foundation(0) });
    g.move(tableau(0), 0, foundation(0));
    expect(g.hint()).toEqual({ kind: 'draw' });
  });
  it('undo restores every kind of move', () => {
    const g = new Klondike(createRng('u'));
    const start = JSON.stringify(g.state);
    g.draw();
    const h = g.hint();
    if (h?.kind === 'move') g.move(h.from, h.index, h.to);
    while (g.undo());
    expect(JSON.stringify(g.state)).toBe(start);
    expect(g.canUndo).toBe(false);
  });
});

describe('winning', () => {
  it('auto-finishes an all-face-up position to a win', () => {
    // Two columns holding every card in alternating-colour runs, King to Ace.
    const runA: Card[] = [];
    const runB: Card[] = [];
    for (let r = 13; r >= 1; r--) {
      runA.push(r % 2 ? c(r, 's') : c(r, 'h'));
      runB.push(r % 2 ? c(r, 'd') : c(r, 'c'));
    }
    const runC: Card[] = [];
    const runD: Card[] = [];
    for (let r = 13; r >= 1; r--) {
      runC.push(r % 2 ? c(r, 'h') : c(r, 's'));
      runD.push(r % 2 ? c(r, 'c') : c(r, 'd'));
    }
    const g = Klondike.fromState(withTableau([{ cards: runA }, { cards: runB }, { cards: runC }, { cards: runD }]));
    expect(g.canAutoFinish).toBe(true);
    let guard = 0;
    while (g.autoFinishStep() && guard++ < 60);
    expect(g.isWon).toBe(true);
    expect(g.state.foundations.every((f) => f.length === 13)).toBe(true);
  });

  it('following hints never breaks the rules over many random deals', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const mode of [1, 3] as const) {
        const g = new Klondike(createRng(seed), mode);
        let draws = 0;
        for (let step = 0; step < 400 && !g.isWon; step++) {
          const h = g.hint();
          if (!h) break;
          if (h.kind === 'draw') {
            if (++draws > 80) break; // cycling through the stock without progress
            g.draw();
          } else {
            draws = 0;
            expect(g.move(h.from, h.index, h.to)).toBe(true);
          }
          const all = [...g.state.stock, ...g.state.waste, ...g.state.foundations.flat(), ...g.state.tableau.flatMap((t) => t.cards)];
          expect(all).toHaveLength(52);
        }
      }
    }
  });
});
