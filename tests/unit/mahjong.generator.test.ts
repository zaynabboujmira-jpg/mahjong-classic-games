import { describe, expect, it } from 'vitest';
import { createRng } from '@engines/core/rng';
import { isFree, presentTiles } from '@engines/mahjong/board';
import { generateDeal } from '@engines/mahjong/generator';
import { LAYOUTS } from '@engines/mahjong/layouts';
import { matches } from '@engines/mahjong/tiles';
import type { Deal } from '@engines/mahjong/generator';

function replaySolution(deal: Deal): boolean {
  const tiles = deal.tiles.map((t) => ({ ...t, removed: false }));
  for (const [a, b] of deal.solution) {
    const present = presentTiles(tiles);
    const ta = tiles[a];
    const tb = tiles[b];
    if (ta.removed || tb.removed) return false;
    if (!matches(ta.face, tb.face)) return false;
    if (!isFree(ta, present) || !isFree(tb, present)) return false;
    ta.removed = true;
    tb.removed = true;
  }
  return presentTiles(tiles).length === 0;
}

describe('layouts', () => {
  it('turtle has 144 tiles over 5 layers', () => {
    expect(LAYOUTS.turtle.layout.slots).toHaveLength(144);
    expect(LAYOUTS.turtle.layout.layers).toBe(5);
  });
  it('every layout has an even tile count and no floating tiles', () => {
    for (const { layout } of Object.values(LAYOUTS)) {
      expect(layout.slots.length % 2).toBe(0);
      for (const s of layout.slots) {
        if (s.z === 0) continue;
        const below = layout.slots.some((o) => o.z === s.z - 1 && Math.abs(o.x - s.x) < 2 && Math.abs(o.y - s.y) < 2);
        expect(below, `slot ${s.x},${s.y},${s.z} in ${layout.slug} floats`).toBe(true);
      }
    }
  });
});

describe('generateDeal', () => {
  for (const slug of Object.keys(LAYOUTS)) {
    it(`${slug}: produces a solvable deal whose recorded solution replays`, () => {
      const deal = generateDeal(LAYOUTS[slug].layout, createRng(`test:${slug}`));
      expect(deal.tiles).toHaveLength(LAYOUTS[slug].layout.slots.length);
      expect(deal.solution).toHaveLength(deal.tiles.length / 2);
      expect(replaySolution(deal)).toBe(true);
    });
  }

  it('is deterministic for the same seed and different for another', () => {
    const a = generateDeal(LAYOUTS.turtle.layout, createRng('seed-1'));
    const b = generateDeal(LAYOUTS.turtle.layout, createRng('seed-1'));
    const c = generateDeal(LAYOUTS.turtle.layout, createRng('seed-2'));
    const faces = (d: Deal) => d.tiles.map((t) => t.face.id).join(',');
    expect(faces(a)).toBe(faces(b));
    expect(faces(a)).not.toBe(faces(c));
  });

  it('uses each matching pair exactly once across the full set', () => {
    const deal = generateDeal(LAYOUTS.turtle.layout, createRng('count'));
    const counts = new Map<string, number>();
    for (const t of deal.tiles) counts.set(t.face.id, (counts.get(t.face.id) ?? 0) + 1);
    for (const [id, n] of counts) {
      if (id.startsWith('flower') || id.startsWith('season')) expect(n).toBe(1);
      else expect(n).toBe(4);
    }
  });

  it('stays solvable across 25 random seeds (turtle)', () => {
    for (let i = 0; i < 25; i++) {
      const deal = generateDeal(LAYOUTS.turtle.layout, createRng(`bulk-${i}`));
      expect(replaySolution(deal)).toBe(true);
    }
  });
});
