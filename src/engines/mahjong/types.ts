/**
 * Coordinates are in HALF-tile units so layouts can offset tiles by half a tile
 * (the Turtle's end caps, a pyramid's capstone). A tile at (x, y) covers
 * x..x+2 horizontally and y..y+2 vertically. z is the layer, 0 = table.
 */
export interface Slot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface LayoutDef {
  readonly id: string;
  readonly name: string;
  readonly slots: readonly Slot[];
}

export type Suit = 'dots' | 'bamboo' | 'characters' | 'wind' | 'dragon' | 'flower' | 'season';

export interface Face {
  /** Unique per face design, e.g. "dots-3", "flower-plum". */
  readonly id: string;
  readonly suit: Suit;
  /** 1-9 for suits; index within the honour/bonus group otherwise. */
  readonly rank: number;
  /** Tiles match when their matchKey is equal (all flowers match each other, as do all seasons). */
  readonly matchKey: string;
  /** Human-readable name used for screen-reader announcements. */
  readonly label: string;
}

/** Pre-computed neighbourhood of every slot, so "is this tile free?" is a few array lookups. */
export interface Topology {
  readonly slots: readonly Slot[];
  /** Slots on any higher layer that overlap this slot. */
  readonly above: readonly (readonly number[])[];
  /** Same-layer slots touching this slot's left edge. */
  readonly left: readonly (readonly number[])[];
  /** Same-layer slots touching this slot's right edge. */
  readonly right: readonly (readonly number[])[];
}

export interface Bounds {
  /** Width in half-tile units (rightmost x + 2). */
  readonly w: number;
  /** Height in half-tile units (bottom y + 2). */
  readonly h: number;
  readonly maxZ: number;
}
