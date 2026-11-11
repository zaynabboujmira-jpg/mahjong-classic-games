import type { Rng } from '../core/rng';
import { isRed, shuffledDeck, type Card } from './cards';

export type DrawMode = 1 | 3;

export type PileRef =
  | { readonly kind: 'stock' }
  | { readonly kind: 'waste' }
  | { readonly kind: 'foundation'; readonly index: number }
  | { readonly kind: 'tableau'; readonly index: number };

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

export type Hint = { kind: 'draw' } | { kind: 'move'; from: PileRef; index: number; to: PileRef };

export const STOCK: PileRef = { kind: 'stock' };
export const WASTE: PileRef = { kind: 'waste' };
export const foundation = (index: number): PileRef => ({ kind: 'foundation', index });
export const tableau = (index: number): PileRef => ({ kind: 'tableau', index });
export const samePile = (a: PileRef, b: PileRef) =>
  a.kind === b.kind && ('index' in a ? a.index : -1) === ('index' in b ? b.index : -1);

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
 * Every move is undoable (the state is small, so history stores snapshots).
 */
export class Klondike {
  private s: MutState;
  private readonly history: MutState[] = [];

  constructor(
    rng: Rng,
    readonly drawMode: DrawMode = 1,
  ) {
    const deck = shuffledDeck(rng);
    const tab: MutState['tableau'] = [];
    for (let i = 0; i < 7; i++) {
      tab.push({ cards: deck.splice(0, i + 1), faceDown: i });
    }
    this.s = { stock: deck, waste: [], foundations: [[], [], [], []], tableau: tab, moves: 0 };
  }

  /** Builds a game from an explicit position (tests, future saved games). */
  static fromState(state: KlondikeState, drawMode: DrawMode = 1): Klondike {
    const g = Object.create(Klondike.prototype) as Klondike;
    Object.assign(g, { drawMode, history: [], s: clone(state as MutState) });
    return g;
  }

  get state(): KlondikeState {
    return this.s;
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
  draw(): boolean {
    const n = clone(this.s);
    if (n.stock.length > 0) {
      for (let k = 0; k < this.drawMode && n.stock.length > 0; k++) n.waste.push(n.stock.pop()!);
    } else if (n.waste.length > 0) {
      n.stock = n.waste.reverse();
      n.waste = [];
    } else return false;
    this.commit(n);
    return true;
  }

  /** Cards that would move when picking up `index` of a pile, or null if that card cannot be picked up. */
  pickUp(from: PileRef, index: number): readonly Card[] | null {
    const s = this.s;
    switch (from.kind) {
      case 'stock':
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
      for (let f = 0; f < 4; f++) if (this.canMove(from, index, foundation(f))) return foundation(f);
    }
    const leadsColumn = from.kind === 'tableau' && index === 0;
    let empty: PileRef | null = null;
    for (let t = 0; t < 7; t++) {
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
      for (let f = 0; f < 4; f++) if (this.canMove(from, index, foundation(f))) return { kind: 'move', from, index, to: foundation(f) };
    }
    for (let i = 0; i < 7; i++) {
      const t = s.tableau[i]!;
      if (t.cards.length === 0 || t.faceDown >= t.cards.length) continue;
      const index = t.faceDown; // move the whole face-up run
      if (index === 0) continue; // would only shuffle a column-heading run around
      for (let j = 0; j < 7; j++) {
        if (j !== i && this.canMove(tableau(i), index, tableau(j))) return { kind: 'move', from: tableau(i), index, to: tableau(j) };
      }
    }
    if (s.waste.length) {
      const index = s.waste.length - 1;
      for (let j = 0; j < 7; j++) if (this.canMove(WASTE, index, tableau(j))) return { kind: 'move', from: WASTE, index, to: tableau(j) };
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
      for (let f = 0; f < 4; f++) {
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
  }
}
