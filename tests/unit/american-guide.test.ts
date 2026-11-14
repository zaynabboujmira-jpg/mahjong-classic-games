import { describe, expect, it } from 'vitest';
import { CATEGORIES, FAQ, HOW_TO, POINT_VALUES } from '../../src/data/american-guide';
import { CARD } from '../../src/engines/mahjong-table/american';

/** Tiles in a written hand: every non-space character is one tile. */
const tiles = (hand: string) => hand.replace(/\s+/g, '').length;

describe('American Mahjong guide', () => {
  it('covers the 9 categories once each', () => {
    expect(CATEGORIES.map((c) => c.name)).toEqual([
      '2026 (Year hands)',
      '2468',
      'Any Like Numbers',
      'Quints',
      'Consecutive Run',
      '13579',
      'Winds & Dragons',
      '369',
      'Singles & Pairs',
    ]);
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(9);
  });

  it('every example hand has exactly 14 tiles', () => {
    for (const c of CATEGORIES) expect(tiles(c.example), c.name).toBe(14);
  });

  it('values sit in the 25-75 range and match the point table', () => {
    const values = new Set(POINT_VALUES.map((p) => p.value));
    for (const c of CATEGORIES) {
      expect(c.value).toBeGreaterThanOrEqual(25);
      expect(c.value).toBeLessThanOrEqual(75);
      expect(values.has(c.value), c.name).toBe(true);
    }
    expect(Math.min(...values)).toBe(25);
    expect(Math.max(...values)).toBe(75);
  });

  it('examples taken from the game card agree with it', () => {
    for (const c of CATEGORIES.filter((x) => x.cardId)) {
      const hand = CARD.find((h) => h.id === c.cardId);
      expect(hand, c.cardId).toBeDefined();
      expect(hand!.value).toBe(c.value);
      expect(hand!.concealed).toBe(c.exposure === 'C');
    }
  });

  it('Singles & Pairs is concealed; how-to and FAQ are filled in', () => {
    expect(CATEGORIES.find((c) => c.id === 'singles-pairs')!.exposure).toBe('C');
    expect(HOW_TO.length).toBeGreaterThanOrEqual(3);
    expect(FAQ.some((f) => /National Mah Jongg League/.test(f.a))).toBe(true);
  });
});
