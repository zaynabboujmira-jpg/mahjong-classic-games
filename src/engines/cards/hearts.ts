import { createRng, type Rng } from '../core/rng';
import type { Card } from '../solitaire/cards';
import { CLUBS, HEARTS, SPADES, currentWinner, deal, ofSuit, power, sameCard, sortHand, trickWinner, type Played } from './tricks';

/*
 * Hearts for four players. Before each hand everyone passes three cards:
 * left, then right, then across, then no pass, and repeat. The two of clubs
 * leads the first trick; players must follow suit. No points may be played
 * on the first trick (unless a hand holds nothing else). Hearts cannot be
 * led until one has been played ("broken"), unless a hand is all hearts.
 *
 * Each heart taken is 1 point and the queen of spades 13. Taking all 26
 * ("shooting the moon") scores 0 and gives every other player 26 instead.
 * When someone reaches 100, the lowest score wins.
 */
export const QUEEN_SPADES = (c: Card) => c.suit === SPADES && c.rank === 12;
export const TWO_CLUBS = (c: Card) => c.suit === CLUBS && c.rank === 2;
export const cardPoints = (c: Card) => (c.suit === HEARTS ? 1 : QUEEN_SPADES(c) ? 13 : 0);
export type PassDir = 'left' | 'right' | 'across' | 'none';
const PASS_ORDER: PassDir[] = ['left', 'right', 'across', 'none'];
const PASS_OFFSET: Record<PassDir, number> = { left: 1, right: 3, across: 2, none: 0 };
export type Phase = 'pass' | 'play' | 'round-over' | 'game-over';

export class Hearts {
  hands: Card[][] = [];
  scores = [0, 0, 0, 0];
  /** Points taken this hand. */
  taken = [0, 0, 0, 0];
  round = 0;
  phase: Phase = 'pass';
  trick: Played[] = [];
  lastTrick: Played[] = [];
  turn = 0;
  tricksPlayed = 0;
  heartsBroken = false;
  /** Who shot the moon last hand, if anyone. */
  moon: number | null = null;
  readonly target: number;
  private rng: Rng;

  constructor(seed = 'hearts', target = 100) {
    this.rng = createRng(`hearts:${seed}`);
    this.target = target;
    this.newRound();
  }

  get passDir(): PassDir {
    return PASS_ORDER[(this.round - 1) % 4]!;
  }

  newRound() {
    this.round++;
    this.hands = deal(this.rng);
    this.taken = [0, 0, 0, 0];
    this.trick = [];
    this.lastTrick = [];
    this.tricksPlayed = 0;
    this.heartsBroken = false;
    this.moon = null;
    if (this.passDir === 'none') this.startPlay();
    else this.phase = 'pass';
  }

  /** Everyone passes three cards at once: passes[seat] are that seat's cards. */
  pass(passes: Card[][]) {
    if (this.phase !== 'pass') throw new Error('Not passing now');
    const off = PASS_OFFSET[this.passDir];
    passes.forEach((cards, s) => {
      if (cards.length !== 3) throw new Error('Pass exactly three cards');
      this.hands[s] = this.hands[s]!.filter((c) => !cards.some((x) => sameCard(x, c)));
    });
    passes.forEach((cards, s) => this.hands[(s + off) % 4]!.push(...cards));
    this.hands.forEach((h) => sortHand(h));
    this.startPlay();
  }

  private startPlay() {
    this.phase = 'play';
    this.turn = this.hands.findIndex((h) => h.some(TWO_CLUBS));
  }

  /** Cards the seat may play now. */
  legal(seat = this.turn): Card[] {
    const hand = this.hands[seat]!;
    if (this.phase !== 'play' || seat !== this.turn) return [];
    const first = this.tricksPlayed === 0;
    if (!this.trick.length) {
      if (first) return hand.filter(TWO_CLUBS);
      if (this.heartsBroken) return hand;
      const nonHearts = hand.filter((c) => c.suit !== HEARTS);
      return nonHearts.length ? nonHearts : hand;
    }
    const follow = ofSuit(hand, this.trick[0]!.card.suit);
    if (follow.length) return follow;
    if (first) {
      const safe = hand.filter((c) => !cardPoints(c));
      return safe.length ? safe : hand;
    }
    return hand;
  }

  play(seat: number, card: Card) {
    if (!this.legal(seat).some((c) => sameCard(c, card))) throw new Error('Illegal card');
    this.hands[seat] = this.hands[seat]!.filter((c) => !sameCard(c, card));
    this.trick.push({ seat, card });
    if (card.suit === HEARTS) this.heartsBroken = true;
    if (this.trick.length < 4) {
      this.turn = (seat + 1) % 4;
      return;
    }
    const winner = trickWinner(this.trick);
    this.taken[winner]! += this.trick.reduce((n, p) => n + cardPoints(p.card), 0);
    this.lastTrick = this.trick;
    this.trick = [];
    this.tricksPlayed++;
    this.turn = winner;
    if (this.tricksPlayed === 13) this.endRound();
  }

  private endRound() {
    const shooter = this.taken.findIndex((t) => t === 26);
    if (shooter >= 0) {
      this.moon = shooter;
      this.scores = this.scores.map((s, i) => (i === shooter ? s : s + 26));
    } else this.scores = this.scores.map((s, i) => s + this.taken[i]!);
    this.phase = Math.max(...this.scores) >= this.target ? 'game-over' : 'round-over';
  }

  /** Lowest score wins (ties share the win). */
  winners(): number[] {
    const low = Math.min(...this.scores);
    return this.scores.flatMap((s, i) => (s === low ? [i] : []));
  }
}

// ----- computer players -----

/** Three cards to pass: the queen, king and ace of spades, high hearts, then cards that empty a short suit. */
export function choosePass(hand: Card[]): Card[] {
  const spades = ofSuit(hand, SPADES);
  const danger = (c: Card) => {
    let v = power(c);
    if (c.suit === SPADES) v = power(c) >= 12 && spades.length < 5 ? 30 + power(c) : power(c) - 6;
    if (c.suit === HEARTS) v += 4;
    // Prefer emptying short suits (not spades, which protect the queen).
    if (c.suit !== SPADES && ofSuit(hand, c.suit).length <= 2) v += 6;
    if (c.suit === CLUBS && c.rank === 2) v = -10;
    return v;
  };
  return [...hand].sort((a, b) => danger(b) - danger(a)).slice(0, 3);
}

/** A sensible card: duck under the winning card, dump the queen and high hearts when void, and stop a moon shot. */
export function chooseCard(g: Hearts, seat = g.turn): Card {
  const legal = g.legal(seat);
  if (legal.length === 1) return legal[0]!;
  const byPower = [...legal].sort((a, b) => power(a) - power(b));
  const lowest = byPower[0]!;
  const highest = byPower[byPower.length - 1]!;
  const pointsSoFar = g.taken.reduce((n, t) => n + t, 0);
  // Someone else has every point so far and plenty of them: take a heart to stop the moon.
  const shooter = g.taken.findIndex((t, i) => i !== seat && t >= 14 && t === pointsSoFar);
  if (!g.trick.length) {
    // Lead: low cards in a suit that is safe; avoid spades when holding the queen or a high spade.
    const hand = g.hands[seat]!;
    const holdsQueenRisk = hand.some((c) => c.suit === SPADES && power(c) >= 12);
    const safe = legal.filter((c) => !(c.suit === SPADES && (holdsQueenRisk || power(c) >= 12)) && c.suit !== 1);
    const pool = safe.length ? safe : legal;
    return [...pool].sort((a, b) => power(a) - power(b))[0]!;
  }
  const led = g.trick[0]!.card.suit;
  const win = currentWinner(g.trick)!;
  const trickPoints = g.trick.reduce((n, p) => n + cardPoints(p.card), 0);
  const following = legal[0]!.suit === led;
  if (following) {
    if (shooter >= 0 && win.seat === shooter && (trickPoints > 0 || g.trick.length === 3)) {
      const over = byPower.filter((c) => power(c) > power(win.card));
      if (over.length) return over[0]!;
    }
    // Duck: highest card that still loses the trick.
    const under = byPower.filter((c) => power(c) < power(win.card));
    if (under.length) {
      // Never drop the queen of spades on our own trick unless it loses.
      return under[under.length - 1]!;
    }
    // Must win: last to play with no points, take it with the highest; else the lowest.
    if (g.trick.length === 3 && trickPoints === 0) {
      const noQueen = byPower.filter((c) => !QUEEN_SPADES(c));
      return noQueen[noQueen.length - 1] ?? highest;
    }
    const noQueen = byPower.filter((c) => !QUEEN_SPADES(c));
    return noQueen[noQueen.length - 1] ?? lowest;
  }
  // Void in the suit led: dump the queen, then high hearts, then the highest card.
  if (shooter >= 0 && win.seat === shooter) {
    const queen = legal.find(QUEEN_SPADES);
    if (queen) return queen;
  }
  const queen = legal.find(QUEEN_SPADES);
  if (queen) return queen;
  const hearts = legal.filter((c) => c.suit === HEARTS).sort((a, b) => power(b) - power(a));
  if (hearts.length) return hearts[0]!;
  const highSpade = legal.filter((c) => c.suit === SPADES && power(c) > 12);
  if (highSpade.length) return highSpade[0]!;
  return highest;
}
