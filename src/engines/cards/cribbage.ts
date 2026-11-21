import { createRng, shuffleInPlace } from '../core/rng';
import { FULL_DECK, RANK_LABELS, SUIT_SYMBOLS, type Card } from '../solitaire/cards';

/*
 * Two-player Cribbage: you (seat 0) against the computer (seat 1), first to 121.
 *
 * Each hand: six cards each, both discard two to the dealer's crib, the
 * non-dealer (pone) cuts the starter (a jack gives the dealer 2, "his heels").
 * Pegging: players alternate cards, keeping a running count that may not pass
 * 31. A count of 15 or 31 scores 2; pairs, three and four of a kind 2/6/12; a
 * run of 3+ among the latest cards scores its length. A player who cannot play
 * says "go"; the other keeps playing, and the last player to lay a card before
 * the count restarts scores 1 (none if the count hit 31). The show: pone's
 * hand, then the dealer's hand, then the crib, each with the starter: fifteens
 * 2 each, pairs 2 each, runs 1 per card, a four-card flush 4 (5 with the
 * starter; the crib only scores a five-card flush) and nobs 1 (jack of the
 * starter's suit). The game ends the moment a player reaches 121.
 *
 * All state is plain data (cards by id) so a game in progress can be saved
 * as JSON and restored; each hand's shuffle comes from the seed and hand number.
 */
export const TARGET = 121;
export type Phase = 'discard' | 'peg' | 'show' | 'game-over';
export const NAMES = ['You', 'Computer'] as const;

export const card = (id: number): Card => FULL_DECK[id]!;
/** Pip value for counting: ace 1, face cards 10. */
export const pip = (c: Card) => Math.min(c.rank, 10);
export const short = (c: Card) => `${RANK_LABELS[c.rank]}${SUIT_SYMBOLS[c.suit]}`;

export type ScoreKind = 'fifteen' | 'pair' | 'run' | 'flush' | 'nobs';
export interface ScoreItem {
  kind: ScoreKind;
  cards: number[];
  points: number;
}

function subsets<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length === size) return void out.push(acc.slice());
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]!);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

const isRun = (cs: Card[]) => {
  const r = cs.map((c) => c.rank).sort((a, b) => a - b);
  return r.every((v, i) => i === 0 || v === r[i - 1]! + 1);
};

/** Every scoring combination in a four-card hand (or crib) with the starter. */
export function scoreHand(hand: Card[], starter: Card | null, crib = false): ScoreItem[] {
  const all = starter ? [...hand, starter] : hand.slice();
  const items: ScoreItem[] = [];
  for (let n = 2; n <= all.length; n++)
    for (const s of subsets(all, n)) if (s.reduce((t, c) => t + pip(c), 0) === 15) items.push({ kind: 'fifteen', cards: s.map((c) => c.id), points: 2 });
  for (const [a, b] of subsets(all, 2)) if (a!.rank === b!.rank) items.push({ kind: 'pair', cards: [a!.id, b!.id], points: 2 });
  for (let n = all.length; n >= 3; n--) {
    const runs = subsets(all, n).filter(isRun);
    if (runs.length) {
      for (const r of runs) items.push({ kind: 'run', cards: r.sort((x, y) => x.rank - y.rank).map((c) => c.id), points: n });
      break;
    }
  }
  if (hand.length === 4 && hand.every((c) => c.suit === hand[0]!.suit)) {
    const five = !!starter && starter.suit === hand[0]!.suit;
    if (five || !crib) items.push({ kind: 'flush', cards: (five ? all : hand).map((c) => c.id), points: five ? 5 : 4 });
  }
  if (starter) {
    const jack = hand.find((c) => c.rank === 11 && c.suit === starter.suit);
    if (jack) items.push({ kind: 'nobs', cards: [jack.id], points: 1 });
  }
  return items;
}

export const total = (items: ScoreItem[]) => items.reduce((t, i) => t + i.points, 0);

/** Points for laying the last card of `seq` (the cards played since the count restarted). */
export function pegScore(seq: Card[]): { points: number; why: string[] } {
  const why: string[] = [];
  let points = 0;
  const count = seq.reduce((t, c) => t + pip(c), 0);
  if (count === 15) (points += 2), why.push('fifteen for 2');
  if (count === 31) (points += 2), why.push('31 for 2');
  const last = seq[seq.length - 1]!;
  let same = 1;
  for (let i = seq.length - 2; i >= 0 && seq[i]!.rank === last.rank; i--) same++;
  if (same >= 2) {
    const p = [0, 0, 2, 6, 12][same]!;
    points += p;
    why.push(`${['', '', 'a pair', 'three of a kind', 'four of a kind'][same]} for ${p}`);
  }
  for (let n = seq.length; n >= 3; n--) {
    const tail = seq.slice(-n);
    const ranks = new Set(tail.map((c) => c.rank));
    if (ranks.size === n && isRun(tail)) {
      points += n;
      why.push(`a run of ${n} for ${n}`);
      break;
    }
  }
  return { points, why };
}

export interface PegEvent {
  seat: number;
  text: string;
  points: number;
}

export interface CribbageState {
  seed: string;
  hand: number;
  dealer: number;
  scores: [number, number];
  /** Back pegs: each player's score before their last move. */
  prev: [number, number];
  phase: Phase;
  /** Cards dealt and still held (six before the discard, then the four kept). */
  hands: [number[], number[]];
  /** Cards still to play while pegging. */
  pegHands: [number[], number[]];
  crib: number[];
  starter: number | null;
  turn: number;
  count: number;
  /** Cards since the count last restarted, in order. */
  seq: number[];
  /** Every card played this hand, with who played it. */
  played: { seat: number; id: number }[];
  lastPlayer: number;
  /** 0: pone's hand, 1: dealer's hand, 2: the crib. */
  showStep: number;
  winner: number | null;
  /** What happened on the last move (scores, goes), for messages. */
  events: PegEvent[];
  games: number;
}

export class Cribbage {
  s: CribbageState;

  constructor(seed = 'cribbage', saved?: CribbageState) {
    if (saved) {
      this.s = saved;
      return;
    }
    const first = createRng(`cribbage:${seed}:cut`)() < 0.5 ? 0 : 1;
    this.s = {
      seed,
      hand: 0,
      dealer: 1 - first,
      scores: [0, 0],
      prev: [0, 0],
      phase: 'discard',
      hands: [[], []],
      pegHands: [[], []],
      crib: [],
      starter: null,
      turn: 0,
      count: 0,
      seq: [],
      played: [],
      lastPlayer: 0,
      showStep: 0,
      winner: null,
      events: [],
      games: 0,
    };
    this.deal();
  }

  get pone() {
    return 1 - this.s.dealer;
  }

  /** Deals the next hand; the deal alternates. */
  deal() {
    const s = this.s;
    s.hand++;
    s.dealer = 1 - s.dealer;
    const deck = shuffleInPlace(FULL_DECK.map((c) => c.id), createRng(`cribbage:${s.seed}:${s.hand}`));
    s.hands = [deck.slice(0, 6), deck.slice(6, 12)];
    s.hands.forEach((h) => h.sort(byRank));
    s.crib = [];
    s.starter = deck[12]!;
    s.phase = 'discard';
    s.pegHands = [[], []];
    s.count = 0;
    s.seq = [];
    s.played = [];
    s.showStep = 0;
    s.events = [];
  }

  /** The starter stays hidden until both players have discarded. */
  get starter(): Card | null {
    return this.s.phase === 'discard' || this.s.starter === null ? null : card(this.s.starter);
  }

  private add(seat: number, points: number, text: string) {
    const s = this.s;
    if (!points || s.phase === 'game-over') return;
    s.prev[seat] = s.scores[seat]!;
    s.scores[seat] = Math.min(TARGET, s.scores[seat]! + points);
    s.events.push({ seat, text, points });
    if (s.scores[seat] >= TARGET) {
      s.phase = 'game-over';
      s.winner = seat;
      s.games++;
    }
  }

  /** You send two cards to the crib; the computer discards at the same time. */
  discard(ids: number[]) {
    const s = this.s;
    if (s.phase !== 'discard' || ids.length !== 2 || !ids.every((id) => s.hands[0].includes(id)) || ids[0] === ids[1]) return false;
    const cpu = chooseDiscard(s.hands[1].map(card), s.dealer === 1).map((c) => c.id);
    s.events = [];
    for (const [seat, out] of [
      [0, ids],
      [1, cpu],
    ] as const) {
      s.hands[seat] = s.hands[seat].filter((id) => !out.includes(id));
      s.crib.push(...out);
    }
    s.crib.sort(byRank);
    s.pegHands = [s.hands[0].slice(), s.hands[1].slice()];
    s.phase = 'peg';
    if (card(s.starter!).rank === 11) this.add(s.dealer, 2, 'his heels (a jack cut) for 2');
    if (s.phase !== 'peg') return true;
    s.turn = this.pone;
    s.lastPlayer = s.dealer;
    return true;
  }

  canPlay(seat: number) {
    return this.s.pegHands[seat]!.some((id) => this.s.count + pip(card(id)) <= 31);
  }

  legal(seat: number): number[] {
    const s = this.s;
    if (s.phase !== 'peg' || s.turn !== seat) return [];
    return s.pegHands[seat]!.filter((id) => s.count + pip(card(id)) <= 31);
  }

  /** Lays a card while pegging, scores it, then passes the turn (handling goes). */
  play(seat: number, id: number) {
    const s = this.s;
    if (!this.legal(seat).includes(id)) return false;
    s.events = [];
    s.pegHands[seat] = s.pegHands[seat]!.filter((x) => x !== id);
    s.seq.push(id);
    s.played.push({ seat, id });
    s.count += pip(card(id));
    s.lastPlayer = seat;
    const { points, why } = pegScore(s.seq.map(card));
    this.add(seat, points, why.join(', '));
    if (s.phase !== 'peg') return true;
    if (s.count === 31) this.reset();
    this.advance();
    return true;
  }

  private reset() {
    this.s.count = 0;
    this.s.seq = [];
  }

  private advance() {
    const s = this.s;
    for (;;) {
      if (s.phase !== 'peg') return;
      if (!s.pegHands[0].length && !s.pegHands[1].length) {
        if (s.count > 0) this.add(s.lastPlayer, 1, 'last card for 1');
        this.reset();
        if (s.phase === 'peg') this.startShow();
        return;
      }
      const other = 1 - s.lastPlayer;
      if (this.canPlay(other)) return void (s.turn = other);
      if (this.canPlay(s.lastPlayer)) {
        if (s.pegHands[other]!.length) s.events.push({ seat: other, text: 'go', points: 0 });
        s.turn = s.lastPlayer;
        return;
      }
      // Neither can play: the last player scores the go and the count restarts.
      if (s.pegHands[other]!.length) s.events.push({ seat: other, text: 'go', points: 0 });
      this.add(s.lastPlayer, 1, 'go for 1');
      // The count restarts; the loop hands the lead to the player after the last one to lay a card.
      this.reset();
    }
  }

  private startShow() {
    this.s.phase = 'show';
    this.s.showStep = 0;
    this.scoreShowStep();
  }

  /** Whose cards the current show step counts, and the breakdown. */
  showing(): { seat: number; crib: boolean; cards: Card[]; items: ScoreItem[] } {
    const s = this.s;
    const seat = s.showStep === 0 ? this.pone : s.dealer;
    const crib = s.showStep === 2;
    const cards = (crib ? s.crib : s.hands[seat]!).map(card);
    return { seat, crib, cards, items: scoreHand(cards, card(s.starter!), crib) };
  }

  private scoreShowStep() {
    const sh = this.showing();
    this.s.events = [];
    const pts = total(sh.items);
    this.add(sh.seat, pts, `${sh.crib ? 'crib' : 'hand'} for ${pts}`);
    if (!pts) this.s.events.push({ seat: sh.seat, text: `${sh.crib ? 'crib' : 'hand'}: no points`, points: 0 });
  }

  /** Moves the show on: next hand to count, or the next deal. */
  next() {
    const s = this.s;
    if (s.phase !== 'show') return;
    if (s.showStep < 2) {
      s.showStep++;
      this.scoreShowStep();
    } else this.deal();
  }

  /** A game lost with fewer than 91 points is a skunk (below 61, a double skunk). */
  skunk(): 0 | 1 | 2 {
    const s = this.s;
    if (s.winner === null) return 0;
    const lo = s.scores[1 - s.winner]!;
    return lo < 61 ? 2 : lo < 91 ? 1 : 0;
  }
}

const byRank = (a: number, b: number) => card(a).rank - card(b).rank || card(a).suit - card(b).suit;

/** A rough value of two cards thrown to a crib: what they score together plus a little for 5s and near-runs. */
function cribValue(a: Card, b: Card) {
  let v = 0;
  if (pip(a) + pip(b) === 15) v += 2;
  if (a.rank === b.rank) v += 2;
  if (Math.abs(a.rank - b.rank) === 1) v += 1;
  if (Math.abs(a.rank - b.rank) === 2) v += 0.5;
  for (const c of [a, b]) if (c.rank === 5) v += 1.5;
  if (a.suit === b.suit) v += 0.2;
  return v + 3.5;
}

/** Average show score of four kept cards over every possible starter. */
export function expectedHand(keep: Card[], seen: Card[]) {
  const out = new Set(seen.map((c) => c.id));
  let sum = 0;
  let n = 0;
  for (const st of FULL_DECK) {
    if (out.has(st.id)) continue;
    sum += total(scoreHand(keep, st));
    n++;
  }
  return sum / n;
}

/** The two cards to throw: best expected hand, plus the crib's value if it is yours, minus it if not. */
export function chooseDiscard(six: Card[], ownCrib: boolean): Card[] {
  let best: Card[] = six.slice(0, 2);
  let bestV = -Infinity;
  for (const pair of subsets(six, 2)) {
    const keep = six.filter((c) => !pair.includes(c));
    const v = expectedHand(keep, six) + (ownCrib ? 1 : -1) * cribValue(pair[0]!, pair[1]!);
    if (v > bestV) (bestV = v), (best = pair);
  }
  return best;
}

/** Computer pegging: take points now, avoid leaving 5 or 21 and easy pairs, lead low. */
export function choosePeg(g: Cribbage, seat: number): number {
  const s = g.s;
  const legal = g.legal(seat);
  let best = legal[0]!;
  let bestV = -Infinity;
  for (const id of legal) {
    const c = card(id);
    const seq = [...s.seq.map(card), c];
    const count = s.count + pip(c);
    let v = pegScore(seq).points * 10;
    if (count === 5 || count === 21) v -= 6;
    if (count < 15 && count + 10 >= 15 && count !== 5) v -= 1;
    if (count === 15 || count === 31) v += 1;
    if (s.seq.length === 0) v += c.rank === 5 ? -8 : c.rank <= 4 ? 3 : 0;
    // Keep low cards for later goes; shed high ones while the count allows.
    v += pip(c) * 0.15;
    if (v > bestV) (bestV = v), (best = id);
  }
  return best;
}
