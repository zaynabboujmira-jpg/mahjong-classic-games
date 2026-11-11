import type { LayoutDef, Slot } from '../types';

/**
 * Small DSL for drawing layouts in whole-tile units (halves allowed, e.g. 3.5).
 * Everything is converted to the engine's half-tile grid and normalised so
 * the top-left tile sits at (0, 0).
 */
export type Group = Slot[];

const toHalf = (v: number) => {
  const h = v * 2;
  if (!Number.isInteger(h)) throw new Error(`layout coordinate ${v} is not a multiple of 0.5`);
  return h;
};

/** One tile at tile coordinates (x, y) on layer z. */
export const at = (z: number, x: number, y: number): Group => [{ x: toHalf(x), y: toHalf(y), z }];

/** A horizontal run of tiles from x0 to x1 inclusive. */
export function row(z: number, y: number, x0: number, x1: number): Group {
  const out: Slot[] = [];
  for (let x = x0; x <= x1; x++) out.push(...at(z, x, y));
  return out;
}

/** A filled rectangle of tiles, corners inclusive. */
export function rect(z: number, x0: number, y0: number, x1: number, y1: number): Group {
  const out: Slot[] = [];
  for (let y = y0; y <= y1; y++) out.push(...row(z, y, x0, x1));
  return out;
}

/** Mirror a group horizontally around the vertical line x = axis (tile units). */
export function mirrorX(group: Group, axis: number): Group {
  const a = toHalf(axis);
  // A tile at x covers x..x+2, so its mirror image starts at 2a - x - 2.
  return group.map((s) => ({ ...s, x: 2 * a - s.x - 2 }));
}

export function defineLayout(id: string, name: string, ...groups: Group[]): LayoutDef {
  const raw = groups.flat();
  const minX = Math.min(...raw.map((s) => s.x));
  const minY = Math.min(...raw.map((s) => s.y));
  const slots = raw.map((s) => ({ x: s.x - minX, y: s.y - minY, z: s.z }));
  return { id, name, slots };
}
