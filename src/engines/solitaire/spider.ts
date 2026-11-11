import { shuffleInPlace, type Rng } from '../core/rng';
import { FULL_DECK, cardLabel, type Card, type Suit } from './cards';
import { STOCK, foundation, samePile, tableau, type Hint, type PileRef, type SolitaireEngine, type TableSpec } from './table';

export type SuitCount = 1 | 2 | 4;

interface Column {
  cards: Card[];
  faceDown: number;
}
interface State {
  stock: Card[];
  columns: Column[];
  /** Completed King-to-Ace runs, King on top for display. */
  done: Card[][];
  moves: number;
}

const clone = (s: State): State => ({
  stock: s.stock.slice(),
  columns: s.columns.map((c) => ({ cards: c.cards.slice(), faceDown: c.faceDown })),
  done: s.done.map((d) => d.slice()),
  moves: s.moves,
});

/** Spider table: eight completed-run slots on the left, the stock on the far right, ten columns. */
export const SPIDER_SPEC: TableSpec = {
  columns: 10,
  tableau: 10,
  top: [
    ...Array.from({ length: 8 }, (_, i) => ({ pile: foundation(i), col: i, label: 'K' })),
    { pile: STOCK, col: 9, stack: true },
  ],
};

/** The 104 cards of two decks restricted to 1, 2 or 4 suits (spades, then hearts, then all). */
export function spiderDeck(suits: SuitCount): Card[] {
  const used: Suit[] = suits === 1 ? [0] : suits === 2 ? [0, 1] : [0, 1, 2, 3];
  const copies = 8 / used.length;
  const deck: Card[] = [];
  for (const suit of used) for (let k = 0; k < copies; k++) for (let r = 1; r <= 13; r++) deck.push(FULL_DECK[suit * 13 + r - 1]!);
  return deck;
}

/** Cards [index..] of a column form a same-suit descending run. */
function isSuitedRun(cards: readonly Card[], index: number): boolean {
  for (let k = index + 1; k < cards.length; k++) {
    const a = cards[k - 1]!;
    const b = cards[k]!;
    if (b.suit !== a.suit || b.rank !== a.rank - 1) return false;
  }
  return true;
}

/**
 * Spider Solitaire rules. Runs of one suit in descending order move as a unit;
 * any card (or run) may go on a card one rank higher of any suit, or on an
 * empty column. Dealing adds one card to each column and is only allowed when
 * no column is empty. A complete King-to-Ace run of one suit is cleared
 * automatically. Eight cleared runs win.
 */
export class Spider implements SolitaireEngine {
  private s: State;
  private readonly history: State[] = [];
  /** Where the last moved run now starts, so hints never move it straight on again (which could loop). */
  private last: { col: number; index: number } | null = null;

  constructor(
    rng: Rng,
    readonly suits: SuitCount = 1,
  ) {
    const deck = shuffleInPlace(spiderDeck(suits), rng);
    const columns: Column[] = [];
    for (let i = 0; i < 10; i++) {
      const n = i < 4 ? 6 : 5;
      columns.push({ cards: deck.splice(0, n), faceDown: n - 1 });
    }
    this.s = { stock: deck, columns, done: [], moves: 0 };
  }

  /** Builds a game from an explicit position (tests). */
  static fromColumns(columns: { cards: Card[]; faceDown?: number }[], stock: Card[] = [], suits: SuitCount = 4): Spider {
    const g = Object.create(Spider.prototype) as Spider;
    const cols = Array.from({ length: 10 }, (_, i) => ({ cards: columns[i]?.cards.slice() ?? [], faceDown: columns[i]?.faceDown ?? 0 }));
    Object.assign(g, { suits, history: [], last: null, s: { stock: stock.slice(), columns: cols, done: [], moves: 0 } });
    return g;
  }

  get moves(): number {
    return this.s.moves;
  }
  get canUndo(): boolean {
    return this.history.length > 0;
  }
  get completed(): number {
    return this.s.done.length;
  }
  get isWon(): boolean {
    return this.s.done.length === 8;
  }
  get stockDeals(): number {
    return Math.ceil(this.s.stock.length / 10);
  }
  get status(): string {
    const d = this.stockDeals;
    return `${this.suits} suit${this.suits > 1 ? 's' : ''} · ${d} deal${d === 1 ? '' : 's'} left`;
  }
  /** Truly stuck: no deal possible and no legal move at all (hints may give up earlier). */
  get isStuck(): boolean {
    if (this.isWon || !this.drawBlockedReason()) return false;
    for (let i = 0; i < 10; i++) {
      const col = this.s.columns[i]!;
      for (let index = col.faceDown; index < col.cards.length; index++) {
        for (let j = 0; j < 10; j++) if (this.canMove(tableau(i), index, tableau(j))) return false;
      }
    }
    return true;
  }
  get canAutoFinish(): boolean {
    return false;
  }
  autoFinishStep(): boolean {
    return false;
  }

  cardsIn(p: PileRef): readonly Card[] {
    if (p.kind === 'stock') return this.s.stock;
    if (p.kind === 'foundation') return this.s.done[p.index] ?? [];
    if (p.kind === 'tableau') return this.s.columns[p.index]!.cards;
    return [];
  }
  faceDownIn(p: PileRef): number {
    return p.kind === 'tableau' ? this.s.columns[p.index]!.faceDown : 0;
  }

  private commit(next: State) {
    this.history.push(this.s);
    if (this.history.length > 1000) this.history.shift();
    next.moves = this.s.moves + 1;
    this.s = next;
  }

  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.s = prev;
    this.last = null;
    return true;
  }

  drawBlockedReason(): string | null {
    if (this.s.stock.length === 0) return 'No deals left in the stock.';
    if (this.s.columns.some((c) => c.cards.length === 0)) return 'Fill every empty column before dealing.';
    return null;
  }

  /** Deal one face-up card onto each column. */
  draw(): string | null {
    if (this.drawBlockedReason()) return null;
    const n = clone(this.s);
    this.last = null;
    for (const col of n.columns) col.cards.push(n.stock.pop()!);
    const cleared = n.columns.reduce((k, _, i) => k + clearRuns(n, i), 0);
    this.commit(n);
    return `Dealt a new row.${cleared ? ' Completed a run!' : ''}`;
  }

  pickUp(from: PileRef, index: number): readonly Card[] | null {
    if (from.kind !== 'tableau') return null;
    const col = this.s.columns[from.index]!;
    if (index < col.faceDown || index >= col.cards.length) return null;
    return isSuitedRun(col.cards, index) ? col.cards.slice(index) : null;
  }

  canMove(from: PileRef, index: number, to: PileRef): boolean {
    if (to.kind !== 'tableau' || samePile(from, to)) return false;
    const run = this.pickUp(from, index);
    if (!run) return false;
    const target = this.s.columns[to.index]!.cards;
    const top = target[target.length - 1];
    return !top || top.rank === run[0]!.rank + 1;
  }

  move(from: PileRef, index: number, to: PileRef): boolean {
    if (!this.canMove(from, index, to)) return false;
    const n = clone(this.s);
    const src = n.columns[from.index]!;
    this.last = { col: to.index, index: n.columns[to.index]!.cards.length };
    n.columns[to.index]!.cards.push(...src.cards.splice(index));
    flip(src);
    clearRuns(n, to.index);
    this.commit(n);
    return true;
  }

  /** Same-suit parent first, then any parent, then an empty column (never for a run that already heads its column). */
  bestTarget(from: PileRef, index: number): PileRef | null {
    const run = this.pickUp(from, index);
    if (!run) return null;
    const lead = run[0]!;
    let anyParent: PileRef | null = null;
    let empty: PileRef | null = null;
    for (let j = 0; j < 10; j++) {
      const to = tableau(j);
      if (!this.canMove(from, index, to)) continue;
      const t = this.s.columns[j]!.cards;
      if (t.length === 0) {
        if (index > 0 && !empty) empty = to;
      } else if (t[t.length - 1]!.suit === lead.suit) return to;
      else anyParent ??= to;
    }
    return anyParent ?? empty;
  }

  /**
   * A productive move, best first:
   *  1. a run onto a same-suit card one higher (builds towards a clearable run),
   *  2. a move that turns over a hidden card or empties a column,
   *  3. dealing from the stock.
   * Moves that only shuffle an already-built run between equivalent parents
   * are never suggested, so following hints cannot loop.
   */
  hint(): Hint | null {
    const cols = this.s.columns;
    // While deals remain, never suggest emptying a column: the next hint would
    // have to refill it before dealing, which can go round in circles.
    const fillingToDeal = this.s.stock.length > 0;
    let reveal: Hint | null = null;
    for (let i = 0; i < 10; i++) {
      const c = cols[i]!.cards;
      const down = cols[i]!.faceDown;
      for (let index = Math.max(down, 0); index < c.length; index++) {
        if (!isSuitedRun(c, index)) continue;
        if (fillingToDeal && index === 0) continue;
        const lead = c[index]!;
        const above = index > 0 && index - 1 >= down ? c[index - 1]! : null;
        const sitsOnParent = !!above && above.rank === lead.rank + 1;
        const sitsOnSuitedParent = sitsOnParent && above!.suit === lead.suit;
        for (let j = 0; j < 10; j++) {
          if (!this.canMove(tableau(i), index, tableau(j))) continue;
          if (this.last && this.last.col === i && this.last.index === index) continue;
          const t = cols[j]!.cards;
          const top = t[t.length - 1];
          const move: Hint = { kind: 'move', from: tableau(i), index, to: tableau(j) };
          if (top && top.suit === lead.suit && !sitsOnSuitedParent) return move;
          const revealsOrEmpties = (index === down && down > 0) || (index === 0 && !!top);
          if (!reveal && revealsOrEmpties && !sitsOnParent) reveal = move;
        }
      }
    }
    if (reveal) return reveal;
    if (!this.drawBlockedReason()) return { kind: 'draw' };
    // An empty column blocks dealing: fill it, preferring a card that is not
    // already resting on its same-suit parent.
    if (this.s.stock.length && cols.some((c) => c.cards.length === 0)) {
      const empty = cols.findIndex((x) => x.cards.length === 0);
      let fallback: Hint | null = null;
      for (let i = 0; i < 10; i++) {
        const c = cols[i]!;
        if (c.cards.length < 2) continue;
        const index = c.cards.length - 1;
        const top = c.cards[index]!;
        const below = c.cards[index - 1]!;
        const settled = index - 1 >= c.faceDown && below.suit === top.suit && below.rank === top.rank + 1;
        const move: Hint = { kind: 'move', from: tableau(i), index, to: tableau(empty) };
        if (!settled) return move;
        fallback ??= move;
      }
      return fallback;
    }
    return null;
  }
}

/** Turn over a column's new top card if it is face down. */
function flip(col: Column) {
  if (col.cards.length > 0 && col.faceDown >= col.cards.length) col.faceDown = col.cards.length - 1;
}

/** Removes a completed King-to-Ace run from the end of column i. Returns 1 if one was cleared. */
function clearRuns(s: State, i: number): number {
  const col = s.columns[i]!;
  const n = col.cards.length;
  if (n < 13 || n - 13 < col.faceDown) return 0;
  const start = n - 13;
  if (col.cards[start]!.rank !== 13 || !isSuitedRun(col.cards, start)) return 0;
  s.done.push(col.cards.splice(start).reverse());
  flip(col);
  return 1;
}

export const describeRun = (cards: readonly Card[]) =>
  `${cardLabel(cards[0]!)}${cards.length > 1 ? ` and ${cards.length - 1} more` : ''}`;
