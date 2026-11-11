import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engines/core/rng';
import { FULL_DECK } from '../../src/engines/solitaire/cards';
import { Klondike, foundation, tableau, type KlondikeState } from '../../src/engines/solitaire/klondike';
import { MAX_CARD_W, dropTarget, hitTest, layoutScene, metricsFor } from '../../src/engines/solitaire/layout';

const dealt = new Klondike(createRng('layout')).state;

describe('metricsFor', () => {
  for (const [w, h] of [[320, 480], [375, 600], [393, 700], [412, 760], [768, 900], [1440, 800]] as const) {
    it(`fits seven columns in ${w}px without horizontal overflow`, () => {
      const m = metricsFor(w, h);
      expect(m.colX[6]! + m.cardW + m.gap).toBeLessThanOrEqual(w + 0.01);
      expect(m.colX[0]! - m.gap).toBeGreaterThanOrEqual(-0.01);
    });
  }
  it('keeps cards at least 44px wide on a 375px phone', () => {
    expect(metricsFor(375, 600).cardW).toBeGreaterThanOrEqual(44);
  });
  it('caps card size on large screens', () => {
    expect(metricsFor(2560, 1400).cardW).toBeLessThanOrEqual(MAX_CARD_W);
  });
});

describe('layoutScene', () => {
  it('places all 52 cards of a fresh deal', () => {
    const s = layoutScene(dealt, 375, 600, 1);
    expect(s.cards).toHaveLength(52);
    expect(s.cards.filter((c) => c.faceUp)).toHaveLength(7);
  });

  it('compresses a very long column so it still fits the viewport', () => {
    // Column 0: six face-down cards then a 13-card run King to Ace (worst case: 19 cards).
    const run = Array.from({ length: 13 }, (_, i) => FULL_DECK[(i % 2) * 13 + (12 - i)]!);
    const filler = FULL_DECK.slice(40, 46);
    const state: KlondikeState = {
      stock: [],
      waste: [],
      foundations: [[], [], [], []],
      tableau: Array.from({ length: 7 }, (_, i) => (i === 0 ? { cards: [...filler, ...run], faceDown: 6 } : { cards: [], faceDown: 0 })),
      moves: 0,
    };
    const s = layoutScene(state, 375, 620, 1);
    expect(s.height).toBeLessThanOrEqual(620);
    // Face-up cards still overlap by less than their index strip, so ranks stay visible.
    const ups = s.cards.filter((c) => c.faceUp && c.pile.kind === 'tableau');
    expect(ups[1]!.rect.y - ups[0]!.rect.y).toBeGreaterThanOrEqual(s.metrics.cardH * 0.17 - 0.01);
  });

  it('fans the top three waste cards in Draw 3', () => {
    const g = new Klondike(createRng('w'), 3);
    g.draw();
    const s = layoutScene(g.state, 800, 700, 3);
    const waste = s.cards.filter((c) => c.pile.kind === 'waste');
    expect(new Set(waste.map((c) => c.rect.x)).size).toBe(3);
  });
});

describe('hit testing', () => {
  const s = layoutScene(dealt, 800, 700, 1);
  it('finds the top card of a column', () => {
    const top = s.cards.filter((c) => c.pile.kind === 'tableau' && c.pile.index === 6).pop()!;
    expect(hitTest(s, top.rect.x + 5, top.rect.y + top.rect.h - 5)).toEqual({ pile: tableau(6), index: 6 });
  });
  it('reports empty foundation slots', () => {
    const slot = s.slots.find((x) => x.pile.kind === 'foundation' && x.pile.index === 2)!;
    expect(hitTest(s, slot.rect.x + 5, slot.rect.y + 5)).toEqual({ pile: foundation(2), index: -1 });
  });
  it('maps drops to foundations and to whole tableau columns', () => {
    const slot = s.slots.find((x) => x.pile.kind === 'foundation' && x.pile.index === 0)!;
    expect(dropTarget(s, slot.rect.x + 10, slot.rect.y + 10)).toEqual(foundation(0));
    const col = s.metrics.colX[4]!;
    expect(dropTarget(s, col + 10, 650)).toEqual(tableau(4));
  });
});
