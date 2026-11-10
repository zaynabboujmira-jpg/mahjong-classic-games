import type { Rng } from '../core/rng';
import { isFree, overlaps, supportsOf } from './board';
import { fullPairSet } from './tiles';
import type { Layout, Slot, Tile, TileFace } from './types';

/**
 * Generates a guaranteed-solvable deal by simulating the game in reverse.
 *
 * Forward play removes free pairs until the board is empty. Reversing that
 * sequence means: start empty, repeatedly place a pair of tiles so that
 *   - each tile's supports (layer below) are already placed, and
 *   - both tiles are free (removable) in the resulting board.
 * Assign the pair a matching face. Replaying the placement order backwards
 * is then a valid solution, which we return for hints and testing.
 *
 * Placed tiles are never taken back, so a placement that leaves a run of empty
 * slots walled in on both sides (by placed tiles) can never be completed. Such
 * placements are rejected up front, which makes dead ends rare. Any remaining
 * dead end restarts with the same RNG stream, so output stays deterministic per seed.
 */
export interface Deal {
  tiles: Tile[];
  /** Pairs in the order they can be removed. */
  solution: [number, number][];
}

export function generateDeal(layout: Layout, rng: Rng, faces?: [TileFace, TileFace][]): Deal {
  const pairPool = faces ?? rng.shuffle(fullPairSet());
  const needed = layout.slots.length / 2;
  if (pairPool.length < needed) throw new Error('Not enough tile pairs for this layout');

  for (let attempt = 0; attempt < 200; attempt++) {
    const result = tryFill(layout.slots, rng);
    if (result) {
      const tiles: Tile[] = layout.slots.map((s, i) => ({ id: i, x: s.x, y: s.y, z: s.z, removed: false, face: pairPool[0][0] }));
      const solution: [number, number][] = [];
      result.forEach(([ia, ib], p) => {
        const [fa, fb] = pairPool[p];
        tiles[ia].face = fa;
        tiles[ib].face = fb;
      });
      // Reverse of fill order is the forward solution.
      for (let i = result.length - 1; i >= 0; i--) solution.push(result[i]);
      return { tiles, solution };
    }
  }
  throw new Error(`Could not generate a solvable deal for layout "${layout.slug}"`);
}

function tryFill(slots: readonly Slot[], rng: Rng): [number, number][] | null {
  const n = slots.length;
  const filled: boolean[] = new Array(n).fill(false);
  const present: Slot[] = [];
  const order: [number, number][] = [];
  const supports = slots.map((s) => supportsOf(s, slots).map((sup) => slots.indexOf(sup)));

  // Horizontal neighbours on the same layer (half-offsets included), precomputed.
  const leftOf: number[][] = slots.map(() => []);
  const rightOf: number[][] = slots.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j || slots[i].z !== slots[j].z || Math.abs(slots[i].y - slots[j].y) >= 2) continue;
      if (slots[j].x === slots[i].x - 2) leftOf[i].push(j);
      else if (slots[j].x === slots[i].x + 2) rightOf[i].push(j);
    }
  }

  const canPlace = (i: number): boolean => {
    if (filled[i]) return false;
    for (const sup of supports[i]) if (!filled[sup]) return false;
    for (const p of present) if (p.z > slots[i].z && overlaps(slots[i], p)) return false;
    return isFree(slots[i], [...present, slots[i]]);
  };

  /** Can empty slot e still reach an open edge walking through empty slots in one direction? */
  const openToward = (e: number, dir: number[][], visited: Set<number>): boolean => {
    if (visited.has(e)) return false;
    visited.add(e);
    const nb = dir[e];
    if (nb.length === 0) return true; // layout edge
    for (const j of nb) if (!filled[j] && openToward(j, dir, visited)) return true;
    return false;
  };

  /** Placing i must not strand any adjacent empty run between placed tiles. */
  const strandsNeighbours = (i: number): boolean => {
    filled[i] = true;
    let stranded = false;
    for (const e of [...leftOf[i], ...rightOf[i]]) {
      if (filled[e]) continue;
      if (!openToward(e, leftOf, new Set()) && !openToward(e, rightOf, new Set())) {
        stranded = true;
        break;
      }
    }
    filled[i] = false;
    return stranded;
  };

  const place = (i: number) => {
    filled[i] = true;
    present.push(slots[i]);
  };
  const unplace = (i: number) => {
    filled[i] = false;
    present.splice(present.indexOf(slots[i]), 1);
  };

  while (order.length * 2 < n) {
    const candidates: number[] = [];
    for (let i = 0; i < n; i++) if (canPlace(i) && !strandsNeighbours(i)) candidates.push(i);
    if (candidates.length < 2) return null;
    rng.shuffle(candidates);

    let placed = false;
    for (const a of candidates) {
      place(a);
      const seconds: number[] = [];
      for (let b = 0; b < n; b++) if (b !== a && canPlace(b) && !strandsNeighbours(b)) seconds.push(b);
      rng.shuffle(seconds);
      for (const b of seconds) {
        place(b);
        if (isFree(slots[a], present) && isFree(slots[b], present)) {
          order.push([a, b]);
          placed = true;
          break;
        }
        unplace(b);
      }
      if (placed) break;
      unplace(a);
    }
    if (!placed) return null;
  }
  return order;
}

/**
 * Reshuffles the faces of the remaining tiles into a new solvable arrangement.
 * Positions stay fixed; only faces move. Returns null if fewer than 2 tiles remain.
 */
export function reshuffleRemaining(tiles: Tile[], rng: Rng): Deal | null {
  const remaining = tiles.filter((t) => !t.removed);
  if (remaining.length < 2) return null;
  const byKey = new Map<string, TileFace[]>();
  for (const t of remaining) {
    const list = byKey.get(t.face.matchKey) ?? [];
    list.push(t.face);
    byKey.set(t.face.matchKey, list);
  }
  const pairs: [TileFace, TileFace][] = [];
  for (const list of byKey.values()) for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
  rng.shuffle(pairs);

  const subLayout: Layout = {
    slug: 'sub',
    name: 'sub',
    slots: remaining.map((t) => ({ x: t.x, y: t.y, z: t.z })),
    width: 0,
    height: 0,
    layers: 0,
  };
  const deal = generateDeal(subLayout, rng, pairs);
  deal.tiles.forEach((nt, i) => {
    remaining[i].face = nt.face;
  });
  const idMap = remaining.map((t) => t.id);
  return { tiles, solution: deal.solution.map(([a, b]) => [idMap[a], idMap[b]]) };
}
