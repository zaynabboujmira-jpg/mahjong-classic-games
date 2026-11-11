import { shuffleInPlace, type Rng } from '../core/rng';

/** Shared playing-card model for every solitaire game (Klondike now; Spider and FreeCell later). */
export type Suit = 0 | 1 | 2 | 3; // spades, hearts, diamonds, clubs

export interface Card {
  /** 0..51, stable identity for caching and tests. */
  readonly id: number;
  readonly suit: Suit;
  /** 1 = Ace ... 13 = King */
  readonly rank: number;
}

export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'] as const;
export const SUIT_NAMES = ['Spades', 'Hearts', 'Diamonds', 'Clubs'] as const;
export const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
const RANK_NAMES = ['', 'Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'] as const;

export const isRed = (c: Card) => c.suit === 1 || c.suit === 2;
export const cardLabel = (c: Card) => `${RANK_NAMES[c.rank]} of ${SUIT_NAMES[c.suit]}`;

export const FULL_DECK: readonly Card[] = Array.from({ length: 52 }, (_, id) => ({
  id,
  suit: Math.floor(id / 13) as Suit,
  rank: (id % 13) + 1,
}));

export function shuffledDeck(rng: Rng): Card[] {
  return shuffleInPlace(FULL_DECK.slice(), rng);
}
