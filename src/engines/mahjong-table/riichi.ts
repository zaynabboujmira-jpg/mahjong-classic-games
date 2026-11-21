import { decompositions, isSevenPairs, isThirteenOrphans, type SetShape } from './classic';
import { EAST, GREEN, KINDS, RED, WHITE, isDragon, isHonor, isSuited, isTerminal, isTerminalOrHonor, isWind, rankOf, suitOf, type Meld, type Tile } from './tiles';

/*
 * Riichi (Japanese) Mahjong scoring: yaku, han and fu, dora, limits and
 * payments. A hand needs at least one yaku to win (dora alone do not count).
 *
 * Points: base = fu × 2^(han + 2), capped at mangan (2,000) from 5 han or
 * when the base would pass 2,000; haneman 3,000 (6-7 han), baiman 4,000
 * (8-10), sanbaiman 6,000 (11-12), yakuman 8,000 (13+ han or a yakuman hand).
 * Ron: the discarder pays base × 4 (× 6 when the winner is the dealer).
 * Tsumo: a dealer win costs each player base × 2; a non-dealer win costs the
 * dealer base × 2 and the others base × 1. Every payment rounds up to 100.
 */
export interface Yaku {
  name: string;
  han: number;
}

export interface RiichiContext {
  /** The tile that completed the hand. */
  winKind: number;
  selfDrawn: boolean;
  /** Seat wind index 0-3 and round wind index 0-3. */
  seat: number;
  prevailing: number;
  riichi: boolean;
  doubleRiichi?: boolean;
  ippatsu: boolean;
  /** Won on the last tile of the wall (haitei by self-draw, houtei by discard). */
  lastTile: boolean;
  /** Won on the replacement tile after a kong. */
  rinshan: boolean;
  /** Dora indicator kinds (the dora is the next tile in order). */
  doraIndicators: readonly number[];
  /** Ura-dora indicators, counted only after riichi. */
  uraIndicators: readonly number[];
}

export interface RiichiScore {
  han: number;
  fu: number;
  yaku: Yaku[];
  yakuman: number;
  /** Base points before the payment multipliers. */
  base: number;
  /** "Mangan", "Haneman"... or "" below the limits. */
  limit: string;
}

/** The dora that an indicator points to: next rank (9 → 1), winds E→S→W→N→E, dragons white→green→red→white. */
export function doraOf(indicator: number): number {
  if (isSuited(indicator)) return rankOf(indicator) === 9 ? indicator - 8 : indicator + 1;
  if (isWind(indicator)) return indicator === EAST + 3 ? EAST : indicator + 1;
  return indicator === WHITE ? GREEN : indicator === GREEN ? RED : WHITE;
}

const roundUp100 = (n: number) => Math.ceil(n / 100) * 100;

export function limitFor(han: number, fu: number, yakuman: number): { base: number; limit: string } {
  if (yakuman) return { base: 8000 * yakuman, limit: yakuman > 1 ? `${yakuman}× Yakuman` : 'Yakuman' };
  if (han >= 13) return { base: 8000, limit: 'Counted yakuman' };
  if (han >= 11) return { base: 6000, limit: 'Sanbaiman' };
  if (han >= 8) return { base: 4000, limit: 'Baiman' };
  if (han >= 6) return { base: 3000, limit: 'Haneman' };
  const base = fu * 2 ** (han + 2);
  if (han >= 5 || base >= 2000) return { base: 2000, limit: 'Mangan' };
  return { base, limit: '' };
}

/**
 * Score changes for a win, before riichi sticks and honba: who pays what.
 * `winner` and `discarder` are seats, `dealer` the dealer's seat.
 */
export function riichiPayments(base: number, winner: number, discarder: number, dealer: number): number[] {
  const pay = [0, 0, 0, 0];
  const dealerWins = winner === dealer;
  if (discarder >= 0) {
    const amount = roundUp100(base * (dealerWins ? 6 : 4));
    pay[discarder] = -amount;
    pay[winner] = amount;
    return pay;
  }
  for (let q = 0; q < 4; q++) {
    if (q === winner) continue;
    const amount = roundUp100(base * (dealerWins || q === dealer ? 2 : 1));
    pay[q] = -amount;
    pay[winner]! += amount;
  }
  return pay;
}

interface Arrangement {
  sets: (SetShape & { open: boolean; kong: boolean })[];
  pair: number;
  wait: 'ryanmen' | 'kanchan' | 'penchan' | 'tanki' | 'shanpon';
}

const valueHonor = (k: number, ctx: RiichiContext) => isDragon(k) || k === EAST + ctx.seat || k === EAST + ctx.prevailing;

/** Every reading of the hand: each decomposition, with the winning tile placed in each set it could have completed. */
function arrangements(counts: number[], melds: readonly Meld[], ctx: RiichiContext): Arrangement[] {
  const declared = melds.map((m) => ({ type: (m.type === 'chow' ? 'chow' : 'pung') as SetShape['type'], kind: m.kind, concealed: m.concealed, open: !m.concealed, kong: m.type === 'kong' }));
  const out: Arrangement[] = [];
  for (const d of decompositions(counts, 4 - melds.length)) {
    const own = d.sets.map((s) => ({ ...s, open: false, kong: false }));
    const w = ctx.winKind;
    if (d.pair === w) out.push({ sets: [...declared, ...own], pair: d.pair, wait: 'tanki' });
    own.forEach((s, i) => {
      let wait: Arrangement['wait'] | null = null;
      if (s.type === 'pung' && s.kind === w) wait = 'shanpon';
      if (s.type === 'chow' && w >= s.kind && w <= s.kind + 2) {
        if (w === s.kind + 1) wait = 'kanchan';
        else if ((w === s.kind + 2 && rankOf(s.kind) === 1) || (w === s.kind && rankOf(s.kind) === 7)) wait = 'penchan';
        else wait = 'ryanmen';
      }
      if (!wait) return;
      // A pung completed by a discard counts as open (for fu and concealed pungs).
      const sets = own.map((x, j) => (j === i && wait === 'shanpon' && !ctx.selfDrawn ? { ...x, open: true } : x));
      out.push({ sets: [...declared, ...sets], pair: d.pair, wait });
    });
  }
  return out;
}

function fuFor(a: Arrangement, closed: boolean, ctx: RiichiContext, pinfu: boolean): number {
  if (pinfu) return ctx.selfDrawn ? 20 : 30;
  let fu = 20;
  if (closed && !ctx.selfDrawn) fu += 10;
  if (ctx.selfDrawn) fu += 2;
  for (const s of a.sets) {
    if (s.type !== 'pung') continue;
    let f = isTerminalOrHonor(s.kind) ? 4 : 2;
    if (!s.open) f *= 2;
    if (s.kong) f *= 4;
    fu += f;
  }
  if (isDragon(a.pair)) fu += 2;
  if (a.pair === EAST + ctx.seat) fu += 2;
  if (a.pair === EAST + ctx.prevailing) fu += 2;
  if (a.wait === 'kanchan' || a.wait === 'penchan' || a.wait === 'tanki') fu += 2;
  fu = Math.ceil(fu / 10) * 10;
  return Math.max(fu, 30);
}

function doraCount(kinds: readonly number[], indicators: readonly number[]) {
  let n = 0;
  for (const ind of indicators) {
    const d = doraOf(ind);
    n += kinds.filter((k) => k === d).length;
  }
  return n;
}

/**
 * Scores a complete Riichi hand. `concealed` holds the concealed tiles
 * including the winning tile. Returns null when the tiles do not form a
 * winning hand or the hand has no yaku.
 */
export function scoreRiichi(concealed: readonly Tile[], melds: readonly Meld[], ctx: RiichiContext): RiichiScore | null {
  const counts = new Array<number>(KINDS).fill(0);
  for (const t of concealed) if (t.kind < KINDS) counts[t.kind]!++;
  const closed = melds.every((m) => m.concealed);
  const allKinds = [...concealed.map((t) => t.kind), ...melds.flatMap((m) => m.tiles.map((t) => t.kind))].filter((k) => k < KINDS);
  const suits = new Set(allKinds.filter(isSuited).map(suitOf));
  const hasHonor = allKinds.some(isHonor);

  // Situational yaku that do not depend on the shape.
  const situational: Yaku[] = [];
  if (ctx.doubleRiichi) situational.push({ name: 'Double riichi', han: 2 });
  else if (ctx.riichi) situational.push({ name: 'Riichi', han: 1 });
  if (ctx.riichi && ctx.ippatsu) situational.push({ name: 'Ippatsu', han: 1 });
  if (closed && ctx.selfDrawn) situational.push({ name: 'Menzen tsumo', han: 1 });
  if (ctx.lastTile) situational.push({ name: ctx.selfDrawn ? 'Haitei (last tile)' : 'Houtei (last discard)', han: 1 });
  if (ctx.rinshan) situational.push({ name: 'Rinshan (after a kong)', han: 1 });
  const tanyao = allKinds.every((k) => !isTerminalOrHonor(k));
  if (tanyao) situational.push({ name: 'Tanyao (all simples)', han: 1 });
  const flush: Yaku[] = [];
  if (suits.size === 1 && !hasHonor) flush.push({ name: 'Chinitsu (full flush)', han: closed ? 6 : 5 });
  else if (suits.size === 1 && hasHonor) flush.push({ name: 'Honitsu (half flush)', han: closed ? 3 : 2 });

  const dora = doraCount(allKinds, ctx.doraIndicators) + (ctx.riichi ? doraCount(allKinds, ctx.uraIndicators) : 0);
  const finish = (yaku: Yaku[], fu: number, yakuman = 0): RiichiScore | null => {
    if (!yaku.length) return null;
    const han = yaku.reduce((t, y) => t + y.han, 0) + (yakuman ? 0 : dora);
    const items = dora && !yakuman ? [...yaku, { name: `Dora ×${dora}`, han: dora }] : yaku;
    const { base, limit } = limitFor(han, fu, yakuman);
    return { han, fu, yaku: items, yakuman, base, limit };
  };

  const candidates: RiichiScore[] = [];
  // Yakuman shapes.
  if (!melds.length && isThirteenOrphans(counts)) candidates.push(finish([{ name: 'Kokushi musou (thirteen orphans)', han: 13 }], 30, 1)!);

  if (!melds.length && isSevenPairs(counts)) {
    const y: Yaku[] = [...situational, { name: 'Chiitoitsu (seven pairs)', han: 2 }, ...flush];
    if (allKinds.every(isTerminalOrHonor)) y.push({ name: 'Honroutou (all terminals and honours)', han: 2 });
    const s = finish(y, 25);
    if (s) candidates.push(s);
  }

  for (const a of arrangements(counts, melds, ctx)) {
    const sets = a.sets;
    const chows = sets.filter((s) => s.type === 'chow');
    const pungs = sets.filter((s) => s.type === 'pung');
    // Yakuman from sets.
    const ym: Yaku[] = [];
    const dragonPungs = pungs.filter((s) => isDragon(s.kind)).length;
    const windPungs = pungs.filter((s) => isWind(s.kind)).length;
    const concealedPungs = pungs.filter((s) => !s.open).length;
    if (dragonPungs === 3) ym.push({ name: 'Daisangen (big three dragons)', han: 13 });
    if (windPungs === 4) ym.push({ name: 'Daisuushii (big four winds)', han: 13 });
    else if (windPungs === 3 && isWind(a.pair)) ym.push({ name: 'Shousuushii (little four winds)', han: 13 });
    if (concealedPungs === 4) ym.push({ name: 'Suuankou (four concealed pungs)', han: 13 });
    if (allKinds.every(isTerminal)) ym.push({ name: 'Chinroutou (all terminals)', han: 13 });
    if (ym.length) {
      candidates.push(finish(ym, 30, ym.length)!);
      continue;
    }

    const y: Yaku[] = [...situational, ...flush];
    const pinfu = closed && chows.length === 4 && !valueHonor(a.pair, ctx) && a.wait === 'ryanmen';
    if (pinfu) y.push({ name: 'Pinfu (all sequences)', han: 1 });
    if (closed) {
      const same = new Map<number, number>();
      for (const c of chows) same.set(c.kind, (same.get(c.kind) ?? 0) + 1);
      const doubles = [...same.values()].reduce((t, n) => t + Math.floor(n / 2), 0);
      if (doubles === 2) y.push({ name: 'Ryanpeikou (two double sequences)', han: 3 });
      else if (doubles === 1) y.push({ name: 'Iipeikou (double sequence)', han: 1 });
    }
    for (const s of pungs) {
      if (isDragon(s.kind)) y.push({ name: `Yakuhai: ${s.kind === RED ? 'red' : s.kind === GREEN ? 'green' : 'white'} dragon`, han: 1 });
      if (s.kind === EAST + ctx.seat) y.push({ name: 'Yakuhai: seat wind', han: 1 });
      if (s.kind === EAST + ctx.prevailing) y.push({ name: 'Yakuhai: round wind', han: 1 });
    }
    if (dragonPungs === 2 && isDragon(a.pair)) y.push({ name: 'Shousangen (little three dragons)', han: 2 });
    if (pungs.length === 4) y.push({ name: 'Toitoi (all pungs)', han: 2 });
    if (concealedPungs === 3) y.push({ name: 'Sanankou (three concealed pungs)', han: 2 });
    if (pungs.filter((s) => s.kong).length >= 3) y.push({ name: 'Sankantsu (three kongs)', han: 2 });
    // Sanshoku: the same sequence in all three suits; ittsu: 1-9 in one suit.
    for (let r = 0; r < 7; r++) if ([0, 1, 2].every((su) => chows.some((c) => c.kind === su * 9 + r))) y.push({ name: 'Sanshoku (mixed triple sequence)', han: closed ? 2 : 1 });
    for (let su = 0; su < 3; su++) if ([0, 3, 6].every((r) => chows.some((c) => c.kind === su * 9 + r))) y.push({ name: 'Ittsu (straight)', han: closed ? 2 : 1 });
    // Chanta / junchan: every set and the pair include a terminal or honour.
    const outside = (s: { type: string; kind: number }) => (s.type === 'chow' ? rankOf(s.kind) === 1 || rankOf(s.kind) === 7 : isTerminalOrHonor(s.kind));
    if (chows.length && sets.every(outside) && isTerminalOrHonor(a.pair)) {
      if (hasHonor) y.push({ name: 'Chanta (terminal or honour in each set)', han: closed ? 2 : 1 });
      else y.push({ name: 'Junchan (terminal in each set)', han: closed ? 3 : 2 });
    }
    if (!chows.length && allKinds.every(isTerminalOrHonor)) y.push({ name: 'Honroutou (all terminals and honours)', han: 2 });
    const s = finish(y, fuFor(a, closed, ctx, pinfu));
    if (s) candidates.push(s);
  }
  // All honours: any complete shape (sets or seven pairs) made only of honour tiles.
  if (candidates.length && allKinds.every(isHonor)) candidates.push(finish([{ name: 'Tsuuiisou (all honours)', han: 13 }], 30, 1)!);
  if (!candidates.length) return null;
  return candidates.reduce((best, c) => (c.base > best.base || (c.base === best.base && c.han > best.han) ? c : best));
}

/** Yaku list for the in-game scoring table and the rules page. */
export const YAKU_TABLE: readonly Yaku[] = [
  { name: 'Riichi (declare ready with a closed hand)', han: 1 },
  { name: 'Ippatsu (win within one go-around of riichi)', han: 1 },
  { name: 'Menzen tsumo (self-draw, closed hand)', han: 1 },
  { name: 'Pinfu (all sequences, two-sided wait)', han: 1 },
  { name: 'Tanyao (all simples)', han: 1 },
  { name: 'Iipeikou (double sequence, closed)', han: 1 },
  { name: 'Yakuhai (dragon, seat or round wind pung)', han: 1 },
  { name: 'Haitei / Houtei (last tile)', han: 1 },
  { name: 'Rinshan (win after a kong)', han: 1 },
  { name: 'Chiitoitsu (seven pairs)', han: 2 },
  { name: 'Toitoi (all pungs)', han: 2 },
  { name: 'Sanankou (three concealed pungs)', han: 2 },
  { name: 'Sanshoku (same sequence in three suits)', han: 2 },
  { name: 'Ittsu (1-9 straight in one suit)', han: 2 },
  { name: 'Chanta (terminal or honour in every set)', han: 2 },
  { name: 'Shousangen (little three dragons)', han: 2 },
  { name: 'Honitsu (half flush)', han: 3 },
  { name: 'Junchan (terminal in every set)', han: 3 },
  { name: 'Ryanpeikou (two double sequences)', han: 3 },
  { name: 'Chinitsu (full flush)', han: 6 },
  { name: 'Yakuman: Kokushi, Suuankou, Daisangen, four winds, all honours, all terminals', han: 13 },
];
