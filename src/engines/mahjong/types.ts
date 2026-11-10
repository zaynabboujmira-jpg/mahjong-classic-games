/**
 * Board geometry uses half-tile units: a tile occupies a 2 x 2 footprint,
 * so tiles can be offset by half a tile (the classic Turtle "ears" and crown).
 * z is the layer (0 = table).
 */
export interface Slot {
  x: number;
  y: number;
  z: number;
}

export type Suit = 'bamboo' | 'character' | 'circle' | 'wind' | 'dragon' | 'flower' | 'season';

export interface TileFace {
  /** Unique id, e.g. "bamboo-3", "flower-plum". */
  id: string;
  suit: Suit;
  /** 1-9 for suits, 1-4 for winds/flowers/seasons, 1-3 for dragons. */
  rank: number;
  /** Tiles match when matchKey is equal. Flowers all share "flower"; seasons share "season". */
  matchKey: string;
  /** Glyph drawn on the tile face. */
  glyph: string;
  /** Screen-reader label. */
  label: string;
}

export interface Tile extends Slot {
  /** Stable index within the deal. */
  id: number;
  face: TileFace;
  removed: boolean;
}

export interface Layout {
  slug: string;
  name: string;
  slots: Slot[];
  /** Bounding box in half-tile units, derived at definition time. */
  width: number;
  height: number;
  layers: number;
}

export interface Move {
  a: number;
  b: number;
}
