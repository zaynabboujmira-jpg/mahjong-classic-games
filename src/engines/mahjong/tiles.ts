import type { TileFace } from './types';

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WINDS = [
  { glyph: '東', label: 'East wind' },
  { glyph: '南', label: 'South wind' },
  { glyph: '西', label: 'West wind' },
  { glyph: '北', label: 'North wind' },
];
const DRAGONS = [
  { glyph: '中', label: 'Red dragon' },
  { glyph: '發', label: 'Green dragon' },
  { glyph: '', label: 'White dragon' },
];
const FLOWERS = [
  { glyph: '梅', label: 'Plum flower' },
  { glyph: '蘭', label: 'Orchid flower' },
  { glyph: '菊', label: 'Chrysanthemum flower' },
  { glyph: '竹', label: 'Bamboo flower' },
];
const SEASONS = [
  { glyph: '春', label: 'Spring season' },
  { glyph: '夏', label: 'Summer season' },
  { glyph: '秋', label: 'Autumn season' },
  { glyph: '冬', label: 'Winter season' },
];

/** The 42 distinct faces of a standard set. */
export const FACES: TileFace[] = (() => {
  const out: TileFace[] = [];
  for (let r = 1; r <= 9; r++) {
    out.push({ id: `bamboo-${r}`, suit: 'bamboo', rank: r, matchKey: `bamboo-${r}`, glyph: String(r), label: `Bamboo ${r}` });
    out.push({ id: `character-${r}`, suit: 'character', rank: r, matchKey: `character-${r}`, glyph: CN_NUM[r - 1], label: `Character ${r}` });
    out.push({ id: `circle-${r}`, suit: 'circle', rank: r, matchKey: `circle-${r}`, glyph: String(r), label: `Circle ${r}` });
  }
  WINDS.forEach((w, i) => out.push({ id: `wind-${i + 1}`, suit: 'wind', rank: i + 1, matchKey: `wind-${i + 1}`, glyph: w.glyph, label: w.label }));
  DRAGONS.forEach((d, i) => out.push({ id: `dragon-${i + 1}`, suit: 'dragon', rank: i + 1, matchKey: `dragon-${i + 1}`, glyph: d.glyph, label: d.label }));
  FLOWERS.forEach((f, i) => out.push({ id: `flower-${i + 1}`, suit: 'flower', rank: i + 1, matchKey: 'flower', glyph: f.glyph, label: f.label }));
  SEASONS.forEach((s, i) => out.push({ id: `season-${i + 1}`, suit: 'season', rank: i + 1, matchKey: 'season', glyph: s.glyph, label: s.label }));
  return out;
})();

export const FACE_BY_ID = new Map(FACES.map((f) => [f.id, f]));

/**
 * The full 144-tile set as an ordered list of matching pairs (72 pairs).
 * Suits, winds and dragons: 4 copies each = 2 pairs. Flowers and seasons: 4 unique tiles = 2 pairs each.
 */
export function fullPairSet(): [TileFace, TileFace][] {
  const pairs: [TileFace, TileFace][] = [];
  for (const f of FACES) {
    if (f.suit === 'flower' || f.suit === 'season') continue;
    pairs.push([f, f], [f, f]);
  }
  const fl = FACES.filter((f) => f.suit === 'flower');
  const se = FACES.filter((f) => f.suit === 'season');
  pairs.push([fl[0], fl[1]], [fl[2], fl[3]], [se[0], se[1]], [se[2], se[3]]);
  return pairs;
}

export const matches = (a: TileFace, b: TileFace): boolean => a.matchKey === b.matchKey;
