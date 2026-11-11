import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engines/core/rng';
import { boundsOf, buildTopology, freeSlots, isFree, validateSlots } from '../../src/engines/mahjong/board';
import { generateDeal } from '../../src/engines/mahjong/generator';
import { MahjongGame } from '../../src/engines/mahjong/game';
import { at, defineLayout, row } from '../../src/engines/mahjong/layouts/define';
import { LAYOUTS, turtle } from '../../src/engines/mahjong/layouts';
import { FACES, canMatch, standardPairs } from '../../src/engines/mahjong/tiles';

describe('tile set', () => {
  it('has 42 faces and 72 pairs covering 144 tiles', () => {
    expect(FACES).toHaveLength(42);
    const pairs = standardPairs();
    expect(pairs).toHaveLength(72);
    expect(pairs.every(([a, b]) => canMatch(a, b))).toBe(true);
  });

  it('matches any two flowers but never a flower with a season', () => {
    const plum = FACES.find((f) => f.id === 'flower-1')!;
    const orchid = FACES.find((f) => f.id === 'flower-2')!;
    const spring = FACES.find((f) => f.id === 'season-1')!;
    expect(canMatch(plum, orchid)).toBe(true);
    expect(canMatch(plum, spring)).toBe(false);
  });
});

describe('free-tile rules', () => {
  // Three tiles in a row with one tile on top of the middle one.
  const line = defineLayout('t', 'T', row(0, 0, 0, 2), at(1, 1, 0));
  const topo = buildTopology(line.slots);
  const all = line.slots.map(() => true);

  it('blocks a tile with neighbours on both sides', () => {
    expect(isFree(topo, all, 1)).toBe(false);
  });
  it('frees tiles with an open left or right side', () => {
    expect(isFree(topo, all, 0)).toBe(true);
    expect(isFree(topo, all, 2)).toBe(true);
  });
  it('blocks a tile that is covered, even with open sides', () => {
    const present = [false, true, false, true];
    expect(isFree(topo, present, 1)).toBe(false);
    expect(isFree(topo, present, 3)).toBe(true);
  });
  it('treats half-offset neighbours as touching', () => {
    // Turtle's left end cap sits half a row lower than its neighbours.
    const t = buildTopology(turtle.slots);
    const cap = turtle.slots.findIndex((s) => s.x === 0);
    expect(t.right[cap]!.length).toBe(2);
  });
});

describe('layouts', () => {
  it('has at least the six required layouts', () => {
    expect(LAYOUTS.map((l) => l.id)).toEqual(
      expect.arrayContaining(['turtle', 'dragon', 'pyramid', 'fortress', 'butterfly', 'fish']),
    );
  });

  for (const layout of LAYOUTS) {
    describe(layout.name, () => {
      it('is structurally valid (even, <=144, no same-layer overlaps)', () => {
        expect(validateSlots(layout.slots)).toEqual([]);
      });
      it('is at most 8 tiles tall so it can rotate onto a phone', () => {
        expect(boundsOf(layout.slots).h).toBeLessThanOrEqual(16);
      });
      it('generates solvable deals for 50 different seeds', () => {
        const topo = buildTopology(layout.slots);
        for (let s = 0; s < 50; s++) {
          const deal = generateDeal(topo, createRng(`${layout.id}-${s}`));
          expect(replaySolution(topo, deal)).toBe(true);
        }
      });
    });
  }

  it('turtle has the classic 144 tiles on 5 layers', () => {
    expect(turtle.slots).toHaveLength(144);
    expect(boundsOf(turtle.slots).maxZ).toBe(4);
  });
});

/** Plays a deal's recorded solution, checking every move is legal. */
function replaySolution(topo: ReturnType<typeof buildTopology>, deal: ReturnType<typeof generateDeal>) {
  const present = topo.slots.map(() => true);
  for (const [a, b] of deal.solution) {
    if (!isFree(topo, present, a) || !isFree(topo, present, b)) return false;
    if (!canMatch(deal.faces[a]!, deal.faces[b]!)) return false;
    present[a] = false;
    present[b] = false;
  }
  return present.every((p) => !p);
}

describe('generator', () => {
  it('is deterministic for a given seed', () => {
    const topo = buildTopology(turtle.slots);
    const a = generateDeal(topo, createRng('same'));
    const b = generateDeal(topo, createRng('same'));
    expect(a.faces.map((f) => f!.id)).toEqual(b.faces.map((f) => f!.id));
  });
  it('uses each of the 144 standard tiles exactly once on a full layout', () => {
    const deal = generateDeal(buildTopology(turtle.slots), createRng(1));
    const counts = new Map<string, number>();
    for (const f of deal.faces) counts.set(f!.id, (counts.get(f!.id) ?? 0) + 1);
    for (const f of FACES) {
      expect(counts.get(f.id)).toBe(f.suit === 'flower' || f.suit === 'season' ? 1 : 4);
    }
  });
  it('rejects an odd number of tiles', () => {
    const odd = defineLayout('o', 'O', row(0, 0, 0, 2));
    expect(() => generateDeal(buildTopology(odd.slots), createRng(1))).toThrow();
  });
});

describe('MahjongGame', () => {
  const newGame = (seed = 'g') => new MahjongGame(turtle.slots, createRng(seed));

  it('ignores clicks on blocked tiles', () => {
    const g = newGame();
    const blocked = g.slots.findIndex((_, i) => !g.isFree(i));
    expect(g.select(blocked).kind).toBe('blocked');
    expect(g.selected).toBeNull();
  });

  it('matches a hinted pair, then undo restores it', () => {
    const g = newGame();
    const [a, b] = g.hint()!;
    g.select(a);
    expect(g.select(b)).toEqual({ kind: 'matched', a, b });
    expect(g.remaining).toBe(142);
    expect(g.moveCount).toBe(1);
    expect(g.undo()).toBe(true);
    expect(g.remaining).toBe(144);
    expect(g.isPresent(a) && g.isPresent(b)).toBe(true);
  });

  it('moves the selection on a non-matching free tile and deselects on re-click', () => {
    const g = newGame();
    const free = g.freeTiles();
    const a = free[0]!;
    const b = free.find((i) => !canMatch(g.faceAt(i)!, g.faceAt(a)!))!;
    g.select(a);
    expect(g.select(b).kind).toBe('mismatch');
    expect(g.selected).toBe(b);
    expect(g.select(b).kind).toBe('deselected');
  });

  it('can be won by always playing the hint, shuffling when stuck', () => {
    for (const seed of ['w1', 'w2', 'w3', 'w4', 'w5']) {
      const g = newGame(seed);
      const rng = createRng(seed);
      let guard = 0;
      while (!g.isWon && guard++ < 500) {
        const h = g.hint();
        if (!h) {
          g.shuffle(rng);
          continue;
        }
        g.select(h[0]);
        g.select(h[1]);
      }
      expect(g.isWon).toBe(true);
    }
  });

  it('shuffle keeps the same faces, stays solvable and is undoable', () => {
    const g = newGame('s');
    for (let k = 0; k < 10; k++) {
      const [a, b] = g.hint()!;
      g.select(a);
      g.select(b);
    }
    const before = g.slots.map((_, i) => (g.isPresent(i) ? g.faceAt(i)!.id : null));
    g.shuffle(createRng('x'));
    const after = g.slots.map((_, i) => (g.isPresent(i) ? g.faceAt(i)!.id : null));
    expect([...after].filter(Boolean).sort()).toEqual([...before].filter(Boolean).sort());
    expect(g.availablePairs().length).toBeGreaterThan(0);
    g.undo();
    expect(g.slots.map((_, i) => (g.isPresent(i) ? g.faceAt(i)!.id : null))).toEqual(before);
  });

  it('reports free tiles consistently with the board helper', () => {
    const g = newGame();
    const present = g.slots.map((_, i) => g.isPresent(i));
    expect(g.freeTiles()).toEqual(freeSlots(g.topo, present));
  });
});
