import { FLOWER, GREEN, JOKER, RED, WHITE, isBonus, kindOf, type Meld, type Tile } from './tiles';

/*
 * American-style Mahjong played against this site's own hand card. The
 * official card of the National Mah Jongg League is copyrighted and changes
 * every year, so it is not reproduced here; this card follows the same
 * conventions (sections, jokers in groups of three or more, concealed and
 * exposed hands, values) with original hands.
 *
 * Hand notation, one token per group:
 *   FF       flowers            NNN EEE WWW SSS   winds
 *   1111a    literal number in suit a (a, b, c are three different suits)
 *   kkka     variable number k in suit a; l = k+1, m = k+2, o = k+3, p = k+4, q = k+5
 *   DDDa     the dragon that goes with suit a; DDDx = any one dragon
 */

export interface CardHand {
  id: string;
  section: string;
  pattern: string;
  note: string;
  value: number;
  /** Concealed: no exposures allowed (only the winning tile may be claimed). */
  concealed: boolean;
}

export const CARD: readonly CardHand[] = [
  { id: 'like-1', section: 'Like Numbers', pattern: 'FF kkkka kkkkb kkkkc', note: 'Any number, the same in all three suits', value: 25, concealed: false },
  { id: 'like-2', section: 'Like Numbers', pattern: 'FFF kkka kkkkb DDDDc', note: 'Any number in two suits, kong of the third suit’s dragon', value: 25, concealed: false },
  { id: 'run-1', section: 'Consecutive Run', pattern: 'FF kkka llla mmma oooa', note: 'Four consecutive numbers in one suit', value: 25, concealed: false },
  { id: 'run-2', section: 'Consecutive Run', pattern: 'kkkka llllb mmmmc FF', note: 'Three consecutive numbers, one per suit', value: 25, concealed: false },
  { id: 'run-3', section: 'Consecutive Run', pattern: 'F kka llla mmmma ooooa', note: 'Four consecutive numbers in one suit, growing', value: 30, concealed: false },
  { id: 'odd-1', section: '13579', pattern: '11a 333a 5555a 777a 99a', note: 'Odd numbers in one suit', value: 25, concealed: false },
  { id: 'odd-2', section: '13579', pattern: '111a 333a 555b 777b 99c', note: 'Odd numbers across three suits', value: 25, concealed: false },
  { id: 'odd-3', section: '13579', pattern: 'FFFF 1111a 5555b 99c', note: '1s, 5s and 9s in three suits', value: 30, concealed: false },
  { id: 'even-1', section: '2468', pattern: '222a 444a 6666a 8888a', note: 'Even numbers in one suit', value: 25, concealed: false },
  { id: 'even-2', section: '2468', pattern: 'FF 222a 444a 666b 888b', note: '2s and 4s in one suit, 6s and 8s in another', value: 25, concealed: false },
  { id: 'even-3', section: '2468', pattern: 'FF 2222a 4444b 66c 88c', note: 'Evens across three suits', value: 30, concealed: false },
  { id: 'wind-1', section: 'Winds & Dragons', pattern: 'NNN EEEE WWWW SSS', note: 'All four winds', value: 25, concealed: false },
  { id: 'wind-2', section: 'Winds & Dragons', pattern: 'FF DDDDa DDDDb DDDDc', note: 'Kongs of all three dragons', value: 30, concealed: false },
  { id: 'wind-3', section: 'Winds & Dragons', pattern: 'NN EEE WWW SS DDDDx', note: 'Winds with a kong of any dragon', value: 25, concealed: false },
  { id: 'wind-4', section: 'Winds & Dragons', pattern: 'FFF NNNN SSSS DDDx', note: 'North and South with any dragon', value: 30, concealed: false },
  { id: 'quint-1', section: 'Quints', pattern: 'FFFF kkkkka DDDDDa', note: 'Quint of any number and of its suit’s dragon', value: 40, concealed: false },
  { id: 'quint-2', section: 'Quints', pattern: 'kkkkka lllllb FFFF', note: 'Quints of two consecutive numbers in two suits', value: 45, concealed: false },
  { id: 'pairs-1', section: 'Singles & Pairs', pattern: 'NN EE WW SS kka kkb kkc', note: 'Pairs of each wind and of any number in three suits', value: 50, concealed: true },
  { id: 'pairs-2', section: 'Singles & Pairs', pattern: 'FF kka lla mma ooa ppa qqa', note: 'Six consecutive pairs in one suit', value: 50, concealed: true },
  { id: 'pairs-3', section: 'Singles & Pairs', pattern: '11a 33a 55a 77a 99a FF DDb', note: 'Odd pairs in one suit, with a pair of another suit’s dragon', value: 50, concealed: true },
];

export interface Group {
  /** Tile kind; all flowers count as kind FLOWER. */
  kind: number;
  size: number;
}

export interface Target {
  hand: CardHand;
  groups: Group[];
  /** e.g. "FF 4444 4444 4444" with suits, for hints. */
  label: string;
}

/** Dragon paired with each suit: Dots ↔ White (Soap), Bams ↔ Green, Craks ↔ Red. */
export const SUIT_DRAGON = [WHITE, GREEN, RED];
const WIND_KIND: Record<string, number> = { E: 27, S: 28, W: 29, N: 30 };
const VAR_OFFSET: Record<string, number> = { k: 0, l: 1, m: 2, o: 3, p: 4, q: 5 };
const SUIT_PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

interface Token {
  symbol: string;
  size: number;
  suit: string;
}

function parse(pattern: string): Token[] {
  return pattern.split(' ').map((tok) => {
    const suit = /[abcx]$/.test(tok) ? tok.slice(-1) : '';
    const body = suit ? tok.slice(0, -1) : tok;
    if (!body || [...body].some((ch) => ch !== body[0])) throw new Error(`Bad token ${tok}`);
    return { symbol: body[0]!, size: body.length, suit };
  });
}

function expand(hand: CardHand): Target[] {
  const tokens = parse(hand.pattern);
  const maxOffset = Math.max(-1, ...tokens.map((t) => VAR_OFFSET[t.symbol] ?? -1));
  const ks = maxOffset < 0 ? [0] : Array.from({ length: 9 - maxOffset }, (_, i) => i + 1);
  const out = new Map<string, Target>();
  for (const perm of SUIT_PERMS) {
    for (const k of ks) {
      for (const dragonX of [RED, GREEN, WHITE]) {
        const suitIdx = (s: string) => perm['abc'.indexOf(s)]!;
        const groups: Group[] = tokens.map((t) => {
          let kind: number;
          if (t.symbol === 'F') kind = FLOWER;
          else if (t.symbol in WIND_KIND) kind = WIND_KIND[t.symbol]!;
          else if (t.symbol === 'D') kind = t.suit === 'x' ? dragonX : SUIT_DRAGON[suitIdx(t.suit)]!;
          else if (/[1-9]/.test(t.symbol)) kind = kindOf(suitIdx(t.suit), Number(t.symbol));
          else kind = kindOf(suitIdx(t.suit), k + VAR_OFFSET[t.symbol]!);
          return { kind, size: t.size };
        });
        if (new Set(groups.map((g) => g.kind)).size !== groups.length) throw new Error(`Repeated kind in ${hand.id}`);
        const key = groups
          .map((g) => `${g.kind}x${g.size}`)
          .sort()
          .join(',');
        if (!out.has(key)) out.set(key, { hand, groups, label: labelOf(groups) });
      }
    }
  }
  return [...out.values()];
}

function labelOf(groups: readonly Group[]): string {
  const sym = (k: number) => (k === FLOWER ? 'F' : k < 27 ? String((k % 9) + 1) : 'ESWN'[k - 27] ?? ['R', 'G', '0'][k - 31]!);
  const suit = (k: number) => (k < 27 ? ['D', 'B', 'C'][Math.floor(k / 9)]! : '');
  return groups.map((g) => sym(g.kind).repeat(g.size) + (suit(g.kind) ? ` ${suit(g.kind)}` : '')).join(' · ');
}

/** Every concrete hand the card allows (a few hundred). */
export const TARGETS: readonly Target[] = CARD.flatMap(expand);

/** Group kind of a tile: every flower counts as FLOWER. */
export const groupKind = (k: number) => (isBonus(k) ? FLOWER : k);

/** Natural tile counts by group kind (jokers excluded) and the number of jokers. */
export function countHand(tiles: readonly Tile[]): { counts: number[]; jokers: number } {
  const counts = new Array<number>(43).fill(0);
  let jokers = 0;
  for (const t of tiles) {
    if (t.kind === JOKER) jokers++;
    else counts[groupKind(t.kind)]!++;
  }
  return { counts, jokers };
}

/** An exposure as a group: its kind and size. */
export const exposureGroup = (m: Meld): Group => ({ kind: m.kind, size: m.tiles.length });

/**
 * Tiles still needed to complete `target` from this hand. Exposures must each
 * match one of the target's groups exactly. Jokers fill only groups of three
 * or more; singles and pairs need natural tiles. Infinity if impossible.
 */
export function distance(target: Target, counts: readonly number[], jokers: number, exposures: readonly Group[]): number {
  if (exposures.length && target.hand.concealed) return Infinity;
  let remaining = target.groups;
  if (exposures.length) {
    remaining = target.groups.slice();
    for (const e of exposures) {
      const i = remaining.findIndex((g) => g.kind === e.kind && g.size === e.size);
      if (i < 0) return Infinity;
      remaining.splice(i, 1);
    }
  }
  let small = 0;
  let big = 0;
  for (const g of remaining) {
    const deficit = g.size - Math.min(counts[g.kind]!, g.size);
    if (g.size >= 3) big += deficit;
    else small += deficit;
  }
  return small + Math.max(0, big - jokers);
}

export interface Ranked {
  target: Target;
  distance: number;
}

/** Targets sorted by distance (then value), best first. */
export function rankTargets(concealed: readonly Tile[], exposures: readonly Meld[], limit = 5): Ranked[] {
  const { counts, jokers } = countHand(concealed);
  const groups = exposures.map(exposureGroup);
  const ranked: Ranked[] = [];
  for (const target of TARGETS) {
    const d = distance(target, counts, jokers, groups);
    if (d < Infinity) ranked.push({ target, distance: d });
  }
  ranked.sort((a, b) => a.distance - b.distance || b.target.hand.value - a.target.hand.value);
  return ranked.slice(0, limit);
}

/** The best card hand completed by these 14 tiles (concealed + exposed), or null. */
export function americanWin(concealed: readonly Tile[], exposures: readonly Meld[]): Target | null {
  const total = concealed.length + exposures.reduce((n, m) => n + m.tiles.length, 0);
  if (total !== 14) return null;
  const best = rankTargets(concealed, exposures, 1)[0];
  return best && best.distance === 0 ? best.target : null;
}

/** Score of a win: the hand's value, doubled when no jokers were used (Singles & Pairs excepted). */
export function americanValue(target: Target, concealed: readonly Tile[], exposures: readonly Meld[]): { value: number; jokerless: boolean } {
  const jokerless = ![...concealed, ...exposures.flatMap((m) => m.tiles)].some((t) => t.kind === JOKER);
  const bonus = jokerless && !target.hand.concealed;
  return { value: target.hand.value * (bonus ? 2 : 1), jokerless: bonus };
}

/** Display tokens of a card line: text plus which suit (0-2, by the card's colour code) it belongs to. */
export function cardTokens(hand: CardHand): { text: string; suit: number | null }[] {
  return parse(hand.pattern).map((t) => {
    const text =
      t.symbol in VAR_OFFSET
        ? String(VAR_OFFSET[t.symbol]! + 1).repeat(t.size)
        : t.symbol === 'D'
          ? 'D'.repeat(t.size)
          : t.symbol.repeat(t.size);
    return { text, suit: t.suit && t.suit !== 'x' ? 'abc'.indexOf(t.suit) : null };
  });
}
