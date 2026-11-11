import type { Face, Suit } from './types';

const SUIT_NAMES: Record<'dots' | 'bamboo' | 'characters', string> = {
  dots: 'Dots',
  bamboo: 'Bamboo',
  characters: 'Characters',
};
const WINDS = ['East', 'South', 'West', 'North'] as const;
const DRAGONS = ['Red', 'Green', 'White'] as const;
const FLOWERS = ['Plum', 'Orchid', 'Chrysanthemum', 'Bamboo'] as const;
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;

function face(suit: Suit, rank: number, label: string, matchKey?: string): Face {
  const id = `${suit}-${rank}`;
  return { id, suit, rank, label, matchKey: matchKey ?? id };
}

/** The 42 distinct face designs of a standard 144-tile set. */
export const FACES: readonly Face[] = [
  ...(['dots', 'bamboo', 'characters'] as const).flatMap((suit) =>
    Array.from({ length: 9 }, (_, i) => face(suit, i + 1, `${i + 1} of ${SUIT_NAMES[suit]}`)),
  ),
  ...WINDS.map((w, i) => face('wind', i + 1, `${w} Wind`)),
  ...DRAGONS.map((d, i) => face('dragon', i + 1, `${d} Dragon`)),
  ...FLOWERS.map((f, i) => face('flower', i + 1, `${f} flower`, 'flower')),
  ...SEASONS.map((s, i) => face('season', i + 1, `${s} season`, 'season')),
];

const byId = new Map(FACES.map((f) => [f.id, f]));
export function faceById(id: string): Face {
  const f = byId.get(id);
  if (!f) throw new Error(`Unknown tile face ${id}`);
  return f;
}

/**
 * The full set as 72 matching pairs: every suit/honour face appears 4 times
 * (two pairs); the four flowers form two pairs, as do the four seasons.
 */
export function standardPairs(): [Face, Face][] {
  const pairs: [Face, Face][] = [];
  for (const f of FACES) {
    if (f.suit === 'flower' || f.suit === 'season') continue;
    pairs.push([f, f], [f, f]);
  }
  for (const suit of ['flower', 'season'] as const) {
    const group = FACES.filter((f) => f.suit === suit);
    pairs.push([group[0]!, group[1]!], [group[2]!, group[3]!]);
  }
  return pairs;
}

export const canMatch = (a: Face, b: Face): boolean => a.matchKey === b.matchKey;
