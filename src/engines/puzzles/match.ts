import { createRng, shuffleInPlace as shuffle } from '../core/rng';

/*
 * Memory Match: pairs of face-down cards. Turn two over; a pair stays face
 * up, two different cards turn back over on the next turn (or after a short
 * pause in the UI). A move is one pair of cards turned.
 */
export const BOARDS = {
  small: { cols: 4, rows: 3, name: 'Small 4×3' },
  medium: { cols: 4, rows: 4, name: 'Medium 4×4' },
  large: { cols: 6, rows: 5, name: 'Large 6×5' },
} as const;
export type BoardId = keyof typeof BOARDS;
export const BOARD_IDS = Object.keys(BOARDS) as BoardId[];
/** Number of different symbols the UI can draw. */
export const SYMBOL_COUNT = 15;

export interface Card {
  symbol: number;
  matched: boolean;
  up: boolean;
}

export type FlipResult = 'ignored' | 'first' | 'match' | 'miss' | 'won';

export class MatchGame {
  readonly board: BoardId;
  readonly cols: number;
  readonly rows: number;
  cards: Card[];
  moves = 0;
  /** Index of the single face-up unmatched card, or -1. */
  private open = -1;
  /** Two unmatched cards left face up after a miss, turned back on the next flip. */
  pendingMiss: [number, number] | null = null;

  constructor(board: BoardId = 'medium', seed = 'match') {
    this.board = board;
    const { cols, rows } = BOARDS[board];
    this.cols = cols;
    this.rows = rows;
    const pairs = (cols * rows) / 2;
    const rng = createRng(`match:${board}:${seed}`);
    const symbols = shuffle(
      Array.from({ length: SYMBOL_COUNT }, (_, i) => i),
      rng,
    ).slice(0, pairs);
    this.cards = shuffle([...symbols, ...symbols], rng).map((symbol) => ({ symbol, matched: false, up: false }));
  }

  get pairs() {
    return this.cards.length / 2;
  }
  get found() {
    return this.cards.filter((c) => c.matched).length / 2;
  }
  get won() {
    return this.cards.every((c) => c.matched);
  }

  /** Turns back a pending mismatched pair (the UI calls this after a pause). */
  hideMiss() {
    if (!this.pendingMiss) return;
    for (const i of this.pendingMiss) this.cards[i]!.up = false;
    this.pendingMiss = null;
  }

  flip(i: number): FlipResult {
    const card = this.cards[i];
    if (!card || card.matched || card.up) {
      // Tapping a card of a pending miss just turns the pair back.
      if (this.pendingMiss && card && !card.matched) {
        this.hideMiss();
        return this.flip(i);
      }
      return 'ignored';
    }
    this.hideMiss();
    card.up = true;
    if (this.open < 0) {
      this.open = i;
      return 'first';
    }
    const a = this.open;
    this.open = -1;
    this.moves++;
    if (this.cards[a]!.symbol === card.symbol) {
      this.cards[a]!.matched = true;
      card.matched = true;
      return this.won ? 'won' : 'match';
    }
    this.pendingMiss = [a, i];
    return 'miss';
  }
}

/** Best-score order: fewer moves, then less time. */
export const better = (a: { moves: number; ms: number }, b: { moves: number; ms: number } | null) =>
  !b || a.moves < b.moves || (a.moves === b.moves && a.ms < b.ms);
