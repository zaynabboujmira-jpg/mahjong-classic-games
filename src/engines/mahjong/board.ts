import type { Bounds, Slot, Topology } from './types';

/** Two same-size tiles overlap when their footprints intersect (half-tile units). */
const overlaps = (a: Slot, b: Slot) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

export function buildTopology(slots: readonly Slot[]): Topology {
  const above: number[][] = slots.map(() => []);
  const left: number[][] = slots.map(() => []);
  const right: number[][] = slots.map(() => []);

  for (let i = 0; i < slots.length; i++) {
    const a = slots[i]!;
    for (let j = 0; j < slots.length; j++) {
      if (i === j) continue;
      const b = slots[j]!;
      if (b.z > a.z && overlaps(a, b)) above[i]!.push(j);
      else if (b.z === a.z && Math.abs(a.y - b.y) < 2) {
        if (b.x === a.x - 2) left[i]!.push(j);
        else if (b.x === a.x + 2) right[i]!.push(j);
      }
    }
  }
  return { slots, above, left, right };
}

const anyPresent = (ids: readonly number[], present: ArrayLike<boolean>) => {
  for (const id of ids) if (present[id]) return true;
  return false;
};

/**
 * A tile is free when nothing lies on top of it and at least one long side
 * (left or right) is open.
 */
export function isFree(topo: Topology, present: ArrayLike<boolean>, i: number): boolean {
  if (!present[i]) return false;
  if (anyPresent(topo.above[i]!, present)) return false;
  return !anyPresent(topo.left[i]!, present) || !anyPresent(topo.right[i]!, present);
}

export function freeSlots(topo: Topology, present: ArrayLike<boolean>): number[] {
  const out: number[] = [];
  for (let i = 0; i < topo.slots.length; i++) if (isFree(topo, present, i)) out.push(i);
  return out;
}

export function boundsOf(slots: readonly Slot[]): Bounds {
  let w = 0;
  let h = 0;
  let maxZ = 0;
  for (const s of slots) {
    w = Math.max(w, s.x + 2);
    h = Math.max(h, s.y + 2);
    maxZ = Math.max(maxZ, s.z);
  }
  return { w, h, maxZ };
}

/** Structural problems that would make a layout unplayable. Empty array = valid. */
export function validateSlots(slots: readonly Slot[]): string[] {
  const errors: string[] = [];
  if (slots.length === 0) errors.push('layout has no tiles');
  if (slots.length % 2 !== 0) errors.push(`odd tile count ${slots.length}`);
  if (slots.length > 144) errors.push(`more than 144 tiles (${slots.length})`);
  for (let i = 0; i < slots.length; i++) {
    const a = slots[i]!;
    if (!Number.isInteger(a.x) || !Number.isInteger(a.y) || !Number.isInteger(a.z) || a.x < 0 || a.y < 0 || a.z < 0) {
      errors.push(`slot ${i} has invalid coordinates (${a.x},${a.y},${a.z})`);
    }
    for (let j = i + 1; j < slots.length; j++) {
      const b = slots[j]!;
      if (a.z === b.z && overlaps(a, b)) errors.push(`slots ${i} and ${j} overlap on layer ${a.z}`);
    }
  }
  return errors;
}
