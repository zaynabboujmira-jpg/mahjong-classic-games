import { describe, expect, it } from 'vitest';
import { isFree, overlaps, supportsOf } from '@engines/mahjong/board';
import type { Slot } from '@engines/mahjong/types';

describe('overlaps', () => {
  it('detects full and half-offset overlaps', () => {
    expect(overlaps({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 1 })).toBe(false);
    expect(overlaps({ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 1 })).toBe(false);
  });
});

describe('isFree', () => {
  const t = (x: number, y: number, z: number): Slot => ({ x, y, z });

  it('a lone tile is free', () => {
    const a = t(0, 0, 0);
    expect(isFree(a, [a])).toBe(true);
  });

  it('a tile with neighbours on both sides is blocked', () => {
    const mid = t(2, 0, 0);
    const present = [t(0, 0, 0), mid, t(4, 0, 0)];
    expect(isFree(mid, present)).toBe(false);
    expect(isFree(present[0], present)).toBe(true);
    expect(isFree(present[2], present)).toBe(true);
  });

  it('a half-offset neighbour still blocks a side', () => {
    const mid = t(2, 0, 0);
    const present = [t(0, 1, 0), mid, t(4, -1, 0)];
    expect(isFree(mid, present)).toBe(false);
  });

  it('a tile covered by a higher tile is blocked even if sides are open', () => {
    const base = t(0, 0, 0);
    const present = [base, t(1, 1, 1)];
    expect(isFree(base, present)).toBe(false);
  });

  it('a tile two rows away does not block', () => {
    const mid = t(2, 0, 0);
    const present = [t(0, 2, 0), mid, t(4, 2, 0)];
    expect(isFree(mid, present)).toBe(true);
  });
});

describe('supportsOf', () => {
  it('finds the four tiles under a half-offset crown', () => {
    const base: Slot[] = [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 2, z: 0 },
      { x: 2, y: 2, z: 0 },
    ];
    const crown: Slot = { x: 1, y: 1, z: 1 };
    expect(supportsOf(crown, [...base, crown])).toHaveLength(4);
  });
});
