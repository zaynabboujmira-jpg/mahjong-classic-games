import { at, defineLayout, mirrorX, rect, row } from './define';
import type { LayoutDef } from '../types';

/*
 * All layouts are at most 8 tiles tall so they can be rotated onto a portrait
 * phone screen at a playable tile size (see fit.ts).
 */

/** The classic arrangement: a domed shell, three end caps and a single top tile. 144 tiles. */
export const turtle = defineLayout(
  'turtle',
  'Turtle',
  row(0, 0, 1, 12),
  row(0, 1, 3, 10),
  row(0, 2, 2, 11),
  row(0, 3, 1, 12),
  row(0, 4, 1, 12),
  row(0, 5, 2, 11),
  row(0, 6, 3, 10),
  row(0, 7, 1, 12),
  at(0, 0, 3.5),
  at(0, 13, 3.5),
  at(0, 14, 3.5),
  rect(1, 4, 1, 9, 6),
  rect(2, 5, 2, 8, 5),
  rect(3, 6, 3, 7, 4),
  at(4, 6.5, 3.5),
);

/** A stepped square pyramid: 8x8, 6x6, 4x4, 2x2. 120 tiles. */
export const pyramid = defineLayout(
  'pyramid',
  'Pyramid',
  rect(0, 0, 0, 7, 7),
  rect(1, 1, 1, 6, 6),
  rect(2, 2, 2, 5, 5),
  rect(3, 3, 3, 4, 4),
);

/** Walled courtyard with four corner towers and a central keep. 144 tiles. */
export const fortress = defineLayout(
  'fortress',
  'Fortress',
  // ground: outer wall ring + courtyard
  row(0, 0, 0, 11),
  row(0, 7, 0, 11),
  rect(0, 0, 1, 0, 6),
  rect(0, 11, 1, 11, 6),
  rect(0, 2, 2, 9, 5),
  // first floor: towers, walls, raised courtyard
  rect(1, 0, 0, 1, 1),
  rect(1, 10, 0, 11, 1),
  rect(1, 0, 6, 1, 7),
  rect(1, 10, 6, 11, 7),
  row(1, 0, 2, 9),
  row(1, 7, 2, 9),
  rect(1, 0, 2, 0, 5),
  rect(1, 11, 2, 11, 5),
  rect(1, 3, 2, 8, 5),
  // tower tops and the keep
  at(2, 0.5, 0.5),
  at(2, 10.5, 0.5),
  at(2, 0.5, 6.5),
  at(2, 10.5, 6.5),
  rect(2, 4, 3, 7, 4),
);

/** A long serpent body with waves, wings, a raised spine and a horned head. 140 tiles. */
export const dragon = defineLayout(
  'dragon',
  'Dragon',
  // ground
  rect(0, 1, 3, 14, 4),
  row(0, 2, 3, 6),
  row(0, 2, 9, 12),
  row(0, 5, 3, 6),
  row(0, 5, 9, 12),
  rect(0, 5, 0, 10, 1),
  rect(0, 5, 6, 10, 7),
  rect(0, 15, 2, 16, 5),
  at(0, 0, 3.5),
  // spine
  rect(1, 2, 3, 13, 4),
  rect(1, 15, 3, 16, 4),
  row(1, 0, 6, 9),
  row(1, 7, 6, 9),
  at(1, 0, 3.5),
  rect(2, 4, 3, 11, 4),
  at(2, 15.5, 3.5),
  rect(3, 6, 3, 9, 4),
  at(4, 7.5, 3.5),
);

const butterflyWing = [
  // ground
  row(0, 0, 1, 6),
  row(0, 1, 2, 6),
  row(0, 2, 3, 6),
  row(0, 3, 4, 6),
  row(0, 4, 4, 6),
  row(0, 5, 3, 6),
  row(0, 6, 2, 6),
  row(0, 7, 1, 6),
  // raised wing patterns
  row(1, 1, 3, 6),
  row(1, 2, 4, 6),
  row(1, 5, 4, 6),
  row(1, 6, 3, 6),
  row(2, 1, 5, 6),
  row(2, 6, 5, 6),
].flat();

/** Two symmetrical wings around a stacked body. 128 tiles. */
export const butterfly = defineLayout(
  'butterfly',
  'Butterfly',
  butterflyWing,
  mirrorX(butterflyWing, 7.5),
  rect(0, 7, 0, 7, 7),
  rect(1, 7, 1, 7, 6),
  rect(2, 7, 2, 7, 5),
  rect(3, 7, 3, 7, 4),
);

/** An oval body with a raised back and a forked tail. 144 tiles. */
export const fish = defineLayout(
  'fish',
  'Fish',
  row(0, 0, 4, 9),
  row(0, 1, 2, 11),
  row(0, 2, 1, 12),
  row(0, 3, 0, 12),
  row(0, 4, 0, 12),
  row(0, 5, 1, 12),
  row(0, 6, 2, 11),
  row(0, 7, 4, 9),
  rect(0, 13, 3, 14, 4),
  rect(0, 15, 0, 16, 2),
  rect(0, 15, 5, 16, 7),
  rect(1, 3, 2, 10, 5),
  at(1, 15.5, 1),
  at(1, 15.5, 6),
  rect(2, 4, 3, 9, 4),
);

export const LAYOUTS: readonly LayoutDef[] = [turtle, dragon, pyramid, fortress, butterfly, fish];

export function getLayout(id: string): LayoutDef | undefined {
  return LAYOUTS.find((l) => l.id === id);
}
