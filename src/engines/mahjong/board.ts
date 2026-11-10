import type { Slot, Tile } from './types';

/** Two 2x2 footprints overlap if they are within 2 half-units on both axes. */
export const overlaps = (a: Slot, b: Slot): boolean => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

/** Vertical overlap only (used for side blocking). */
const sideTouch = (a: Slot, b: Slot): boolean => Math.abs(a.y - b.y) < 2;

/**
 * Pure free-tile rule. A tile is free when:
 *  1. no present tile on a higher layer overlaps its footprint, and
 *  2. at least one of its left or right edges has no present tile on the same layer
 *     that touches it vertically.
 */
export function isFree(tile: Slot, present: readonly Slot[]): boolean {
  let leftBlocked = false;
  let rightBlocked = false;
  for (const o of present) {
    if (o === tile) continue;
    if (o.z > tile.z && overlaps(tile, o)) return false;
    if (o.z === tile.z && sideTouch(tile, o)) {
      if (o.x === tile.x - 2) leftBlocked = true;
      else if (o.x === tile.x + 2) rightBlocked = true;
      if (leftBlocked && rightBlocked) return false;
    }
  }
  return true;
}

export const presentTiles = (tiles: readonly Tile[]): Tile[] => tiles.filter((t) => !t.removed);

export function freeTiles(tiles: readonly Tile[]): Tile[] {
  const present = presentTiles(tiles);
  return present.filter((t) => isFree(t, present));
}

/** Slots on the layer directly below that this slot rests on. */
export function supportsOf(slot: Slot, slots: readonly Slot[]): Slot[] {
  return slots.filter((s) => s.z === slot.z - 1 && overlaps(slot, s));
}

/** Available matching pairs among free tiles. */
export function availableMoves(tiles: readonly Tile[]): [Tile, Tile][] {
  const free = freeTiles(tiles);
  const byKey = new Map<string, Tile[]>();
  for (const t of free) {
    const list = byKey.get(t.face.matchKey) ?? [];
    list.push(t);
    byKey.set(t.face.matchKey, list);
  }
  const out: [Tile, Tile][] = [];
  for (const list of byKey.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
  }
  return out;
}
