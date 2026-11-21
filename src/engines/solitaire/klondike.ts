import type { Rng } from '../core/rng';
import { shuffleInPlace } from '../core/rng';
import { FULL_DECK, cardLabel, isRed, type Card } from './cards';
import { STOCK, WASTE, foundation, samePile, tableau, type Hint, type PileRef, type SolitaireEngine, type TableSpec } from './table';

export { STOCK, WASTE, foundation, samePile, tableau, type Hint, type PileRef } from './table';

export type DrawMode = 1 | 3;
/** Klondike uses one deck; Double Klondike two (104 cards, nine columns, eight foundations). */
export type Decks = 1 | 2;

export interface TableauPile {
  readonly cards: readonly Card[];
  /** The first `faceDown` cards are hidden; the rest are face up. */
  readonly faceDown: number;
}

export interface KlondikeState {
  readonly stock: readonly Card[]; // last element = top
  readonly waste: readonly Card[]; // last element = top
  readonly foundations: readonly (readonly Card[])[];
  readonly tableau: readonly TableauPile[];
  readonly moves: number;
}

/**
 * Klondike table: stock, waste, gap, four foundations; seven columns below.
 * Double Klondike: stock and waste, then eight foundations in one row of ten
 * slots, above nine columns.
 */
export const klondikeSpec = (drawMode: DrawMode, decks: Decks = 1): TableSpec =>
  decks === 2
    ? {
        columns: 10,
        tableau: 9,
        top: [
          { pile: STOCK, col: 0, stack: true, label: '↻' },
          { pile: WASTE, col: 1, fan: drawMode === 3 ? 3 : 1 },
          ...[0, 1, 2, 3, 4, 5, 6, 7].map((f) => ({ pile: foundation(f), col: 2 + f, label: 'A' })),
        ],
      }
    : {
        columns: 7,
        tableau: 7,
        top: [
          { pile: STOCK, col: 0, stack: true, label: '↻' },
          { pile: WASTE, col: 1, fan: drawMode === 3 ? 3 : 1 },
          ...[0, 1, 2, 3].map((f) => ({ pile: foundation(f), col: 3 + f, label: 'A' })),
        ],
      };

interface MutState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: { cards: Card[]; faceDown: number }[];
  moves: number;
}

const clone = (s: MutState): MutState => ({
  stock: s.stock.slice(),
  waste: s.waste.slice(),
  foundations: s.foundations.map((f) => f.slice()),
  tableau: s.tableau.map((t) => ({ cards: t.cards.slice(), faceDown: t.faceDown })),
  moves: s.moves,
});

const HISTORY_LIMIT = 1000;

/**
 * Klondike rules, framework-free. Standard rules: build tableau down in
 * alternating colours, only Kings on empty columns, foundations up by suit
 * from Ace, unlimited passes through the stock in Draw 1 or Draw 3.
 * With two decks (Double Klondike) there are nine columns of 1 to 9 cards
 * and eight foundations, two for each suit.
 * Every move is undoable (the state is small, so history stores snapshots).
 */
export class Klondike implements SolitaireEngine {
  private s: MutState;
  private readonly history: MutState[] = [];

  /** Number of tableau columns and foundations (7 and 4, or 9 and 8 with two decks). */
  readonly cols: number;
  readonly nf: number;

  constructor(
    rng: Rng,
    readonly drawMode: DrawMode = 1,
    readonly decks: Decks = 1,
  ) {
    this.cols = decks === 2 ? 9 : 7;
    this.nf = decks * 4;
    const deck = shuffleInPlace(decks === 2 ? [...FULL_DECK, ...FULL_DECK] : FULL_DECK.slice(), rng);
    const tab: MutState['tableau'] = [];
    for (let i = 0; i < this.cols; i++) {
      tab.push({ cards: deck.splice(0, i + 1), faceDown: i });
    }
    this.s = { stock: deck, waste: [], foundations: Array.from({ length: this.nf }, () => []), tableau: tab, moves: 0 };
  }

  /** Builds a game from an explicit position (tests, future saved games). */
  static fromState(state: KlondikeState, drawMode: DrawMode = 1): Klondike {
    const g = Object.create(Klondike.prototype) as Klondike;
    const decks = state.foundations.length === 8 ? 2 : 1;
    Object.assign(g, { drawMode, decks, cols: state.tableau.length, nf: state.foundations.length, history: [], s: clone(state as MutState) });
    return g;
  }

  get state(): KlondikeState {
    return this.s;
  }
  get moves(): number {
    return this.s.moves;
  }
  get status(): string {
    return `Draw ${this.drawMode}${this.decks === 2 ? ' · 2 decks' : ''}`;
  }
  /** Truly stuck: stock and waste are empty and no card can legally move anywhere. */
  get isStuck(): boolean {
    if (this.isWon || this.s.stock.length || this.s.waste.length) return false;
    const targets = this.range(this.nf).map(foundation).concat(this.range(this.cols).map(tableau));
    for (let i = 0; i < this.cols; i++) {
      const t = this.s.tableau[i]!;
      for (let index = t.faceDown; index < t.cards.length; index++) {
        if (targets.some((to) => this.canMove(tableau(i), index, to))) return false;
      }
    }
    for (let f = 0; f < this.nf; f++) {
      const n = this.s.foundations[f]!.length;
      if (n && targets.some((to) => this.canMove(foundation(f), n - 1, to))) return false;
    }
    return true;
  }
  private range = (n: number) => Array.from({ length: n }, (_, i) => i);

  cardsIn(p: PileRef): readonly Card[] {
    return pileCards(this.s, p);
  }
  faceDownIn(p: PileRef): number {
    return p.kind === 'tableau' ? this.s.tableau[p.index]!.faceDown : 0;
  }
  drawBlockedReason(): string | null {
    return this.s.stock.length || this.s.waste.length ? null : 'The stock and waste are empty.';
  }
  get canUndo(): boolean {
    return this.history.length > 0;
  }
  get isWon(): boolean {
    return this.s.foundations.every((f) => f.length === 13);
  }

  private commit(next: MutState) {
    this.history.push(this.s);
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
    next.moves = this.s.moves + 1;
    this.s = next;
  }

  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.s = prev;
    return true;
  }

  /** Turn cards from stock to waste, or turn the waste back over when the stock is empty. */
  draw(): string | null {
    const n = clone(this.s);
    if (n.stock.length > 0) {
      for (let k = 0; k < this.drawMode && n.stock.length > 0; k++) n.waste.push(n.stock.pop()!);
    } else if (n.waste.length > 0) {
      n.stock = n.waste.reverse();
      n.waste = [];
      this.commit(n);
      return 'Waste turned over.';
    } else return null;
    this.commit(n);
    const top = cardLabel(n.waste[n.waste.length - 1]!);
    return this.drawMode === 3 ? `Turned up to 3 cards; ${top} is on top.` : `Drew ${top}.`;
  }

  /** Cards that would move when picking up `index` of a pile, or null if that card cannot be picked up. */
  pickUp(from: PileRef, index: number): readonly Card[] | null {
    const s = this.s;
    switch (from.kind) {
      case 'stock':
      case 'cell':
        return null;
      case 'waste':
        return index === s.waste.length - 1 && index >= 0 ? [s.waste[index]!] : null;
      case 'foundation': {
        const f = s.foundations[from.index]!;
        return index === f.length - 1 && index >= 0 ? [f[index]!] : null;
      }
      case 'tableau': {
        const t = s.tableau[from.index]!;
        if (index < t.faceDown || index >= t.cards.length) return null;
        const run = t.cards.slice(index);
        for (let k = 1; k < run.length; k++) {
          if (!fitsOnTableau(run[k]!, run[k - 1]!)) return null;
        }
        return run;
      }
    }
  }

  canMove(from: PileRef, index: number, to: PileRef): boolean {
    if (samePile(from, to)) return false;
    const run = this.pickUp(from, index);
    if (!run) return false;
    const lead = run[0]!;
    if (to.kind === 'foundation') {
      if (run.length !== 1) return false;
      const f = this.s.foundations[to.index]!;
      const top = f[f.length - 1];
      return top ? top.suit === lead.suit && lead.rank === top.rank + 1 : lead.rank === 1;
    }
    if (to.kind === 'tableau') {
      const t = this.s.tableau[to.index]!;
      const top = t.cards[t.cards.length - 1];
      return top ? fitsOnTableau(lead, top) : lead.rank === 13;
    }
    return false;
  }

  move(from: PileRef, index: number, to: PileRef): boolean {
    if (!this.canMove(from, index, to)) return false;
    const n = clone(this.s);
    const source = pileCards(n, from);
    const run = source.splice(index);
    pileCards(n, to).push(...run);
    if (from.kind === 'tableau') {
      const t = n.tableau[from.index]!;
      // Turn over the newly exposed card.
      if (t.cards.length > 0 && t.faceDown >= t.cards.length) t.faceDown = t.cards.length - 1;
    }
    this.commit(n);
    return true;
  }

  /**
   * Where a tap (or the "auto-move" key) should send a card: a foundation if
   * possible, otherwise the first useful tableau column. Never suggests moving
   * a King that already heads an otherwise empty column onto another empty one.
   */
  bestTarget(from: PileRef, index: number): PileRef | null {
    const run = this.pickUp(from, index);
    if (!run) return null;
    if (run.length === 1 && from.kind !== 'foundation') {
      for (let f = 0; f < this.nf; f++) if (this.canMove(from, index, foundation(f))) return foundation(f);
    }
    const leadsColumn = from.kind === 'tableau' && index === 0;
    let empty: PileRef | null = null;
    for (let t = 0; t < this.cols; t++) {
      const to = tableau(t);
      if (!this.canMove(from, index, to)) continue;
      if (this.s.tableau[t]!.cards.length > 0) return to;
      if (!leadsColumn && !empty) empty = to;
    }
    return empty;
  }

  /**
   * A useful next move, in priority order: anything onto a foundation, a
   * tableau move that turns over a hidden card or frees a column, the waste
   * card onto the tableau, then drawing. Returns null only when stock and
   * waste are empty and no productive move exists.
   */
  hint(): Hint | null {
    const s = this.s;
    const tops: { from: PileRef; index: number }[] = [];
    if (s.waste.length) tops.push({ from: WASTE, index: s.waste.length - 1 });
    s.tableau.forEach((t, i) => t.cards.length && tops.push({ from: tableau(i), index: t.cards.length - 1 }));
    for (const { from, index } of tops) {
      for (let f = 0; f < this.nf; f++) if (this.canMove(from, index, foundation(f))) return { kind: 'move', from, index, to: foundation(f) };
    }
    for (let i = 0; i < this.cols; i++) {
      const t = s.tableau[i]!;
      if (t.cards.length === 0 || t.faceDown >= t.cards.length) continue;
      const index = t.faceDown; // move the whole face-up run
      if (index === 0) continue; // would only shuffle a column-heading run around
      for (let j = 0; j < this.cols; j++) {
        if (j !== i && this.canMove(tableau(i), index, tableau(j))) return { kind: 'move', from: tableau(i), index, to: tableau(j) };
      }
    }
    if (s.waste.length) {
      const index = s.waste.length - 1;
      for (let j = 0; j < this.cols; j++) if (this.canMove(WASTE, index, tableau(j))) return { kind: 'move', from: WASTE, index, to: tableau(j) };
    }
    if (s.stock.length || s.waste.length) return { kind: 'draw' };
    return null;
  }

  /** Everything is face up and stock/waste are empty: the game can finish itself. */
  get canAutoFinish(): boolean {
    const s = this.s;
    return !this.isWon && s.stock.length === 0 && s.waste.length === 0 && s.tableau.every((t) => t.faceDown === 0);
  }

  /** Moves the lowest available card to a foundation. Returns false when nothing could move. */
  autoFinishStep(): boolean {
    let best: { from: PileRef; index: number; to: PileRef; rank: number } | null = null;
    this.s.tableau.forEach((t, i) => {
      const index = t.cards.length - 1;
      if (index < 0) return;
      for (let f = 0; f < this.nf; f++) {
        if (this.canMove(tableau(i), index, foundation(f)) && (!best || t.cards[index]!.rank < best.rank)) {
          best = { from: tableau(i), index, to: foundation(f), rank: t.cards[index]!.rank };
        }
      }
    });
    if (!best) return false;
    const { from, index, to } = best as { from: PileRef; index: number; to: PileRef };
    return this.move(from, index, to);
  }
}

/** Can `card` be placed on `onto` in the tableau (one rank lower, opposite colour)? */
export const fitsOnTableau = (card: Card, onto: Card) => card.rank === onto.rank - 1 && isRed(card) !== isRed(onto);

function pileCards(s: MutState, p: PileRef): Card[] {
  switch (p.kind) {
    case 'stock':
      return s.stock;
    case 'waste':
      return s.waste;
    case 'foundation':
      return s.foundations[p.index]!;
    case 'tableau':
      return s.tableau[p.index]!.cards;
    case 'cell':
      return [];
  }
}
