import type { Bounds, Slot } from './types';

/** Tile face height / width. */
export const TILE_ASPECT = 1.22;
/** Thickness of a tile (and per-layer offset) as a fraction of its short side. */
export const DEPTH_RATIO = 0.09;
export const MIN_TILE = 36;
/** Smallest tile used to keep the whole board on screen; below this the page scrolls instead. */
export const FIT_MIN_TILE = 28;
export const MAX_TILE = 76;

/** Round down to 0.01px so floating-point error can never push the board past the viewport. */
const floor2 = (v: number) => Math.floor(v * 100) / 100;

export interface Fit {
  /** Board drawn with logical rows running down the screen's columns (portrait phones). */
  readonly rotated: boolean;
  /** Tile face size on screen, in CSS pixels. */
  readonly tileW: number;
  readonly tileH: number;
  /** Short side of a tile: the touch-target size we guarantee. */
  readonly tileSize: number;
  readonly depth: number;
  readonly boardW: number;
  readonly boardH: number;
}

/** Board size in multiples of the tile short side, for each orientation. */
function unitSize(b: Bounds, rotated: boolean) {
  const extra = (b.maxZ + 1) * DEPTH_RATIO;
  const across = b.w / 2; // tiles along logical x
  const down = (b.h / 2) * TILE_ASPECT; // logical y, in short-side units
  return rotated
    ? { w: (b.h / 2) * TILE_ASPECT + extra, h: b.w / 2 + extra }
    : { w: across + extra, h: down + extra };
}

function makeFit(b: Bounds, rotated: boolean, size: number): Fit {
  const u = unitSize(b, rotated);
  return {
    rotated,
    tileSize: size,
    tileW: rotated ? size * TILE_ASPECT : size,
    tileH: rotated ? size : size * TILE_ASPECT,
    depth: size * DEPTH_RATIO,
    boardW: u.w * size,
    boardH: u.h * size,
  };
}

/**
 * Chooses orientation and tile size for a viewport.
 *
 * 1. Never wider than the viewport (no horizontal scrolling), ever.
 * 2. Prefer the orientation where the whole board fits with the largest tiles.
 *    Rotation is only considered on portrait viewports.
 * 3. Tiles may shrink to FIT_MIN_TILE (28 px) to keep the whole board on
 *    screen. Below that, grow them to MIN_TILE (36 px, or as close as the
 *    width allows) and let the page scroll vertically instead.
 */
export function fitBoard(b: Bounds, viewportW: number, viewportH: number): Fit {
  const options = viewportH > viewportW ? [false, true] : [false];
  const candidates = options.map((rotated) => {
    const u = unitSize(b, rotated);
    const byWidth = viewportW / u.w;
    const whole = Math.min(byWidth, viewportH / u.h);
    return { rotated, byWidth, whole };
  });

  const bestWhole = candidates.reduce((a, c) => (c.whole > a.whole ? c : a));
  // Whole board on screen when tiles stay at least FIT_MIN_TILE (36 px preferred, 28 px allowed).
  if (bestWhole.whole >= FIT_MIN_TILE) {
    return makeFit(b, bestWhole.rotated, floor2(Math.min(bestWhole.whole, MAX_TILE)));
  }
  const bestWidth = candidates.reduce((a, c) => (c.byWidth > a.byWidth ? c : a));
  const size = Math.min(bestWidth.byWidth, Math.max(bestWidth.whole, MIN_TILE));
  return makeFit(b, bestWidth.rotated, floor2(size));
}

export interface TileRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Screen rectangle of a tile's face. Higher layers shift up and to the right
 * by one tile depth, and each tile's thickness is drawn on its left and
 * bottom edges. In rotated mode logical (x, y) is turned 90° clockwise while
 * the tile faces stay upright.
 */
export function projectSlot(s: Slot, b: Bounds, fit: Fit): TileRect {
  const col = fit.rotated ? b.h - 2 - s.y : s.x;
  const rowU = fit.rotated ? s.x : s.y;
  return {
    x: fit.depth + (col / 2) * fit.tileW + s.z * fit.depth,
    y: b.maxZ * fit.depth + (rowU / 2) * fit.tileH - s.z * fit.depth,
    w: fit.tileW,
    h: fit.tileH,
  };
}
