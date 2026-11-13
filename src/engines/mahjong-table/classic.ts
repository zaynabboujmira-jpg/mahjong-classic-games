import { EAST, KINDS, RED, isDragon, isHonor, isSuited, isTerminalOrHonor, isWind, rankOf, suitOf, type Meld, type Tile } from './tiles';

/*
 * Hong Kong / Chinese Classic hand analysis: winning shapes, shanten (how
 * many tiles from ready) for the bots, and faan scoring.
 */

export interface SetShape {
  type: 'chow' | 'pung';
  kind: number;
  concealed: boolean;
}

export interface Decomposition {
  pair: number;
  sets: SetShape[];
}

const ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

/** Every way to split concealed counts into one pair plus `setsNeeded` sets. */
export function decompositions(counts: readonly number[], setsNeeded: number): Decomposition[] {
  const out: Decomposition[] = [];
  const c = counts.slice();
  const sets: SetShape[] = [];
  const rec = (start: number, pair: number) => {
    let i = start;
    while (i < KINDS && c[i] === 0) i++;
    if (i >= KINDS) {
      if (sets.length === setsNeeded) out.push({ pair, sets: sets.slice() });
      return;
    }
    if (sets.length >= setsNeeded) return;
    if (c[i]! >= 3) {
      c[i]! -= 3;
      sets.push({ type: 'pung', kind: i, concealed: true });
      rec(i, pair);
      sets.pop();
      c[i]! += 3;
    }
    if (isSuited(i) && rankOf(i) <= 7 && c[i + 1]! > 0 && c[i + 2]! > 0) {
      c[i]!--;
      c[i + 1]!--;
      c[i + 2]!--;
      sets.push({ type: 'chow', kind: i, concealed: true });
      rec(i, pair);
      sets.pop();
      c[i]!++;
      c[i + 1]!++;
      c[i + 2]!++;
    }
  };
  for (let p = 0; p < KINDS; p++) {
    if (c[p]! < 2) continue;
    c[p]! -= 2;
    rec(0, p);
    c[p]! += 2;
  }
  return out;
}

export const isSevenPairs = (counts: readonly number[]) => counts.filter((n) => n === 2).length === 7;
export const isThirteenOrphans = (counts: readonly number[]) =>
  ORPHANS.every((k) => counts[k]! >= 1) && ORPHANS.some((k) => counts[k] === 2) && counts.reduce((a, b) => a + b, 0) === 14;

/** True when concealed counts plus `melds` declared sets form a complete hand. */
export function isWinningShape(counts: readonly number[], melds: number): boolean {
  if (melds === 0 && (isSevenPairs(counts) || isThirteenOrphans(counts))) return true;
  return decompositions(counts, 4 - melds).length > 0;
}

/**
 * Shanten: the number of tile changes needed to be ready (0 = ready,
 * -1 = complete). Minimum over the standard shape, seven pairs and thirteen
 * orphans (the last two only with no declared sets).
 */
export function shanten(counts: readonly number[], melds: number): number {
  let best = standardShanten(counts, melds);
  if (melds === 0) {
    let pairs = 0;
    let kinds = 0;
    for (let k = 0; k < KINDS; k++) {
      if (counts[k]! >= 2) pairs++;
      if (counts[k]! >= 1) kinds++;
    }
    best = Math.min(best, 6 - pairs + Math.max(0, 7 - kinds));
    let orphanKinds = 0;
    let orphanPair = 0;
    for (const k of ORPHANS) {
      if (counts[k]! >= 1) orphanKinds++;
      if (counts[k]! >= 2) orphanPair = 1;
    }
    best = Math.min(best, 13 - orphanKinds - orphanPair);
  }
  return best;
}

function standardShanten(counts: readonly number[], melds: number): number {
  const c = counts.slice();
  let best = 8;
  let sets = melds;
  let partials = 0;
  let pair = 0;
  const rec = (start: number) => {
    let i = start;
    while (i < KINDS && c[i] === 0) i++;
    if (i >= KINDS) {
      const p = Math.min(partials, 4 - sets);
      const s = 8 - 2 * sets - p - pair;
      if (s < best) best = s;
      return;
    }
    const suited = isSuited(i);
    const r = rankOf(i);
    if (c[i]! >= 3) {
      c[i]! -= 3;
      sets++;
      rec(i);
      sets--;
      c[i]! += 3;
    }
    if (suited && r <= 7 && c[i + 1]! > 0 && c[i + 2]! > 0) {
      c[i]!--;
      c[i + 1]!--;
      c[i + 2]!--;
      sets++;
      rec(i);
      sets--;
      c[i]!++;
      c[i + 1]!++;
      c[i + 2]!++;
    }
    if (c[i]! >= 2) {
      if (!pair) {
        c[i]! -= 2;
        pair = 1;
        rec(i);
        pair = 0;
        c[i]! += 2;
      }
      if (sets + partials < 4) {
        c[i]! -= 2;
        partials++;
        rec(i);
        partials--;
        c[i]! += 2;
      }
    }
    if (suited && sets + partials < 4) {
      if (r <= 8 && c[i + 1]! > 0) {
        c[i]!--;
        c[i + 1]!--;
        partials++;
        rec(i);
        partials--;
        c[i]!++;
        c[i + 1]!++;
      }
      if (r <= 7 && c[i + 2]! > 0) {
        c[i]!--;
        c[i + 2]!--;
        partials++;
        rec(i);
        partials--;
        c[i]!++;
        c[i + 2]!++;
      }
    }
    c[i]!--;
    rec(i);
    c[i]!++;
  };
  rec(0);
  return best;
}

// ---------------------------------------------------------------- scoring

export interface WinContext {
  selfDrawn: boolean;
  /** Seat wind index 0-3 (East, South, West, North). */
  seat: number;
  /** Prevailing (round) wind index 0-3. */
  prevailing: number;
  /** Won on the replacement tile after a kong. */
  afterKong: boolean;
  /** Won on the last tile of the wall. */
  lastTile: boolean;
  /** Bonus tiles collected (Hong Kong rules), or null when flowers are not used. */
  flowers: readonly Tile[] | null;
}

export interface Faan {
  name: string;
  faan: number;
}

export interface Score {
  faan: number;
  items: Faan[];
}

export const FAAN_LIMIT = 13;

/** Faan items shown in the game's scoring table (and on the rules pages). */
export const FAAN_TABLE: readonly Faan[] = [
  { name: 'Self-drawn win', faan: 1 },
  { name: 'Concealed hand', faan: 1 },
  { name: 'All chows', faan: 1 },
  { name: 'Dragon pung (each)', faan: 1 },
  { name: 'Seat wind pung', faan: 1 },
  { name: 'Round wind pung', faan: 1 },
  { name: 'Win on a kong replacement', faan: 1 },
  { name: 'Win on the last tile', faan: 1 },
  { name: 'All pungs', faan: 3 },
  { name: 'Half flush (one suit plus honours)', faan: 3 },
  { name: 'Seven pairs', faan: 4 },
  { name: 'Small three dragons', faan: 5 },
  { name: 'Small four winds', faan: 6 },
  { name: 'Full flush (one suit only)', faan: 7 },
  { name: 'Big three dragons', faan: 8 },
  { name: 'All honours', faan: 10 },
  { name: 'Big four winds', faan: 13 },
  { name: 'Thirteen orphans', faan: 13 },
];

function flushItems(kinds: readonly number[]): Faan[] {
  const suits = new Set(kinds.filter(isSuited).map(suitOf));
  const honors = kinds.some(isHonor);
  if (suits.size === 0) return [{ name: 'All honours', faan: 10 }];
  if (suits.size > 1) return [];
  return honors ? [{ name: 'Half flush', faan: 3 }] : [{ name: 'Full flush', faan: 7 }];
}

function flowerItems(flowers: readonly Tile[] | null, seat: number): Faan[] {
  if (!flowers) return [];
  if (!flowers.length) return [{ name: 'No flowers', faan: 1 }];
  const out: Faan[] = [];
  const own = flowers.filter((t) => (t.kind - 34) % 4 === seat).length;
  if (own) out.push({ name: own === 1 ? 'Own flower' : 'Own flowers', faan: own });
  for (const start of [34, 38]) {
    if ([0, 1, 2, 3].every((k) => flowers.some((t) => t.kind === start + k))) out.push({ name: start === 34 ? 'All four flowers' : 'All four seasons', faan: 2 });
  }
  return out;
}

const sum = (items: readonly Faan[]) => items.reduce((a, b) => a + b.faan, 0);

/**
 * Scores a complete hand: `concealed` holds the 14 (or fewer, with melds)
 * concealed tiles including the winning tile. Returns null when the tiles do
 * not form a winning hand. The best-scoring decomposition is used.
 */
export function scoreClassic(concealed: readonly Tile[], melds: readonly Meld[], ctx: WinContext): Score | null {
  const counts = new Array<number>(KINDS).fill(0);
  for (const t of concealed) if (t.kind < KINDS) counts[t.kind]!++;
  const allKinds = [...concealed.map((t) => t.kind), ...melds.flatMap((m) => m.tiles.map((t) => t.kind))].filter((k) => k < KINDS);
  const open = melds.some((m) => !m.concealed);
  const common: Faan[] = [];
  if (ctx.selfDrawn) common.push({ name: 'Self-drawn', faan: 1 });
  if (!open) common.push({ name: 'Concealed hand', faan: 1 });
  if (ctx.afterKong) common.push({ name: 'Win on a kong replacement', faan: 1 });
  if (ctx.lastTile) common.push({ name: 'Win on the last tile', faan: 1 });
  common.push(...flowerItems(ctx.flowers, ctx.seat));

  const candidates: Faan[][] = [];
  if (!melds.length && isThirteenOrphans(counts)) candidates.push([{ name: 'Thirteen orphans', faan: 13 }]);
  if (!melds.length && isSevenPairs(counts)) candidates.push([...common, { name: 'Seven pairs', faan: 4 }, ...flushItems(allKinds)]);

  const declared: SetShape[] = melds.map((m) => ({ type: m.type === 'chow' ? 'chow' : 'pung', kind: m.kind, concealed: m.concealed }));
  for (const d of decompositions(counts, 4 - melds.length)) {
    const sets = [...declared, ...d.sets];
    const items: Faan[] = [...common];
    const pungs = sets.filter((s) => s.type === 'pung');
    if (sets.every((s) => s.type === 'chow')) items.push({ name: 'All chows', faan: 1 });
    if (pungs.length === 4) items.push({ name: 'All pungs', faan: 3 });
    items.push(...flushItems(allKinds));

    const dragonPungs = pungs.filter((s) => isDragon(s.kind)).length;
    const windPungs = pungs.filter((s) => isWind(s.kind)).length;
    if (dragonPungs === 3) items.push({ name: 'Big three dragons', faan: 8 });
    else if (dragonPungs === 2 && isDragon(d.pair)) items.push({ name: 'Small three dragons', faan: 5 });
    else for (const s of pungs) if (isDragon(s.kind)) items.push({ name: `${['Red', 'Green', 'White'][s.kind - RED]} dragon pung`, faan: 1 });

    if (windPungs === 4) items.push({ name: 'Big four winds', faan: 13 });
    else if (windPungs === 3 && isWind(d.pair)) items.push({ name: 'Small four winds', faan: 6 });
    else {
      for (const s of pungs) {
        if (s.kind === EAST + ctx.seat) items.push({ name: 'Seat wind pung', faan: 1 });
        if (s.kind === EAST + ctx.prevailing) items.push({ name: 'Round wind pung', faan: 1 });
      }
    }
    candidates.push(items);
  }
  if (!candidates.length) return null;
  let bestItems = candidates[0]!;
  for (const c of candidates) if (sum(c) > sum(bestItems)) bestItems = c;
  return { faan: Math.min(FAAN_LIMIT, sum(bestItems)), items: bestItems };
}

/** Base points for a faan count (doubling, flattening at the top). */
export const FAAN_POINTS = [1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384];
export const pointsFor = (faan: number) => FAAN_POINTS[Math.min(FAAN_LIMIT, Math.max(0, faan))]!;

/** All-terminal-or-honour check used by the bots to value tiles. */
export const isOrphanKind = isTerminalOrHonor;
