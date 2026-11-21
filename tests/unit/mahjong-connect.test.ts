import { describe, expect, it } from 'vitest';
import { CONNECT_LEVELS, ConnectGame, SIZES, findPath } from '../../src/engines/mahjong-connect/connect';
import { faceById } from '../../src/engines/mahjong/tiles';

/** Number of bends in a path of corner cells. */
const bends = (p: number[]) => p.length - 2;

describe('connect paths', () => {
  const W = 6;
  const H = 5;
  const at = (r: number, c: number) => r * W + c;
  it('joins neighbours and straight lines, and goes round through empty cells with at most two bends', () => {
    const blocked = new Set<number>();
    const empty = (i: number) => !blocked.has(i);
    expect(findPath(W, H, at(1, 1), at(1, 2), empty)).toEqual([at(1, 1), at(1, 2)]);
    expect(findPath(W, H, at(1, 1), at(1, 4), empty)).toEqual([at(1, 1), at(1, 4)]);
    // Wall between them on the same row: route over the top in two bends.
    blocked.add(at(1, 2));
    const p = findPath(W, H, at(1, 1), at(1, 3), empty)!;
    expect(p).not.toBeNull();
    expect(bends(p)).toBeLessThanOrEqual(2);
  });
  it('refuses paths that need three bends', () => {
    // a at (2,1), b at (2,4); fill everything except a narrow S-shaped corridor.
    const open = new Set([at(2, 1), at(2, 4), at(3, 1), at(3, 2), at(1, 2), at(1, 3), at(2, 3)]);
    const empty = (i: number) => open.has(i);
    expect(findPath(W, H, at(2, 1), at(2, 4), empty)).toBeNull();
  });
});

describe('connect deals', () => {
  for (const level of CONNECT_LEVELS) {
    it(`${level}: full grid, matching pairs, empty border, a move at the start, and always finishable with hints and free shuffles`, () => {
      for (const seed of ['a', 'b']) {
        const g = new ConnectGame(level, seed);
        const { cols, rows } = SIZES[level];
        expect(g.left).toBe(cols * rows);
        for (let r = 0; r < g.H; r++) for (let c = 0; c < g.W; c++) if (r === 0 || c === 0 || r === g.H - 1 || c === g.W - 1) expect(g.s.tiles[r * g.W + c]).toBeNull();
        const keys = new Map<string, number>();
        for (const f of g.s.tiles) if (f) keys.set(faceById(f).matchKey, (keys.get(faceById(f).matchKey) ?? 0) + 1);
        for (const n of keys.values()) expect(n % 2).toBe(0);
        // Greedy play with automatic free shuffles always finishes.
        let shuffles = 0;
        for (let n = 0; n < 200 && !g.isWon; n++) {
          const h = g.hint();
          if (!h) {
            expect(g.shuffle(true)).toBe(true);
            shuffles++;
            continue;
          }
          expect(bends(h.path)).toBeLessThanOrEqual(2);
          expect(g.remove(h.a, h.b)).not.toBeNull();
        }
        expect(g.isWon).toBe(true);
        expect(shuffles).toBeLessThan(20);
      }
    });
  }

  it('rejects non-matching or blocked pairs, undo restores, and state round-trips through JSON', () => {
    const g = new ConnectGame('medium', 'x');
    const t = g.s.tiles;
    const cells = t.flatMap((f, i) => (f ? [i] : []));
    const a = cells[0]!;
    const other = cells.find((i) => faceById(t[i]!).matchKey !== faceById(t[a]!).matchKey)!;
    expect(g.remove(a, other)).toBeNull();
    const h = g.hint()!;
    g.remove(h.a, h.b);
    expect(g.left).toBe(cells.length - 2);
    g.undo();
    expect(g.left).toBe(cells.length);
    const copy = new ConnectGame(JSON.parse(JSON.stringify(g.s)));
    expect(copy.hint()).toEqual(g.hint());
  });

  it('a paid shuffle uses one of the three shuffles, keeps the same tiles and leaves a move', () => {
    const g = new ConnectGame('easy', 'shuffle');
    const before = g.s.tiles.filter(Boolean).sort();
    expect(g.shuffle()).toBe(true);
    expect(g.s.shuffles).toBe(2);
    expect(g.s.tiles.filter(Boolean).sort()).toEqual(before);
    expect(g.hint()).not.toBeNull();
  });
});
