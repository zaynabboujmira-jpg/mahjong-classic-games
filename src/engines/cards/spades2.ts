import { createRng, shuffleInPlace } from '../core/rng';
import { FULL_DECK, type Card } from '../solitaire/cards';
import { SPADES, power, sortHand, trickWinner, type Played } from './tricks';

/*
 * Two-player Spades: you (seat 0) against the computer (seat 1).
 *
 * The draw: there is no deal. Starting with the non-dealer, players take
 * turns at the stock. Look at the top card: keep it and the next card is
 * discarded, or discard it and keep the next card instead. Each turn uses two
 * cards, so after 26 turns each player holds 13 and 26 are out of play.
 *
 * Then each player bids how many of the 13 tricks they will win (0 = Nil),
 * and the non-dealer leads. Follow suit if you can; spades are trumps and
 * cannot be led until broken, unless you hold only spades.
 *
 * Scoring: make your bid for 10 per trick bid plus 1 per extra trick (a bag);
 * fall short and lose 10 per trick bid. Every 10 bags cost 100. Nil scores
 * +100 if you take no tricks and -100 otherwise (its tricks count as bags).
 * First to the target (300 or 500) wins; a player at -200 or below loses.
 *
 * All state is plain data (cards by id) so a game can be saved as JSON.
 */
export type Phase2 = 'draw' | 'bid' | 'play' | 'round-over' | 'game-over';
export const card2 = (id: number): Card => FULL_DECK[id]!;

export interface RoundResult2 {
  seat: number;
  bid: number;
  tricks: number;
  points: number;
  bags: number;
  bagPenalty: boolean;
}

export interface Spades2State {
  seed: string;
  target: number;
  round: number;
  dealer: number;
  phase: Phase2;
  stock: number[];
  hands: [number[], number[]];
  discarded: number;
  /** Whose turn it is at the stock, or to bid or play. */
  turn: number;
  bids: [number | null, number | null];
  tricks: [number, number];
  scores: [number, number];
  bags: [number, number];
  trick: { seat: number; id: number }[];
  lastTrick: { seat: number; id: number }[];
  spadesBroken: boolean;
  lastRound: RoundResult2[];
  winner: number;
}

export class Spades2 {
  s: Spades2State;

  constructor(seed: string | Spades2State = 'spades2', target = 300) {
    if (typeof seed !== 'string') {
      this.s = seed;
      return;
    }
    this.s = { seed, target, round: 0, dealer: 1, phase: 'draw', stock: [], hands: [[], []], discarded: 0, turn: 0, bids: [null, null], tricks: [0, 0], scores: [0, 0], bags: [0, 0], trick: [], lastTrick: [], spadesBroken: false, lastRound: [], winner: -1 };
    this.newRound();
  }

  newRound() {
    const s = this.s;
    s.round++;
    s.dealer = 1 - s.dealer;
    s.stock = shuffleInPlace(
      FULL_DECK.map((c) => c.id),
      createRng(`spades2:${s.seed}:${s.round}`),
    );
    s.hands = [[], []];
    s.discarded = 0;
    s.turn = 1 - s.dealer;
    s.phase = 'draw';
    s.bids = [null, null];
    s.tricks = [0, 0];
    s.trick = [];
    s.lastTrick = [];
    s.spadesBroken = false;
  }

  hand(seat: number): Card[] {
    return sortHand(this.s.hands[seat]!.map(card2));
  }

  /** The card the player at the stock is looking at. */
  get top(): Card | null {
    const s = this.s;
    return s.phase === 'draw' && s.stock.length ? card2(s.stock[s.stock.length - 1]!) : null;
  }

  /** Draw turn: keep the top card (the next one is discarded) or pass it (and keep the next). Returns the card that was discarded. */
  take(seat: number, keep: boolean): Card | null {
    const s = this.s;
    if (s.phase !== 'draw' || s.turn !== seat || s.stock.length < 2) return null;
    const first = s.stock.pop()!;
    const second = s.stock.pop()!;
    s.hands[seat]!.push(keep ? first : second);
    s.discarded++;
    s.turn = 1 - seat;
    if (!s.stock.length) {
      s.phase = 'bid';
      s.turn = 1 - s.dealer;
    }
    return card2(keep ? second : first);
  }

  bid(seat: number, n: number) {
    const s = this.s;
    if (s.phase !== 'bid' || s.turn !== seat || n < 0 || n > 13) return false;
    s.bids[seat] = n;
    s.turn = 1 - seat;
    if (s.bids[0] !== null && s.bids[1] !== null) {
      s.phase = 'play';
      s.turn = 1 - s.dealer;
    }
    return true;
  }

  legal(seat: number): Card[] {
    const s = this.s;
    if (s.phase !== 'play' || s.turn !== seat) return [];
    const hand = this.hand(seat);
    if (!s.trick.length) {
      if (s.spadesBroken) return hand;
      const other = hand.filter((c) => c.suit !== SPADES);
      return other.length ? other : hand;
    }
    const led = card2(s.trick[0]!.id).suit;
    const follow = hand.filter((c) => c.suit === led);
    return follow.length ? follow : hand;
  }

  play(seat: number, c: Card): boolean {
    const s = this.s;
    if (!this.legal(seat).some((x) => x.id === c.id)) return false;
    s.hands[seat] = s.hands[seat]!.filter((id) => id !== c.id);
    s.trick.push({ seat, id: c.id });
    if (c.suit === SPADES) s.spadesBroken = true;
    if (s.trick.length < 2) {
      s.turn = 1 - seat;
      return true;
    }
    const played: Played[] = s.trick.map((t) => ({ seat: t.seat, card: card2(t.id) }));
    const w = trickWinner(played, SPADES);
    s.tricks[w]!++;
    s.lastTrick = s.trick;
    s.trick = [];
    s.turn = w;
    if (!s.hands[0].length && !s.hands[1].length) this.score();
    return true;
  }

  private score() {
    const s = this.s;
    s.lastRound = [0, 1].map((seat) => {
      const bid = s.bids[seat]!;
      const tricks = s.tricks[seat]!;
      let points = 0;
      let bags = 0;
      if (bid === 0) {
        points = tricks === 0 ? 100 : -100;
        bags = tricks;
      } else if (tricks >= bid) {
        bags = tricks - bid;
        points = bid * 10 + bags;
      } else points = -bid * 10;
      s.bags[seat]! += bags;
      let bagPenalty = false;
      if (s.bags[seat]! >= 10) {
        s.bags[seat]! -= 10;
        points -= 100;
        bagPenalty = true;
      }
      s.scores[seat]! += points;
      return { seat, bid, tricks, points, bags, bagPenalty };
    });
    const over = s.scores.some((x) => x >= s.target || x <= -200);
    if (over) {
      s.phase = 'game-over';
      s.winner = s.scores[0] <= -200 ? 1 : s.scores[1] <= -200 ? 0 : s.scores[0] >= s.scores[1] ? 0 : 1;
    } else s.phase = 'round-over';
  }
}

/** Rough trick value of a card for keeping it in the draw and for bidding. */
function value(c: Card, hand: readonly Card[]): number {
  const p = power(c);
  const len = hand.filter((x) => x.suit === c.suit).length;
  if (c.suit === SPADES) return p >= 12 ? 1 : p >= 9 ? 0.6 : 0.35;
  if (p === 14) return 0.95;
  if (p === 13) return len >= 2 ? 0.7 : 0.45;
  if (p === 12) return len >= 3 ? 0.35 : 0.15;
  return 0;
}

/** Computer draw: keep the top card if it is worth a trick, or if the hand is short of spades and it is one. */
export function chooseKeep(hand: readonly Card[], top: Card): boolean {
  const spades = hand.filter((c) => c.suit === SPADES).length;
  if (top.suit === SPADES && (power(top) >= 9 || spades < 3)) return true;
  if (value(top, [...hand, top]) >= 0.4) return true;
  // Low and middle cards are passed: the next card is kept instead.
  return false;
}

/** Computer bid: the sum of card values (spade length counts), or Nil with a very weak hand. */
export function chooseBid2(hand: readonly Card[]): number {
  const spades = hand.filter((c) => c.suit === SPADES);
  let tricks = hand.reduce((t, c) => t + value(c, hand), 0);
  tricks += Math.max(0, spades.length - 4) * 0.5;
  const highSpade = spades.some((c) => power(c) >= 11);
  if (tricks < 1.2 && !highSpade && spades.length <= 2) return 0;
  return Math.max(1, Math.min(13, Math.round(tricks)));
}

/** Computer play: win cheaply while it needs tricks, otherwise duck; a Nil bidder plays under. */
export function choosePlay2(g: Spades2, seat: number): Card {
  const s = g.s;
  const legal = g.legal(seat).sort((a, b) => power(a) - power(b) || a.suit - b.suit);
  const nil = s.bids[seat] === 0;
  const need = (s.bids[seat] ?? 0) - s.tricks[seat]!;
  const oppNil = s.bids[1 - seat] === 0 && s.tricks[1 - seat] === 0;
  const lowest = (cs: Card[]) => cs.reduce((a, b) => (power(b) < power(a) || (power(b) === power(a) && a.suit === SPADES) ? b : a));
  const highest = (cs: Card[]) => cs.reduce((a, b) => (power(b) > power(a) ? b : a));
  if (!s.trick.length) {
    if (nil) return lowest(legal);
    if (oppNil) return lowest(legal);
    if (need > 0) {
      const aces = legal.filter((c) => power(c) === 14 && c.suit !== SPADES);
      if (aces.length) return aces[0]!;
      return highest(legal.filter((c) => c.suit !== SPADES).length ? legal.filter((c) => c.suit !== SPADES) : legal);
    }
    return lowest(legal);
  }
  const lead = card2(s.trick[0]!.id);
  const beats = (c: Card) => (c.suit === lead.suit ? power(c) > power(lead) : c.suit === SPADES && lead.suit !== SPADES);
  const winners = legal.filter(beats);
  const losers = legal.filter((c) => !beats(c));
  if (nil) return losers.length ? highest(losers) : lowest(winners);
  // Opponent bid Nil and is about to win this trick: let them have it.
  if (oppNil && losers.length) return highest(losers);
  if (need > 0 && winners.length) {
    // Cheapest winner: a card of the led suit before a trump.
    const sameSuit = winners.filter((c) => c.suit === lead.suit);
    return lowest(sameSuit.length ? sameSuit : winners);
  }
  return losers.length ? lowest(losers) : lowest(winners);
}
