import type { Card } from './cards';

/**
 * Shared vocabulary for every solitaire engine, so one layout module, one
 * renderer and one UI can drive Klondike, Spider and FreeCell.
 */
export type PileKind = 'stock' | 'waste' | 'foundation' | 'tableau' | 'cell';

export interface PileRef {
  readonly kind: PileKind;
  readonly index: number;
}

export const pileRef = (kind: PileKind, index = 0): PileRef => ({ kind, index });
export const STOCK: PileRef = pileRef('stock');
export const WASTE: PileRef = pileRef('waste');
export const foundation = (index: number): PileRef => pileRef('foundation', index);
export const tableau = (index: number): PileRef => pileRef('tableau', index);
export const cell = (index: number): PileRef => pileRef('cell', index);
export const samePile = (a: PileRef, b: PileRef) => a.kind === b.kind && a.index === b.index;

export type Hint = { kind: 'draw' } | { kind: 'move'; from: PileRef; index: number; to: PileRef };

/** What the layout and renderer need to read from a game. */
export interface TableView {
  cardsIn(p: PileRef): readonly Card[];
  /** Number of face-down cards at the bottom of a pile (0 for most piles). */
  faceDownIn(p: PileRef): number;
}

/** The contract every solitaire engine implements for the shared UI. */
export interface SolitaireEngine extends TableView {
  readonly moves: number;
  readonly canUndo: boolean;
  readonly isWon: boolean;
  /** No legal or useful move is left (and no stock action is possible). */
  readonly isStuck: boolean;
  readonly canAutoFinish: boolean;
  /** Short status such as "Deal #1234" or "2 deals left", shown in the toolbar. */
  readonly status: string;
  undo(): boolean;
  pickUp(from: PileRef, index: number): readonly Card[] | null;
  canMove(from: PileRef, index: number, to: PileRef): boolean;
  move(from: PileRef, index: number, to: PileRef): boolean;
  bestTarget(from: PileRef, index: number): PileRef | null;
  hint(): Hint | null;
  /** Stock action (draw or deal). Returns an announcement, or null when not possible. */
  draw(): string | null;
  /** Why the stock action is unavailable right now, if it is. */
  drawBlockedReason(): string | null;
  autoFinishStep(): boolean;
}

/** Where piles sit on the table. Tableau piles occupy grid columns 0..n-1. */
export interface TableSpec {
  columns: number;
  tableau: number;
  top: readonly {
    pile: PileRef;
    col: number;
    /** Fan the top N cards to the right (Klondike Draw 3 waste). */
    fan?: number;
    /** Draw a thin stack instead of piling every card exactly (stock). */
    stack?: boolean;
    /** Hint drawn in an empty slot, e.g. "A" for foundations. */
    label?: string;
  }[];
}

/** Every pile of a spec in keyboard order: top row left to right, then the tableau. */
export function pilesOf(spec: TableSpec): PileRef[] {
  return [...[...spec.top].sort((a, b) => a.col - b.col).map((t) => t.pile), ...Array.from({ length: spec.tableau }, (_, i) => tableau(i))];
}
