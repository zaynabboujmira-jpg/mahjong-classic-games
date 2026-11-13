import { shuffleInPlace, type Rng } from '../core/rng';

/*
 * Tile kinds, numbered to match FACES in ../mahjong/tiles.ts so the solitaire
 * tile artwork can be reused:
 *   0-8 Dots 1-9 · 9-17 Bamboo 1-9 · 18-26 Characters 1-9
 *   27-30 East, South, West, North · 31-33 Red, Green, White dragons
 *   34-37 flowers · 38-41 seasons · 42 Joker (American only)
 */
export const KINDS = 34;
export const EAST = 27;
export const RED = 31;
export const GREEN = 32;
export const WHITE = 33;
export const FLOWER = 34;
export const JOKER = 42;

export interface Tile {
  /** Unique within a wall. */
  readonly id: number;
  readonly kind: number;
}

export const isSuited = (k: number) => k < 27;
export const suitOf = (k: number) => Math.floor(k / 9);
export const rankOf = (k: number) => (k % 9) + 1;
export const isHonor = (k: number) => k >= 27 && k < 34;
export const isWind = (k: number) => k >= 27 && k <= 30;
export const isDragon = (k: number) => k >= 31 && k <= 33;
export const isBonus = (k: number) => k >= 34 && k <= 41;
export const isTerminal = (k: number) => isSuited(k) && (rankOf(k) === 1 || rankOf(k) === 9);
export const isTerminalOrHonor = (k: number) => isTerminal(k) || isHonor(k);
export const kindOf = (suit: number, rank: number) => suit * 9 + rank - 1;

const SUITS = ['Dots', 'Bamboo', 'Characters'];
const AM_SUITS = ['Dots', 'Bams', 'Craks'];
export const WINDS = ['East', 'South', 'West', 'North'];
const DRAGONS = ['Red', 'Green', 'White'];
const BONUS = ['Plum', 'Orchid', 'Chrysanthemum', 'Bamboo', 'Spring', 'Summer', 'Autumn', 'Winter'];

/** "5 Dots", "East Wind", "Red Dragon", "Plum flower", "Joker". American names suits Bams and Craks. */
export function tileName(k: number, american = false): string {
  if (isSuited(k)) return `${rankOf(k)} ${(american ? AM_SUITS : SUITS)[suitOf(k)]}`;
  if (isWind(k)) return `${WINDS[k - 27]} Wind`;
  if (isDragon(k)) return american && k === WHITE ? 'White Dragon (Soap)' : `${DRAGONS[k - 31]} Dragon`;
  if (isBonus(k)) return american ? 'Flower' : `${BONUS[k - 34]} ${k < 38 ? 'flower' : 'season'}`;
  return 'Joker';
}

/** Short label for compact UI: "5D", "5B", "5C", "E", "Rd", "F", "J". */
export function shortName(k: number): string {
  if (isSuited(k)) return `${rankOf(k)}${'DBC'[suitOf(k)]}`;
  if (isWind(k)) return 'ESWN'[k - 27]!;
  if (isDragon(k)) return ['Rd', 'Gd', 'Wd'][k - 31]!;
  if (isBonus(k)) return 'F';
  return 'J';
}

/**
 * A shuffled wall: 136 tiles (4 of each of the 34 kinds), plus the 8 flowers
 * and seasons when `flowers`, plus 8 jokers when `jokers` (152 for American).
 */
export function buildWall(opts: { flowers: boolean; jokers: boolean }, rng: Rng): Tile[] {
  const kinds: number[] = [];
  for (let k = 0; k < KINDS; k++) kinds.push(k, k, k, k);
  if (opts.flowers) for (let k = 34; k < 42; k++) kinds.push(k);
  if (opts.jokers) for (let j = 0; j < 8; j++) kinds.push(JOKER);
  return shuffleInPlace(
    kinds.map((kind, id) => ({ id, kind })),
    rng,
  );
}

/** Sorts by kind, jokers last; stable for equal kinds (by id). */
export const sortTiles = (tiles: Tile[]) => tiles.sort((a, b) => a.kind - b.kind || a.id - b.id);

/** Counts of the 34 standard kinds (bonus tiles and jokers ignored). */
export function countKinds(tiles: readonly Tile[]): number[] {
  const c = new Array<number>(KINDS).fill(0);
  for (const t of tiles) if (t.kind < KINDS) c[t.kind]!++;
  return c;
}

/** A declared set on the table. `kind` is the set's tile (lowest tile for a chow). */
export interface Meld {
  type: 'chow' | 'pung' | 'kong' | 'quint';
  kind: number;
  tiles: Tile[];
  /** Concealed kong (classic): declared but kept hidden from the other players. */
  concealed: boolean;
}
