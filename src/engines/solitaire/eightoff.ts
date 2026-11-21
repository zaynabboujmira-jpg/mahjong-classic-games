import { shuffleInPlace, type Rng } from '../core/rng';
import { FULL_DECK, cardLabel, type Card } from './cards';
import { cell, foundation, samePile, tableau, type Hint, type PileRef, type SolitaireEngine, type TableSpec } from './table';

/**
 * Eight Off table: eight free cells on the first line, the four foundations
 * centred on a second line, eight columns below.
 */
export const EIGHTOFF_SPEC: TableSpec = {
  columns: 8,
  tableau: 8,
  top: [...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ pile: cell(i), col: i })), ...[0, 1, 2, 3].map((i) => ({ pile: foundation(i), col: 2 + i, label: 'A', row: 1 }))],
};

interface State {
  cells: (Card | null)[];
  foundations: Card[][];
  cascades: Card[][];
  moves: number;
}
const clone = (s: State): State => ({ cells: s.cells.slice(), foundations: s.foundations.map((f) => f.slice()), cascades: s.cascades.map((c) => c.slice()), moves: s.moves });

/** `card` goes on `onto` in a column: same suit, one rank lower. */
const fits = (card: Card, onto: Card) => card.suit === onto.suit && card.rank === onto.rank - 1;
const isRun = (cards: readonly Card[], index: number) => {
  for (let k = index + 1; k < cards.length; k++) if (!fits(cards[k]!, cards[k - 1]!)) return false;
  return true;
};

/**
 * Eight Off rules: 48 cards dealt face up in eight columns of six, the other
 * four in four of the eight free cells. Columns build down in the same suit;
 * only a King (or a run headed by one) may fill an empty column. A run moves
 * when there are enough free cells to shuffle it through: up to free cells + 1
 * cards. Foundations build up by suit from Ace. Because columns build in suit,
 * a card that can go to its foundation is never needed again, so playable
 * cards move up automatically after every move.
 */
export class EightOff implements SolitaireEngine {
  private s: State;
  private readonly history: State[] = [];

  constructor(rng: Rng) {
    const deck = shuffleInPlace(FULL_DECK.slice(), rng);
    const cascades: Card[][] = Array.from({ length: 8 }, () => []);
    deck.slice(0, 48).forEach((c, k) => cascades[k % 8]!.push(c));
    const cells: (Card | null)[] = [...deck.slice(48), null, null, null, null];
    this.s = { cells, foundations: [[], [], [], []], cascades, moves: 0 };
    this.autoPlay(this.s);
  }

  /** Builds a game from an explicit position (tests). */
  static fromPosition(cascades: Card[][], cells: (Card | null)[], foundations: Card[][] = [[], [], [], []]): EightOff {
    const g = Object.create(EightOff.prototype) as EightOff;
    Object.assign(g, { history: [], s: { cells: cells.slice(), foundations: foundations.map((f) => f.slice()), cascades: cascades.map((c) => c.slice()), moves: 0 } });
    return g;
  }

  get moves() {
    return this.s.moves;
  }
  get canUndo() {
    return this.history.length > 0;
  }
  get isWon() {
    return this.s.foundations.every((f) => f.length === 13);
  }
  get status() {
    const free = this.freeCells;
    return `${free} free cell${free === 1 ? '' : 's'}`;
  }
  get freeCells() {
    return this.s.cells.filter((c) => !c).length;
  }

  cardsIn(p: PileRef): readonly Card[] {
    if (p.kind === 'cell') {
      const c = this.s.cells[p.index];
      return c ? [c] : [];
    }
    if (p.kind === 'foundation') return this.s.foundations[p.index]!;
    if (p.kind === 'tableau') return this.s.cascades[p.index]!;
    return [];
  }
  faceDownIn() {
    return 0;
  }

  pickUp(from: PileRef, index: number): readonly Card[] | null {
    const pile = this.cardsIn(from);
    if (index < 0 || index >= pile.length) return null;
    if (from.kind === 'tableau') return isRun(pile, index) ? pile.slice(index) : null;
    return index === pile.length - 1 ? [pile[index]!] : null;
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
    if (to.kind === 'cell') return run.length === 1 && !this.s.cells[to.index];
    if (to.kind === 'tableau') {
      // Cards moving out of a free cell free that cell, but a run is shuffled through the others.
      if (run.length > this.freeCells + 1) return false;
      const col = this.s.cascades[to.index]!;
      const top = col[col.length - 1];
      return top ? fits(lead, top) : lead.rank === 13;
    }
    return false;
  }

  move(from: PileRef, index: number, to: PileRef): boolean {
    if (!this.canMove(from, index, to)) return false;
    const n = clone(this.s);
    let run: Card[];
    if (from.kind === 'cell') {
      run = [n.cells[from.index]!];
      n.cells[from.index] = null;
    } else if (from.kind === 'foundation') run = [n.foundations[from.index]!.pop()!];
    else run = n.cascades[from.index]!.splice(index);
    if (to.kind === 'cell') n.cells[to.index] = run[0]!;
    else if (to.kind === 'foundation') n.foundations[to.index]!.push(run[0]!);
    else n.cascades[to.index]!.push(...run);
    this.autoPlay(n);
    this.history.push(this.s);
    if (this.history.length > 1000) this.history.shift();
    n.moves = this.s.moves + 1;
    this.s = n;
    return true;
  }

  /** Sends every card that can go to a foundation there (always safe when columns build in suit). */
  private autoPlay(n: State) {
    for (let moved = true; moved; ) {
      moved = false;
      const tops: { card: Card; take: () => void }[] = [];
      n.cells.forEach((c, i) => c && tops.push({ card: c, take: () => (n.cells[i] = null) }));
      n.cascades.forEach((col) => col.length && tops.push({ card: col[col.length - 1]!, take: () => col.pop() }));
      for (const { card, take } of tops) {
        const f = n.foundations.findIndex((p) => (p.length ? p[p.length - 1]!.suit === card.suit && p.length === card.rank - 1 : card.rank === 1));
        if (f < 0) continue;
        take();
        n.foundations[f]!.push(card);
        moved = true;
        break;
      }
    }
  }

  undo(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.s = prev;
    return true;
  }

  bestTarget(from: PileRef, index: number): PileRef | null {
    const run = this.pickUp(from, index);
    if (!run) return null;
    if (run.length === 1) for (let f = 0; f < 4; f++) if (this.canMove(from, index, foundation(f))) return foundation(f);
    let empty: PileRef | null = null;
    for (let t = 0; t < 8; t++) {
      if (!this.canMove(from, index, tableau(t))) continue;
      if (this.s.cascades[t]!.length) return tableau(t);
      if (!(from.kind === 'tableau' && index === 0)) empty ??= tableau(t);
    }
    if (empty) return empty;
    if (run.length === 1 && from.kind === 'tableau') for (let c = 0; c < 8; c++) if (!this.s.cells[c]) return cell(c);
    return null;
  }

  /**
   * A useful move: a card onto a column card of its suit (from a cell first,
   * then from another column, preferring moves that empty a column or free a
   * cell), a King to an empty column, then parking a card in a free cell to
   * uncover a card that can then move.
   */
  hint(): Hint | null {
    const s = this.s;
    for (let c = 0; c < 8; c++) {
      if (!s.cells[c]) continue;
      for (let t = 0; t < 8; t++) if (s.cascades[t]!.length && this.canMove(cell(c), 0, tableau(t))) return { kind: 'move', from: cell(c), index: 0, to: tableau(t) };
    }
    for (let i = 0; i < 8; i++) {
      const col = s.cascades[i]!;
      for (let index = 0; index < col.length; index++) {
        if (!isRun(col, index)) continue;
        for (let t = 0; t < 8; t++) {
          if (t === i || !s.cascades[t]!.length) continue;
          if (this.canMove(tableau(i), index, tableau(t))) return { kind: 'move', from: tableau(i), index, to: tableau(t) };
        }
        break;
      }
    }
    for (let c = 0; c < 8; c++) {
      if (s.cells[c]?.rank !== 13) continue;
      for (let t = 0; t < 8; t++) if (this.canMove(cell(c), 0, tableau(t))) return { kind: 'move', from: cell(c), index: 0, to: tableau(t) };
    }
    for (let i = 0; i < 8; i++) {
      const col = s.cascades[i]!;
      const start = col.findIndex((_, k) => isRun(col, k));
      if (start > 0 && col[start]!.rank === 13) for (let t = 0; t < 8; t++) if (!s.cascades[t]!.length && this.canMove(tableau(i), start, tableau(t))) return { kind: 'move', from: tableau(i), index: start, to: tableau(t) };
    }
    // Park the top card of a column if the card under it can then go somewhere.
    const free = s.cells.findIndex((c) => !c);
    if (free >= 0)
      for (let i = 0; i < 8; i++) {
        const col = s.cascades[i]!;
        if (col.length < 2) continue;
        const under = col[col.length - 2]!;
        const fond = s.foundations.some((f) => (f.length ? f[f.length - 1]!.suit === under.suit && f.length === under.rank - 1 : under.rank === 1));
        const onto = s.cascades.some((c2, j) => j !== i && c2.length && fits(under, c2[c2.length - 1]!));
        if (fond || onto) return { kind: 'move', from: tableau(i), index: col.length - 1, to: cell(free) };
      }
    return null;
  }

  /** No legal move at all (free cells full and nothing fits anywhere). */
  get isStuck(): boolean {
    if (this.isWon) return false;
    const froms: { from: PileRef; index: number }[] = [];
    this.s.cells.forEach((c, i) => c && froms.push({ from: cell(i), index: 0 }));
    this.s.cascades.forEach((col, i) => col.forEach((_, k) => froms.push({ from: tableau(i), index: k })));
    const targets = [...[0, 1, 2, 3].map(foundation), ...[0, 1, 2, 3, 4, 5, 6, 7].map(cell), ...[0, 1, 2, 3, 4, 5, 6, 7].map(tableau)];
    return !froms.some(({ from, index }) => targets.some((to) => this.canMove(from, index, to)));
  }

  draw(): string | null {
    return null;
  }
  drawBlockedReason(): string | null {
    return 'Eight Off has no stock: every card is dealt at the start.';
  }

  get canAutoFinish(): boolean {
    // Every column is a single run in suit order: the rest can go up by itself.
    return !this.isWon && this.s.cascades.every((c) => isRun(c, 0));
  }

  autoFinishStep(): boolean {
    const s = this.s;
    let best: { from: PileRef; index: number; to: PileRef; rank: number } | null = null;
    const consider = (from: PileRef, index: number, card: Card) => {
      for (let f = 0; f < 4; f++) if (this.canMove(from, index, foundation(f)) && (!best || card.rank < best.rank)) best = { from, index, to: foundation(f), rank: card.rank };
    };
    s.cells.forEach((c, i) => c && consider(cell(i), 0, c));
    s.cascades.forEach((col, i) => col.length && consider(tableau(i), col.length - 1, col[col.length - 1]!));
    if (best) {
      const b = best as { from: PileRef; index: number; to: PileRef };
      return this.move(b.from, b.index, b.to);
    }
    // Nothing goes up directly: park the top card of the column whose top is lowest.
    const free = s.cells.findIndex((c) => !c);
    if (free < 0) return false;
    let col = -1;
    s.cascades.forEach((c, i) => c.length && (col < 0 || c[c.length - 1]!.rank < s.cascades[col]![s.cascades[col]!.length - 1]!.rank) && (col = i));
    return col >= 0 && this.move(tableau(col), s.cascades[col]!.length - 1, cell(free));
  }
}

export const describeCard = cardLabel;
