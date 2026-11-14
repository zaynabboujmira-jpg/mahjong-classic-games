import { createRng, type Rng } from '../core/rng';
import type { Card } from '../solitaire/cards';
import { SPADES, currentWinner, deal, ofSuit, power, sameCard, trickWinner, type Played } from './tricks';

/*
 * Partnership Spades. You (South) and North play against West and East.
 * After the deal everyone bids how many tricks they will take (0 = Nil).
 * Spades are always trumps and cannot be led until one has been played
 * ("broken"), unless a hand holds only spades. Players must follow suit.
 *
 * A team that makes its combined bid scores 10 per trick bid plus 1 per
 * extra trick (a "bag"); a team that falls short loses 10 per trick bid.
 * Every 10 bags cost 100 points. Nil scores +100 if that player takes no
 * tricks and -100 otherwise (their tricks still count as bags for the
 * team). First team to 500 wins; a team at -200 or below loses.
 */
export type SpadesPhase = 'bid' | 'play' | 'round-over' | 'game-over';
export const teamOf = (seat: number) => seat % 2;

export interface RoundScore {
  team: number;
  bid: number;
  tricks: number;
  points: number;
  bags: number;
  bagPenalty: boolean;
  nil: { seat: number; made: boolean }[];
}

export class Spades {
  hands: Card[][] = [];
  bids: (number | null)[] = [null, null, null, null];
  tricks = [0, 0, 0, 0];
  /** Team scores (0: you and North, 1: West and East) and accumulated bags. */
  scores = [0, 0];
  bags = [0, 0];
  round = 0;
  dealer = 3;
  phase: SpadesPhase = 'bid';
  trick: Played[] = [];
  lastTrick: Played[] = [];
  turn = 0;
  spadesBroken = false;
  tricksPlayed = 0;
  lastRound: RoundScore[] = [];
  readonly target: number;
  private rng: Rng;

  constructor(seed = 'spades', target = 500) {
    this.rng = createRng(`spades:${seed}`);
    this.target = target;
    this.newRound();
  }

  newRound() {
    this.round++;
    this.dealer = (this.dealer + 1) % 4;
    this.hands = deal(this.rng);
    this.bids = [null, null, null, null];
    this.tricks = [0, 0, 0, 0];
    this.trick = [];
    this.lastTrick = [];
    this.spadesBroken = false;
    this.tricksPlayed = 0;
    this.phase = 'bid';
    this.turn = (this.dealer + 1) % 4;
  }

  bid(seat: number, n: number) {
    if (this.phase !== 'bid' || seat !== this.turn) throw new Error('Not your bid');
    if (!Number.isInteger(n) || n < 0 || n > 13) throw new Error('Bid 0-13');
    this.bids[seat] = n;
    this.turn = (seat + 1) % 4;
    if (this.bids.every((b) => b !== null)) {
      this.phase = 'play';
      this.turn = (this.dealer + 1) % 4;
    }
  }

  legal(seat = this.turn): Card[] {
    if (this.phase !== 'play' || seat !== this.turn) return [];
    const hand = this.hands[seat]!;
    if (!this.trick.length) {
      if (this.spadesBroken) return hand;
      const other = hand.filter((c) => c.suit !== SPADES);
      return other.length ? other : hand;
    }
    const follow = ofSuit(hand, this.trick[0]!.card.suit);
    return follow.length ? follow : hand;
  }

  play(seat: number, card: Card) {
    if (!this.legal(seat).some((c) => sameCard(c, card))) throw new Error('Illegal card');
    this.hands[seat] = this.hands[seat]!.filter((c) => !sameCard(c, card));
    this.trick.push({ seat, card });
    if (card.suit === SPADES) this.spadesBroken = true;
    if (this.trick.length < 4) {
      this.turn = (seat + 1) % 4;
      return;
    }
    const winner = trickWinner(this.trick, SPADES);
    this.tricks[winner]!++;
    this.lastTrick = this.trick;
    this.trick = [];
    this.tricksPlayed++;
    this.turn = winner;
    if (this.tricksPlayed === 13) this.endRound();
  }

  teamBid(team: number) {
    return [team, team + 2].reduce((n, s) => n + (this.bids[s] ?? 0), 0);
  }
  teamTricks(team: number) {
    return this.tricks[team]! + this.tricks[team + 2]!;
  }

  private endRound() {
    this.lastRound = [0, 1].map((team) => {
      const seats = [team, team + 2];
      const bid = this.teamBid(team);
      const tricks = this.teamTricks(team);
      // Tricks taken by a Nil bidder do not help the contract.
      const counted = seats.reduce((n, s) => n + (this.bids[s] === 0 ? 0 : this.tricks[s]!), 0);
      let points = 0;
      let bags = 0;
      if (bid > 0) {
        if (counted >= bid) {
          bags = tricks - bid;
          points = bid * 10 + bags;
        } else {
          points = -bid * 10;
          bags = seats.reduce((n, s) => n + (this.bids[s] === 0 ? this.tricks[s]! : 0), 0);
        }
      } else bags = tricks;
      const nil = seats.filter((s) => this.bids[s] === 0).map((s) => ({ seat: s, made: this.tricks[s] === 0 }));
      for (const n of nil) points += n.made ? 100 : -100;
      this.bags[team]! += bags;
      let bagPenalty = false;
      if (this.bags[team]! >= 10) {
        this.bags[team]! -= 10;
        points -= 100;
        bagPenalty = true;
      }
      this.scores[team]! += points;
      return { team, bid, tricks, points, bags, bagPenalty, nil };
    });
    const over = this.scores.some((s) => s >= this.target || s <= -200);
    this.phase = over ? 'game-over' : 'round-over';
  }

  /** Winning team when the game is over. */
  winner(): number | null {
    if (this.phase !== 'game-over') return null;
    if (this.scores[0]! <= -200) return 1;
    if (this.scores[1]! <= -200) return 0;
    return this.scores[0]! >= this.scores[1]! ? 0 : 1;
  }
}

// ----- computer players -----

/** Estimated tricks: aces and protected kings, plus spade length and high spades; Nil with a very weak hand. */
export function chooseBid(hand: Card[], partnerBid: number | null = null): number {
  let t = 0;
  const spades = ofSuit(hand, SPADES);
  for (const suit of [1, 2, 3] as const) {
    const cards = ofSuit(hand, suit).map(power).sort((a, b) => b - a);
    if (cards[0] === 14) t += 1;
    if (cards.includes(13) && cards.length >= 2) t += cards[0] === 14 ? 0.8 : 0.6;
    if (cards.includes(12) && cards.length >= 3) t += 0.25;
    // Short suits let spades ruff.
    if (cards.length <= 1 && spades.length >= 3) t += cards.length === 0 ? 0.8 : 0.4;
  }
  const sp = spades.map(power);
  t += sp.filter((p) => p >= 13).length;
  if (sp.includes(12) && sp.length >= 3) t += 0.6;
  t += Math.max(0, sp.length - 3) * 0.75;
  const high = hand.filter((c) => power(c) >= 11).length;
  if (t < 1 && high <= 1 && sp.every((p) => p < 10) && partnerBid !== 0) return 0;
  return Math.max(1, Math.min(13, Math.round(t)));
}

export function chooseSpadesCard(g: Spades, seat = g.turn): Card {
  const legal = g.legal(seat);
  if (legal.length === 1) return legal[0]!;
  const byPower = [...legal].sort((a, b) => (a.suit === SPADES ? 20 : 0) + power(a) - ((b.suit === SPADES ? 20 : 0) + power(b)));
  const lowest = byPower[0]!;
  const partner = (seat + 2) % 4;
  const team = seat % 2;
  const iAmNil = g.bids[seat] === 0;
  const partnerNil = g.bids[partner] === 0;
  const need = g.teamBid(team) - g.teamTricks(team);
  if (!g.trick.length) {
    if (iAmNil) return lowest;
    // Lead winners (aces, then kings) when we still need tricks; otherwise lead low.
    const aces = legal.filter((c) => power(c) === 14 && c.suit !== SPADES);
    if (need > 0 && aces.length) return aces[0]!;
    return lowest;
  }
  const win = currentWinner(g.trick, SPADES)!;
  const beats = (c: Card) => {
    const t = [...g.trick, { seat, card: c }];
    return trickWinner(t, SPADES) === seat;
  };
  const winners = byPower.filter(beats);
  const losers = byPower.filter((c) => !beats(c));
  if (iAmNil) return losers.length ? losers[losers.length - 1]! : winners[0]!;
  // Protect a Nil partner: win the trick over them if they are winning it.
  if (partnerNil && win.seat === partner && winners.length) return winners[0]!;
  // Partner already winning and we are last, or likely to win: play low.
  if (win.seat === partner && !partnerNil && (g.trick.length === 3 || power(win.card) >= 13)) return losers[0] ?? lowest;
  if (need > 0 && winners.length) {
    // Last to play: the cheapest winner. Otherwise only a strong winner is worth it.
    if (g.trick.length === 3) return winners[0]!;
    const strong = winners.filter((c) => power(c) >= 13 || c.suit === SPADES);
    if (strong.length) return strong[0]!;
  }
  // Avoid extra bags when the bid is already made.
  return losers.length ? losers[losers.length - 1]! : winners[0] ?? lowest;
}

export { power };
