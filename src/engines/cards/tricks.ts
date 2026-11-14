import { FULL_DECK, type Card, type Suit } from '../solitaire/cards';
import { shuffleInPlace, type Rng } from '../core/rng';

/*
 * Shared rules for four-player trick-taking games (Hearts, Spades). Aces are
 * high. Seats go clockwise: 0 South (you), 1 West, 2 North, 3 East.
 */
export const SPADES: Suit = 0;
export const HEARTS: Suit = 1;
export const DIAMONDS: Suit = 2;
export const CLUBS: Suit = 3;
export const SEATS = ['You', 'West', 'North', 'East'] as const;

/** Rank for comparing cards: 2..14 (ace high). */
export const power = (c: Card) => (c.rank === 1 ? 14 : c.rank);

export interface Played {
  seat: number;
  card: Card;
}

/** Deals 13 cards to each of four seats, each hand sorted by suit then rank. */
export function deal(rng: Rng): Card[][] {
  const deck = shuffleInPlace(FULL_DECK.slice(), rng);
  return [0, 1, 2, 3].map((s) => sortHand(deck.slice(s * 13, s * 13 + 13)));
}

/** Display order: spades, hearts, clubs, diamonds (alternating colours), low to high. */
const SUIT_ORDER = [0, 1, 3, 2];
export function sortHand(cards: Card[]) {
  return cards.sort((a, b) => SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) || power(a) - power(b));
}

export const ofSuit = (hand: Card[], suit: Suit) => hand.filter((c) => c.suit === suit);

/** Winner of a complete trick: highest trump if any, else highest of the suit led. */
export function trickWinner(trick: Played[], trump: Suit | null = null): number {
  const led = trick[0]!.card.suit;
  let best = trick[0]!;
  for (const p of trick.slice(1)) {
    const a = best.card;
    const b = p.card;
    const bTrump = trump !== null && b.suit === trump;
    const aTrump = trump !== null && a.suit === trump;
    if (bTrump && !aTrump) best = p;
    else if (b.suit === a.suit && power(b) > power(a)) best = p;
    else if (!aTrump && !bTrump && b.suit === led && a.suit !== led) best = p;
  }
  return best.seat;
}

/** The card currently winning an incomplete trick. */
export function currentWinner(trick: Played[], trump: Suit | null = null): Played | null {
  if (!trick.length) return null;
  const seat = trickWinner(trick, trump);
  return trick.find((p) => p.seat === seat)!;
}

export const sameCard = (a: Card, b: Card) => a.id === b.id;
