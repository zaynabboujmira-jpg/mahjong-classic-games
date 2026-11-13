import { createRng, type Rng } from '../core/rng';
import { americanValue, americanWin, groupKind, rankTargets, type Target } from './american';
import { pointsFor, scoreClassic, type Faan } from './classic';
import { EAST, JOKER, WINDS, buildWall, isBonus, isSuited, rankOf, sortTiles, tileName, type Meld, type Tile } from './tiles';

export type Variant = 'hong-kong' | 'chinese' | 'american';

export interface Rules {
  variant: Variant;
  name: string;
  american: boolean;
  /** Classic: flowers and seasons are bonus tiles. American: 8 flowers used in hands. */
  flowers: boolean;
  jokers: boolean;
  /** Minimum faan to declare a win (classic only). */
  minFaan: number;
  chow: boolean;
}

export const RULES: Record<Variant, Rules> = {
  'hong-kong': { variant: 'hong-kong', name: 'Hong Kong', american: false, flowers: true, jokers: false, minFaan: 3, chow: true },
  chinese: { variant: 'chinese', name: 'Chinese Classic', american: false, flowers: false, jokers: false, minFaan: 0, chow: true },
  american: { variant: 'american', name: 'American', american: true, flowers: true, jokers: true, minFaan: 0, chow: false },
};

export interface Seat {
  hand: Tile[];
  melds: Meld[];
  /** Classic bonus tiles (flowers and seasons) set aside. */
  bonus: Tile[];
  /** Discards still lying in front of the player (claimed tiles are removed). */
  river: Tile[];
}

export type Claim = { type: 'win' } | { type: 'pung' | 'kong' | 'quint'; jokers: number } | { type: 'chow'; start: number };

export interface Result {
  kind: 'win' | 'draw';
  winner: number;
  discarder: number;
  selfDrawn: boolean;
  /** Classic. */
  faan: number;
  items: Faan[];
  /** American. */
  target: Target | null;
  jokerless: boolean;
  /** Score change per seat (sums to zero). */
  payments: number[];
}

export type Dir = 'right' | 'across' | 'left';
export interface CharlestonState {
  stage: 'first' | 'vote' | 'second' | 'courtesy' | 'done';
  /** Index into the stage's passes. */
  pass: number;
  chosen: (Tile[] | null)[];
}
const FIRST: Dir[] = ['right', 'across', 'left'];
const SECOND: Dir[] = ['left', 'across', 'right'];
const OFFSET: Record<Dir, number> = { right: 1, across: 2, left: 3 };

export type Wait =
  | { type: 'charleston'; players: number[]; stage: CharlestonState['stage']; dir: Dir }
  | { type: 'turn'; player: number }
  | { type: 'claim'; players: number[] }
  | { type: 'over' };

export interface GameEvent {
  player: number;
  kind: 'deal' | 'draw' | 'discard' | 'claim' | 'kong' | 'swap' | 'flower' | 'win' | 'draw-game' | 'charleston';
  text: string;
}

export interface GameOptions {
  dealer?: number;
  /** Round wind 0-3. */
  prevailing?: number;
}

export const SEAT_NAMES = ['You', 'Right', 'Across', 'Left'];

/**
 * One hand of four-player Mahjong. Seat 0 is the human; seats 1-3 sit to the
 * right, across and left, and play passes counter-clockwise 0 → 1 → 2 → 3.
 * The engine is synchronous and deterministic for a seed; it never decides
 * for anyone, it only offers the legal actions and applies chosen ones.
 */
export class TableGame {
  readonly rules: Rules;
  readonly seats: Seat[];
  readonly dealer: number;
  readonly prevailing: number;
  readonly events: GameEvent[] = [];
  private wall: Tile[];
  private front = 0;
  private back: number;
  current: number;
  phase: 'charleston' | 'turn' | 'claim' | 'over' = 'turn';
  lastDiscard: { tile: Tile; from: number } | null = null;
  /** Claim answers collected for the last discard (undefined = still deciding). */
  private answers: (Claim | null | undefined)[] = [null, null, null, null];
  private options: Claim[][] = [[], [], [], []];
  /** The current player's last tile came from the back of the wall after a kong. */
  afterKong = false;
  /** Id of the tile the current player just drew (for highlighting). */
  drawnId = -1;
  charleston: CharlestonState | null = null;
  result: Result | null = null;
  readonly totalTiles: number;

  constructor(rules: Rules, seed: string | Rng, opts: GameOptions = {}) {
    this.rules = rules;
    this.dealer = opts.dealer ?? 0;
    this.prevailing = opts.prevailing ?? 0;
    const rng = typeof seed === 'string' ? createRng(`table:${rules.variant}:${seed}`) : seed;
    this.wall = buildWall({ flowers: rules.flowers, jokers: rules.jokers }, rng);
    this.totalTiles = this.wall.length;
    this.back = this.wall.length - 1;
    this.seats = Array.from({ length: 4 }, () => ({ hand: [], melds: [], bonus: [], river: [] }));
    this.current = this.dealer;

    for (let round = 0; round < 13; round++) for (let k = 0; k < 4; k++) this.seats[(this.dealer + k) % 4]!.hand.push(this.take()!);
    this.seats[this.dealer]!.hand.push(this.take()!);
    if (!rules.american) for (let k = 0; k < 4; k++) this.replaceBonus((this.dealer + k) % 4);
    this.seats.forEach((s) => sortTiles(s.hand));
    this.log(this.dealer, 'deal', `${SEAT_NAMES[this.dealer]} ${this.dealer === 0 ? 'are' : 'is'} East and start${this.dealer === 0 ? '' : 's'}.`);

    if (rules.american) {
      this.phase = 'charleston';
      this.charleston = { stage: 'first', pass: 0, chosen: [null, null, null, null] };
    }
  }

  // ------------------------------------------------------------ basics

  get wallCount() {
    return Math.max(0, this.back - this.front + 1);
  }
  seatWind = (p: number) => (p - this.dealer + 4) % 4;
  windName = (p: number) => WINDS[this.seatWind(p)]!;
  private take(fromBack = false): Tile | null {
    if (this.front > this.back) return null;
    return fromBack ? this.wall[this.back--]! : this.wall[this.front++]!;
  }
  private log(player: number, kind: GameEvent['kind'], text: string) {
    this.events.push({ player, kind, text });
  }
  private name = (k: number) => tileName(k, this.rules.american);
  private who = (p: number) => (p === 0 ? 'You' : SEAT_NAMES[p]!);
  private verb = (p: number, you: string, they: string) => (p === 0 ? you : they);

  /** Classic: sets aside bonus tiles and replaces them from the back of the wall. */
  private replaceBonus(p: number): boolean {
    const seat = this.seats[p]!;
    for (let i = seat.hand.findIndex((t) => isBonus(t.kind)); i >= 0; i = seat.hand.findIndex((t) => isBonus(t.kind))) {
      const [b] = seat.hand.splice(i, 1);
      seat.bonus.push(b!);
      const r = this.take(true);
      if (!r) return false;
      seat.hand.push(r);
      this.drawnId = r.id;
      if (this.phase !== 'charleston') this.log(p, 'flower', `${this.who(p)} ${this.verb(p, 'draw', 'draws')} a bonus tile: ${this.name(b!.kind)}.`);
    }
    return true;
  }

  /** Every tile currently in play, for conservation checks. */
  allTiles(): Tile[] {
    const out: Tile[] = this.wall.slice(this.front, this.back + 1);
    for (const s of this.seats) out.push(...s.hand, ...s.bonus, ...s.river, ...s.melds.flatMap((m) => m.tiles));
    return out;
  }

  waiting(): Wait {
    if (this.phase === 'over') return { type: 'over' };
    if (this.phase === 'charleston') {
      const c = this.charleston!;
      const players = c.stage === 'vote' ? [0] : [0, 1, 2, 3].filter((p) => !c.chosen[p]);
      return { type: 'charleston', players, stage: c.stage, dir: this.charlestonDir() };
    }
    if (this.phase === 'claim') return { type: 'claim', players: [0, 1, 2, 3].filter((p) => this.answers[p] === undefined) };
    return { type: 'turn', player: this.current };
  }

  // ------------------------------------------------------------ Charleston (American)

  charlestonDir(): Dir {
    const c = this.charleston;
    if (!c) return 'right';
    if (c.stage === 'first') return FIRST[c.pass]!;
    if (c.stage === 'second') return SECOND[c.pass]!;
    return 'across';
  }

  /** Tiles a player passes in the current Charleston step: 3 (0-3 in the courtesy pass); never jokers. */
  submitPass(p: number, ids: readonly number[]): boolean {
    const c = this.charleston;
    if (this.phase !== 'charleston' || !c || c.stage === 'vote' || c.stage === 'done' || c.chosen[p]) return false;
    const hand = this.seats[p]!.hand;
    const tiles = ids.map((id) => hand.find((t) => t.id === id));
    if (tiles.some((t) => !t || t.kind === JOKER) || new Set(ids).size !== ids.length) return false;
    if (c.stage === 'courtesy' ? ids.length > 3 : ids.length !== 3) return false;
    c.chosen[p] = tiles as Tile[];
    if (c.chosen.every(Boolean)) this.exchange();
    return true;
  }

  /** The human's choice to play the optional second Charleston (bots always agree). */
  voteSecond(yes: boolean): boolean {
    const c = this.charleston;
    if (!c || c.stage !== 'vote') return false;
    c.stage = yes ? 'second' : 'courtesy';
    c.pass = 0;
    this.log(0, 'charleston', yes ? 'Second Charleston: pass left, across, then right.' : 'Second Charleston skipped. Courtesy pass across: 0 to 3 tiles.');
    return true;
  }

  private exchange() {
    const c = this.charleston!;
    const dir = this.charlestonDir();
    const chosen = c.chosen as Tile[][];
    if (c.stage === 'courtesy') {
      // Partners across agree on the smaller number of tiles.
      for (const [a, b] of [
        [0, 2],
        [1, 3],
      ] as const) {
        const n = Math.min(chosen[a]!.length, chosen[b]!.length);
        chosen[a] = chosen[a]!.slice(0, n);
        chosen[b] = chosen[b]!.slice(0, n);
      }
    }
    for (let p = 0; p < 4; p++) {
      const hand = this.seats[p]!.hand;
      for (const t of chosen[p]!) hand.splice(hand.indexOf(t), 1);
    }
    for (let p = 0; p < 4; p++) this.seats[(p + OFFSET[dir]) % 4]!.hand.push(...chosen[p]!);
    this.seats.forEach((s) => sortTiles(s.hand));
    this.log(0, 'charleston', c.stage === 'courtesy' ? `Courtesy pass: ${chosen[0]!.length} tile${chosen[0]!.length === 1 ? '' : 's'} across.` : `Passed 3 tiles ${dir}.`);
    c.chosen = [null, null, null, null];
    c.pass++;
    if (c.stage === 'first' && c.pass === 3) c.stage = 'vote';
    else if (c.stage === 'second' && c.pass === 3) {
      c.stage = 'courtesy';
      c.pass = 0;
    } else if (c.stage === 'courtesy') {
      c.stage = 'done';
      this.phase = 'turn';
      this.current = this.dealer;
      this.log(this.dealer, 'deal', `Charleston over. ${this.who(this.dealer)} ${this.verb(this.dealer, 'discard', 'discards')} first.`);
    }
  }

  // ------------------------------------------------------------ the player on turn

  private winContext(p: number, selfDrawn: boolean) {
    return {
      selfDrawn,
      seat: this.seatWind(p),
      prevailing: this.prevailing,
      afterKong: selfDrawn && this.afterKong,
      lastTile: this.wallCount === 0,
      flowers: this.rules.flowers ? this.seats[p]!.bonus : null,
    };
  }

  /** Can the player on turn declare a win with the tiles they hold? */
  canSelfWin(p: number): boolean {
    if (this.phase !== 'turn' || this.current !== p) return false;
    const s = this.seats[p]!;
    if (this.rules.american) return !!americanWin(s.hand, s.melds);
    const score = scoreClassic(s.hand, s.melds, this.winContext(p, true));
    return !!score && score.faan >= this.rules.minFaan;
  }

  /** Classic: kinds the player on turn can declare a kong of (concealed, or adding to a pung). */
  kongOptions(p: number): number[] {
    if (this.rules.american || this.phase !== 'turn' || this.current !== p || this.wallCount === 0) return [];
    const s = this.seats[p]!;
    const out = new Set<number>();
    for (const t of s.hand) {
      if (s.hand.filter((u) => u.kind === t.kind).length === 4) out.add(t.kind);
      if (s.melds.some((m) => m.type === 'pung' && m.kind === t.kind)) out.add(t.kind);
    }
    return [...out];
  }

  /** American: jokers in any exposure that the player on turn can take by giving the matching tile. */
  jokerSwaps(p: number): { owner: number; meld: number; tileId: number; kind: number }[] {
    if (!this.rules.american || this.phase !== 'turn' || this.current !== p) return [];
    const out: { owner: number; meld: number; tileId: number; kind: number }[] = [];
    this.seats.forEach((s, owner) =>
      s.melds.forEach((m, mi) => {
        if (!m.tiles.some((t) => t.kind === JOKER)) return;
        const natural = this.seats[p]!.hand.find((t) => groupKind(t.kind) === m.kind);
        if (natural) out.push({ owner, meld: mi, tileId: natural.id, kind: m.kind });
      }),
    );
    return out;
  }

  swapJoker(p: number, owner: number, meldIndex: number): boolean {
    const swap = this.jokerSwaps(p).find((s) => s.owner === owner && s.meld === meldIndex);
    if (!swap) return false;
    const meld = this.seats[owner]!.melds[meldIndex]!;
    const hand = this.seats[p]!.hand;
    const natural = hand.splice(
      hand.findIndex((t) => t.id === swap.tileId),
      1,
    )[0]!;
    const ji = meld.tiles.findIndex((t) => t.kind === JOKER);
    const joker = meld.tiles[ji]!;
    meld.tiles[ji] = natural;
    hand.push(joker);
    sortTiles(hand);
    this.log(p, 'swap', `${this.who(p)} ${this.verb(p, 'swap', 'swaps')} a ${this.name(natural.kind)} for a joker.`);
    return true;
  }

  declareKong(p: number, kind: number): boolean {
    if (!this.kongOptions(p).includes(kind)) return false;
    const s = this.seats[p]!;
    const pung = s.melds.find((m) => m.type === 'pung' && m.kind === kind);
    if (pung) {
      const i = s.hand.findIndex((t) => t.kind === kind);
      pung.tiles.push(s.hand.splice(i, 1)[0]!);
      pung.type = 'kong';
    } else {
      const tiles = s.hand.filter((t) => t.kind === kind);
      s.hand = s.hand.filter((t) => t.kind !== kind);
      s.melds.push({ type: 'kong', kind, tiles, concealed: true });
    }
    this.log(p, 'kong', `${this.who(p)} ${this.verb(p, 'declare', 'declares')} a kong of ${this.name(kind)}.`);
    return this.drawFor(p, true);
  }

  selfWin(p: number): boolean {
    if (!this.canSelfWin(p)) return false;
    this.finishWin(p, -1);
    return true;
  }

  discard(p: number, tileId: number): boolean {
    if (this.phase !== 'turn' || this.current !== p) return false;
    const hand = this.seats[p]!.hand;
    const i = hand.findIndex((t) => t.id === tileId);
    if (i < 0) return false;
    const [tile] = hand.splice(i, 1);
    this.seats[p]!.river.push(tile!);
    this.lastDiscard = { tile: tile!, from: p };
    this.afterKong = false;
    this.drawnId = -1;
    this.log(p, 'discard', `${this.who(p)} ${this.verb(p, 'discard', 'discards')} ${this.name(tile!.kind)}.`);
    this.options = [0, 1, 2, 3].map((q) => (q === p ? [] : this.computeClaims(q)));
    this.answers = this.options.map((o) => (o.length ? undefined : null));
    this.phase = 'claim';
    if (this.answers.every((a) => a !== undefined)) this.resolveClaims();
    return true;
  }

  // ------------------------------------------------------------ claims

  claimOptions(p: number): Claim[] {
    return this.phase === 'claim' && this.answers[p] === undefined ? this.options[p]! : [];
  }

  private computeClaims(p: number): Claim[] {
    const d = this.lastDiscard!;
    const tile = d.tile;
    const s = this.seats[p]!;
    const out: Claim[] = [];
    const withTile = [...s.hand, tile];
    if (this.rules.american) {
      // A discarded joker is dead: nobody may call it.
      if (tile.kind === JOKER) return out;
      if (americanWin(withTile, s.melds)) out.push({ type: 'win' });
      const g = groupKind(tile.kind);
      const naturals = s.hand.filter((t) => groupKind(t.kind) === g).length;
      const jokers = s.hand.filter((t) => t.kind === JOKER).length;
      for (const [type, size] of [
        ['pung', 3],
        ['kong', 4],
        ['quint', 5],
      ] as const) {
        const need = size - 1;
        if (naturals + jokers < need) continue;
        const useJokers = Math.max(0, need - naturals);
        // Only offer exposures that still fit some hand on the card.
        const used = this.pickExposure(s.hand, g, need, useJokers);
        const rest = s.hand.filter((t) => !used.includes(t));
        const meld: Meld = { type, kind: g, tiles: [tile, ...used], concealed: false };
        if (rankTargets(rest, [...s.melds, meld], 1).length) out.push({ type, jokers: useJokers });
      }
      return out;
    }
    const score = scoreClassic(withTile, s.melds, this.winContext(p, false));
    if (score && score.faan >= this.rules.minFaan) out.push({ type: 'win' });
    const same = s.hand.filter((t) => t.kind === tile.kind).length;
    if (same >= 2 && !isBonus(tile.kind)) out.push({ type: 'pung', jokers: 0 });
    if (same >= 3 && this.wallCount > 0) out.push({ type: 'kong', jokers: 0 });
    if (this.rules.chow && p === (d.from + 1) % 4 && isSuited(tile.kind)) {
      const has = (k: number) => s.hand.some((t) => t.kind === k);
      const r = rankOf(tile.kind);
      for (const start of [tile.kind - 2, tile.kind - 1, tile.kind]) {
        const sr = r - (tile.kind - start);
        if (sr < 1 || sr > 7) continue;
        if ([start, start + 1, start + 2].every((k) => k === tile.kind || has(k))) out.push({ type: 'chow', start });
      }
    }
    return out;
  }

  /** Hand tiles used for an exposure: naturals first, then jokers. */
  private pickExposure(hand: readonly Tile[], kind: number, need: number, jokers: number): Tile[] {
    const naturals = hand.filter((t) => groupKind(t.kind) === kind).slice(0, need - jokers);
    const js = hand.filter((t) => t.kind === JOKER).slice(0, jokers);
    return [...naturals, ...js];
  }

  /** A player's answer to the last discard: a claim from claimOptions(p), or null to pass. */
  respond(p: number, claim: Claim | null): boolean {
    if (this.phase !== 'claim' || this.answers[p] !== undefined) return false;
    if (claim && !this.options[p]!.some((o) => JSON.stringify(o) === JSON.stringify(claim))) return false;
    this.answers[p] = claim;
    if (this.answers.every((a) => a !== undefined)) this.resolveClaims();
    return true;
  }

  /** Win beats pung/kong/quint, which beat chow; ties go to the first player after the discarder. */
  private resolveClaims() {
    const from = this.lastDiscard!.from;
    const order = [1, 2, 3].map((k) => (from + k) % 4);
    const rank = (c: Claim | null | undefined) => (!c ? 0 : c.type === 'win' ? 3 : c.type === 'chow' ? 1 : 2);
    let best = -1;
    for (const p of order) if (rank(this.answers[p]) > (best < 0 ? 0 : rank(this.answers[best]))) best = p;
    if (best < 0) {
      this.nextTurn((from + 1) % 4);
      return;
    }
    const claim = this.answers[best]!;
    const tile = this.lastDiscard!.tile;
    this.seats[from]!.river.pop();
    if (claim.type === 'win') {
      this.seats[best]!.hand.push(tile);
      sortTiles(this.seats[best]!.hand);
      this.finishWin(best, from);
      return;
    }
    const s = this.seats[best]!;
    let used: Tile[];
    let type: Meld['type'];
    let kind: number;
    if (claim.type === 'chow') {
      used = [claim.start, claim.start + 1, claim.start + 2].filter((k) => k !== tile.kind).map((k) => s.hand.find((t) => t.kind === k)!);
      type = 'chow';
      kind = claim.start;
    } else {
      const size = claim.type === 'pung' ? 3 : claim.type === 'kong' ? 4 : 5;
      kind = groupKind(tile.kind);
      used = this.rules.american ? this.pickExposure(s.hand, kind, size - 1, claim.jokers) : s.hand.filter((t) => t.kind === tile.kind).slice(0, size - 1);
      type = claim.type;
    }
    s.hand = s.hand.filter((t) => !used.includes(t));
    const tiles = [...used, tile].sort((a, b) => a.kind - b.kind);
    s.melds.push({ type, kind, tiles, concealed: false });
    this.log(best, 'claim', `${this.who(best)} ${this.verb(best, 'call', 'calls')} ${type === 'chow' ? 'Chow' : type[0]!.toUpperCase() + type.slice(1)} on ${this.name(tile.kind)}.`);
    this.lastDiscard = null;
    this.current = best;
    this.phase = 'turn';
    this.drawnId = -1;
    if (type === 'kong' && !this.rules.american) this.drawFor(best, true);
  }

  private nextTurn(p: number) {
    this.lastDiscard = null;
    this.current = p;
    this.phase = 'turn';
    this.drawFor(p, false);
  }

  /** Draws for the player on turn (from the back after a kong). Ends the hand when the wall is empty. */
  private drawFor(p: number, replacement: boolean): boolean {
    const t = this.take(replacement);
    if (!t) {
      this.finishDraw();
      return false;
    }
    const s = this.seats[p]!;
    s.hand.push(t);
    this.drawnId = t.id;
    this.afterKong = replacement;
    if (!this.rules.american && this.rules.flowers && !this.replaceBonus(p)) {
      this.finishDraw();
      return false;
    }
    sortTiles(s.hand);
    return true;
  }

  // ------------------------------------------------------------ end of hand

  private finishDraw() {
    this.phase = 'over';
    this.result = { kind: 'draw', winner: -1, discarder: -1, selfDrawn: false, faan: 0, items: [], target: null, jokerless: false, payments: [0, 0, 0, 0] };
    this.log(-1, 'draw-game', 'The wall is empty: this hand is a draw.');
  }

  private finishWin(p: number, discarder: number) {
    const s = this.seats[p]!;
    const selfDrawn = discarder < 0;
    let base: number;
    let faan = 0;
    let items: Faan[] = [];
    let target: Target | null = null;
    let jokerless = false;
    if (this.rules.american) {
      target = americanWin(s.hand, s.melds)!;
      const v = americanValue(target, s.hand, s.melds);
      base = v.value;
      jokerless = v.jokerless;
    } else {
      const score = scoreClassic(s.hand, s.melds, this.winContext(p, selfDrawn))!;
      faan = score.faan;
      items = score.items;
      base = pointsFor(faan);
    }
    // Self-drawn: everyone pays double. On a discard: the discarder pays double, the others single.
    const payments = [0, 0, 0, 0];
    for (let q = 0; q < 4; q++) {
      if (q === p) continue;
      const pay = selfDrawn || q === discarder ? base * 2 : base;
      payments[q] = -pay;
      payments[p]! += pay;
    }
    this.phase = 'over';
    this.result = { kind: 'win', winner: p, discarder, selfDrawn, faan, items, target, jokerless, payments };
    const how = selfDrawn ? 'by self-draw' : `on ${this.who(discarder) === 'You' ? 'your' : `${this.who(discarder)}’s`} discard`;
    const what = this.rules.american ? `${target!.hand.section}, ${target!.hand.value} points` : `${faan} faan`;
    this.log(p, 'win', `Mahjong! ${this.who(p)} ${this.verb(p, 'win', 'wins')} ${how} (${what}).`);
  }
}

/** Seat wind index of the dealer for the next hand, and the next round wind. */
export function nextHand(rules: Rules, dealer: number, prevailing: number, result: Result | null): { dealer: number; prevailing: number } {
  // American rotates every hand; classic keeps the dealer after a dealer win or a draw.
  const keep = !rules.american && result && (result.kind === 'draw' || result.winner === dealer);
  if (keep) return { dealer, prevailing };
  const next = (dealer + 1) % 4;
  return { dealer: next, prevailing: next === 0 ? (prevailing + 1) % 4 : prevailing };
}

export const windIndexName = (i: number) => WINDS[i]!;
export const SEAT_WIND_KIND = (seatWind: number) => EAST + seatWind;
