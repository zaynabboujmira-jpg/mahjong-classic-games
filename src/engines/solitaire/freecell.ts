import { FULL_DECK, isRed, type Card, type Suit } from './cards';
import { cell, foundation, samePile, tableau, type Hint, type PileRef, type SolitaireEngine, type TableSpec } from './table';

/** Microsoft FreeCell numbered the original deals 1 to 32000; the same generator works for any 31-bit number. */
export const MS_DEAL_MAX = 1_000_000;

/** FreeCell table: four free cells, four foundations, eight cascades. */
export const FREECELL_SPEC: TableSpec = {
  columns: 8,
  tableau: 8,
  top: [...[0, 1, 2, 3].map((i) => ({ pile: cell(i), col: i })), ...[0, 1, 2, 3].map((i) => ({ pile: foundation(i), col: 4 + i, label: 'A' }))],
};

/** Microsoft card order: index = rank*4 + suit, suits in Clubs, Diamonds, Hearts, Spades order. */
const MS_SUITS: Suit[] = [3, 2, 1, 0];
const msCard = (c: number): Card => FULL_DECK[MS_SUITS[c % 4]! * 13 + Math.floor(c / 4)]!;

/**
 * The deal Microsoft FreeCell shows for a game number: its C runtime linear
 * congruential generator (seed * 214013 + 2531011 mod 2^31, output bits
 * 16-30) shuffles a deck ordered A♣ A♦ A♥ A♠ 2♣ ... K♠. Returns the eight
 * cascades, dealt row by row from left to right.
 */
export function msDeal(game: number): Card[][] {
  let seed = game >>> 0;
  const rand = () => {
    seed = (seed * 214013 + 2531011) % 2147483648;
    return Math.floor(seed / 65536);
  };
  const deck = Array.from({ length: 52 }, (_, i) => i);
  let left = 52;
  for (let i = 0; i < 52; i++) {
    const j = rand() % left;
    left--;
    // Swap the chosen card with the last remaining one and deal it out.
    [deck[j], deck[left]] = [deck[left]!, deck[j]!];
  }
  // The dealt order is the deck read from the end.
  const order = deck.reverse();
  const cascades: Card[][] = Array.from({ length: 8 }, () => []);
  order.forEach((c, k) => cascades[k % 8]!.push(msCard(c)));
  return cascades;
}

interface State {
  cells: (Card | null)[];
  foundations: Card[][];
  cascades: Card[][];
  moves: number;
}
const clone = (s: State): State => ({
  cells: s.cells.slice(),
  foundations: s.foundations.map((f) => f.slice()),
  cascades: s.cascades.map((c) => c.slice()),
  moves: s.moves,
});

const fits = (card: Card, onto: Card) => card.rank === onto.rank - 1 && isRed(card) !== isRed(onto);

function isRun(cards: readonly Card[], index: number): boolean {
  for (let k = index + 1; k < cards.length; k++) if (!fits(cards[k]!, cards[k - 1]!)) return false;
  return true;
}

/**
 * FreeCell rules. Only single cards really move; a run of N cards can move
 * when there is room to shuffle it through free cells and empty cascades:
 * N <= (free cells + 1) * 2^(empty cascades), not counting an empty
 * destination cascade. After every move, cards that can never be needed in
 * the cascades again go to the foundations automatically.
 */
export class FreeCell implements SolitaireEngine {
  private s: State;
  private readonly history: State[] = [];
  /** The last move, so hints never suggest simply moving the same card back. */
  private last: { card: number; from: PileRef; to: PileRef } | null = null;

  constructor(readonly deal: number) {
    this.s = { cells: [null, null, null, null], foundations: [[], [], [], []], cascades: msDeal(deal), moves: 0 };
  }

  /** Builds a game from an explicit position (tests). */
  static fromPosition(cascades: Card[][], cells: (Card | null)[] = [null, null, null, null], foundations: Card[][] = [[], [], [], []]): FreeCell {
    const g = Object.create(FreeCell.prototype) as FreeCell;
    const c = Array.from({ length: 8 }, (_, i) => cascades[i]?.slice() ?? []);
    Object.assign(g, { deal: 0, history: [], last: null, plan: new Map(), solverCooldown: 0, s: { cells: cells.slice(), foundations: foundations.map((f) => f.slice()), cascades: c, moves: 0 } });
    return g;
  }

  get moves(): number {
    return this.s.moves;
  }
  get canUndo(): boolean {
    return this.history.length > 0;
  }
  get isWon(): boolean {
    return this.s.foundations.every((f) => f.length === 13);
  }
  get status(): string {
    return `Deal #${this.deal}`;
  }
  get freeCells(): number {
    return this.s.cells.filter((c) => !c).length;
  }
  get emptyCascades(): number {
    return this.s.cascades.filter((c) => c.length === 0).length;
  }

  /** Longest run that can move to a destination right now. */
  maxRun(toEmptyCascade: boolean): number {
    const empties = this.emptyCascades - (toEmptyCascade ? 1 : 0);
    return (this.freeCells + 1) * 2 ** Math.max(0, empties);
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
  faceDownIn(): number {
    return 0;
  }

  private commit(next: State) {
    autoPlay(next);
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

  draw(): string | null {
    return null;
  }
  drawBlockedReason(): string | null {
    return 'FreeCell has no stock: every card is dealt face up.';
  }

  pickUp(from: PileRef, index: number): readonly Card[] | null {
    if (from.kind === 'cell') {
      const c = this.s.cells[from.index];
      return c && index === 0 ? [c] : null;
    }
    if (from.kind !== 'tableau') return null;
    const col = this.s.cascades[from.index]!;
    if (index < 0 || index >= col.length || !isRun(col, index)) return null;
    return col.slice(index);
  }

  canMove(from: PileRef, index: number, to: PileRef): boolean {
    if (samePile(from, to)) return false;
    const run = this.pickUp(from, index);
    if (!run) return false;
    const lead = run[0]!;
    if (to.kind === 'cell') return run.length === 1 && !this.s.cells[to.index];
    if (to.kind === 'foundation') {
      if (run.length !== 1) return false;
      const f = this.s.foundations[to.index]!;
      const top = f[f.length - 1];
      return top ? top.suit === lead.suit && lead.rank === top.rank + 1 : lead.rank === 1;
    }
    if (to.kind !== 'tableau') return false;
    const target = this.s.cascades[to.index]!;
    const top = target[target.length - 1];
    if (top && !fits(lead, top)) return false;
    return run.length <= this.maxRun(!top);
  }

  move(from: PileRef, index: number, to: PileRef): boolean {
    if (!this.canMove(from, index, to)) return false;
    const n = clone(this.s);
    let run: Card[];
    if (from.kind === 'cell') {
      run = [n.cells[from.index]!];
      n.cells[from.index] = null;
    } else run = n.cascades[from.index]!.splice(index);
    if (to.kind === 'cell') n.cells[to.index] = run[0]!;
    else if (to.kind === 'foundation') n.foundations[to.index]!.push(run[0]!);
    else n.cascades[to.index]!.push(...run);
    this.last = { card: run[0]!.id, from, to };
    this.commit(n);
    return true;
  }

  /** Foundation, then a cascade with a matching card, then an empty cascade, then a free cell. */
  bestTarget(from: PileRef, index: number): PileRef | null {
    const run = this.pickUp(from, index);
    if (!run) return null;
    if (run.length === 1) for (let f = 0; f < 4; f++) if (this.canMove(from, index, foundation(f))) return foundation(f);
    let empty: PileRef | null = null;
    for (let j = 0; j < 8; j++) {
      if (!this.canMove(from, index, tableau(j))) continue;
      if (this.s.cascades[j]!.length) return tableau(j);
      const wholeColumn = from.kind === 'tableau' && index === 0;
      if (!wholeColumn && !empty) empty = tableau(j);
    }
    if (empty) return empty;
    if (run.length === 1 && from.kind === 'tableau') for (let c = 0; c < 4; c++) if (this.canMove(from, index, cell(c))) return cell(c);
    return null;
  }

  /** Every legal move (used for stuck detection and hints). */
  legalMoves(): { from: PileRef; index: number; to: PileRef }[] {
    const out: { from: PileRef; index: number; to: PileRef }[] = [];
    const sources: { from: PileRef; index: number }[] = [];
    this.s.cells.forEach((c, i) => c && sources.push({ from: cell(i), index: 0 }));
    this.s.cascades.forEach((col, i) => {
      for (let index = col.length - 1; index >= 0 && isRun(col, index); index--) sources.push({ from: tableau(i), index });
    });
    const targets = [...[0, 1, 2, 3].map(foundation), ...Array.from({ length: 8 }, (_, j) => tableau(j)), ...[0, 1, 2, 3].map(cell)];
    for (const s of sources) for (const to of targets) if (this.canMove(s.from, s.index, to)) out.push({ ...s, to });
    return out;
  }

  get isStuck(): boolean {
    return !this.isWon && this.legalMoves().length === 0;
  }

  /** Solver plans keyed by exact position, so following hints never re-solves. */
  private plan = new Map<string, Atomic>();
  /** After a failed solve, skip the solver for a few hints (each failure costs ~0.4 s). */
  private solverCooldown = 0;

  /**
   * The next move of a winning line when the solver finds one (almost every
   * deal, within a few milliseconds); otherwise a heuristic move.
   */
  hint(): Hint | null {
    if (this.isWon) return null;
    const key = exactKey(this.s);
    let step = this.plan.get(key);
    if (!step && this.solverCooldown > 0) this.solverCooldown--;
    else if (!step) {
      const path = solve(this.s);
      if (!path) this.solverCooldown = 5;
      if (path) {
        this.plan.clear();
        let cur = this.s;
        for (const m of path) {
          this.plan.set(exactKey(cur), m);
          cur = applyAtomic(cur, m);
        }
        step = path[0];
      }
    }
    if (step) {
      const index = step.from.kind === 'cell' ? 0 : this.s.cascades[step.from.index]!.length - 1;
      if (this.canMove(step.from, index, step.to)) return { kind: 'move', from: step.from, index, to: step.to };
    }
    return this.heuristicHint();
  }

  /**
   * Fallback when no solution is found: to a foundation; out of a free cell
   * onto a cascade; a run onto a matching cascade when it is not already on
   * its natural parent; a run into an empty cascade; finally parking a card
   * in a free cell. Never suggests simply reversing the previous move.
   */
  heuristicHint(): Hint | null {
    const last = this.last;
    const undoesLast = (m: { from: PileRef; index: number; to: PileRef }) =>
      !!last && samePile(m.from, last.to) && samePile(m.to, last.from) && this.pickUp(m.from, m.index)![0]!.id === last.card;
    const moves = this.legalMoves().filter((m) => !undoesLast(m));
    const pick = (pred: (m: (typeof moves)[number]) => boolean) => moves.find(pred);
    const onParent = (m: (typeof moves)[number]) => {
      if (m.from.kind !== 'tableau' || m.index === 0) return false;
      const col = this.s.cascades[m.from.index]!;
      return fits(col[m.index]!, col[m.index - 1]!);
    };
    const found =
      pick((m) => m.to.kind === 'foundation') ??
      pick((m) => m.from.kind === 'cell' && m.to.kind === 'tableau' && this.s.cascades[m.to.index]!.length > 0) ??
      pick((m) => m.from.kind === 'tableau' && m.to.kind === 'tableau' && this.s.cascades[m.to.index]!.length > 0 && !onParent(m)) ??
      pick((m) => m.from.kind === 'tableau' && m.to.kind === 'tableau' && this.s.cascades[m.to.index]!.length === 0 && m.index > 0 && !onParent(m));
    if (found) return { kind: 'move', ...found };
    // Park a card only if it is not already sitting on its natural parent.
    const toCell = moves
      .filter((m) => m.from.kind === 'tableau' && m.to.kind === 'cell' && !onParent(m))
      .sort((a, b) => this.s.cascades[a.from.index]!.length - this.s.cascades[b.from.index]!.length)[0];
    return toCell ? { kind: 'move', ...toCell } : null;
  }

  /** Every cascade is already in descending order, so the rest plays itself. */
  get canAutoFinish(): boolean {
    return !this.isWon && this.s.cascades.every((c) => c.every((card, i) => i === 0 || card.rank < c[i - 1]!.rank));
  }

  autoFinishStep(): boolean {
    let best: { from: PileRef; index: number; to: PileRef; rank: number } | null = null;
    const consider = (from: PileRef, index: number, card: Card) => {
      for (let f = 0; f < 4; f++) {
        if (this.canMove(from, index, foundation(f)) && (!best || card.rank < best.rank)) best = { from, index, to: foundation(f), rank: card.rank };
      }
    };
    this.s.cells.forEach((c, i) => c && consider(cell(i), 0, c));
    this.s.cascades.forEach((col, i) => col.length && consider(tableau(i), col.length - 1, col[col.length - 1]!));
    if (!best) return false;
    const { from, index, to } = best as { from: PileRef; index: number; to: PileRef };
    return this.move(from, index, to);
  }
}

/** Foundation rank reached by a suit (0 = not started). */
const rankOf = (s: State, suit: Suit) => {
  const f = s.foundations.find((p) => p.length && p[0]!.suit === suit);
  return f ? f.length : 0;
};

/**
 * Moves "safe" cards to the foundations: a card is safe when no card of the
 * opposite colour could still need to be placed on it, i.e. both
 * opposite-colour foundations already hold rank - 1 (Aces and 2s are always safe).
 */
export function autoPlay(s: State): void {
  for (let changed = true; changed; ) {
    changed = false;
    const tops: { card: Card; take: () => void }[] = [];
    s.cells.forEach((c, i) => c && tops.push({ card: c, take: () => (s.cells[i] = null) }));
    s.cascades.forEach((col) => col.length && tops.push({ card: col[col.length - 1]!, take: () => col.pop() }));
    for (const { card, take } of tops) {
      const opp: Suit[] = isRed(card) ? [0, 3] : [1, 2];
      const safe = card.rank <= 2 || opp.every((o) => rankOf(s, o) >= card.rank - 1);
      if (!safe) continue;
      let f = s.foundations.findIndex((p) => p.length && p[0]!.suit === card.suit);
      if (f < 0 && card.rank === 1) f = s.foundations.findIndex((p) => p.length === 0);
      if (f < 0 || s.foundations[f]!.length !== card.rank - 1) continue;
      take();
      s.foundations[f]!.push(card);
      changed = true;
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Solver: greedy best-first search over single-card moves, with the same
// safe auto-play as the game. Finds a solution for nearly every deal within
// the node limit; returns null when it gives up (e.g. the unsolvable #11982).

interface Atomic {
  from: PileRef;
  to: PileRef;
}

const exactKey = (s: State) =>
  `${s.cells.map((c) => (c ? c.id : '-')).join(',')}/${s.foundations.map((f) => f.length).join(',')}/${s.cascades.map((c) => c.map((x) => x.id).join('.')).join('|')}`;

/** Position identity ignoring the order of cells and cascades (they are interchangeable). */
const canonicalKey = (s: State) =>
  `${s.cells.map((c) => (c ? c.id : 99)).sort((a, b) => a - b).join(',')}/${[0, 1, 2, 3].map((suit) => rankOf(s, suit as Suit)).join(',')}/${s.cascades
    .map((c) => c.map((x) => x.id).join('.'))
    .sort()
    .join('|')}`;

function atomicMoves(s: State): Atomic[] {
  const out: Atomic[] = [];
  const firstEmptyCell = s.cells.findIndex((c) => !c);
  const firstEmptyCascade = s.cascades.findIndex((c) => c.length === 0);
  const sources: { from: PileRef; card: Card; alone: boolean }[] = [];
  s.cells.forEach((c, i) => c && sources.push({ from: cell(i), card: c, alone: false }));
  s.cascades.forEach((col, i) => col.length && sources.push({ from: tableau(i), card: col[col.length - 1]!, alone: col.length === 1 }));
  for (const { from, card, alone } of sources) {
    const f = s.foundations.findIndex((p) => (p.length ? p[0]!.suit === card.suit && p.length === card.rank - 1 : card.rank === 1));
    if (f >= 0) out.push({ from, to: foundation(f) });
    s.cascades.forEach((col, j) => {
      if (from.kind === 'tableau' && from.index === j) return;
      const top = col[col.length - 1];
      if (top ? fits(card, top) : j === firstEmptyCascade && !alone) out.push({ from, to: tableau(j) });
    });
    if (from.kind === 'tableau' && firstEmptyCell >= 0) out.push({ from, to: cell(firstEmptyCell) });
  }
  return out;
}

function applyAtomic(s: State, m: Atomic): State {
  const n = clone(s);
  const card = m.from.kind === 'cell' ? n.cells[m.from.index]! : n.cascades[m.from.index]!.pop()!;
  if (m.from.kind === 'cell') n.cells[m.from.index] = null;
  if (m.to.kind === 'cell') n.cells[m.to.index] = card;
  else if (m.to.kind === 'foundation') n.foundations[m.to.index]!.push(card);
  else n.cascades[m.to.index]!.push(card);
  autoPlay(n);
  return n;
}

/**
 * Lower is better. Rewards foundation progress and empty columns; penalises
 * occupied cells, out-of-sequence cards and, most of all, how deeply the next
 * card each foundation needs is buried.
 */
export const SOLVER_WEIGHTS = { found: 10, cell: 1, unordered: 2, empty: 4, buried: 3, depth: 0.3 };
function heuristic(s: State): number {
  const w = SOLVER_WEIGHTS;
  let h = 0;
  for (const f of s.foundations) h -= f.length * w.found;
  for (const c of s.cells) if (c) h += w.cell;
  const need = [0, 1, 2, 3].map((suit) => rankOf(s, suit as Suit) + 1);
  for (const col of s.cascades) {
    if (col.length === 0) h -= w.empty;
    for (let k = 0; k < col.length; k++) {
      const card = col[k]!;
      if (k > 0 && !fits(card, col[k - 1]!)) h += w.unordered;
      if (card.rank === need[card.suit]) h += (col.length - 1 - k) * w.buried;
    }
  }
  return h;
}

interface Node {
  s: State;
  pri: number;
  depth: number;
  parent: Node | null;
  move: Atomic | null;
}

/** 20k nodes solves ~96% of deals (median ~7 ms); a failure costs ~0.4 s, so callers should not retry at once. */
export function solve(start: State, nodeLimit = 20000): Atomic[] | null {
  const heap: Node[] = [];
  const push = (n: Node) => {
    heap.push(n);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (heap[p]!.pri <= heap[i]!.pri) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const pop = (): Node => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]!.pri < heap[m]!.pri) m = l;
        if (r < heap.length && heap[r]!.pri < heap[m]!.pri) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };
  const seen = new Set<string>([canonicalKey(start)]);
  push({ s: start, pri: heuristic(start), depth: 0, parent: null, move: null });
  for (let expanded = 0; heap.length && expanded < nodeLimit; expanded++) {
    const node = pop();
    if (node.s.foundations.every((f) => f.length === 13)) {
      const path: Atomic[] = [];
      for (let n: Node | null = node; n && n.move; n = n.parent) path.push(n.move);
      return path.reverse();
    }
    for (const m of atomicMoves(node.s)) {
      const next = applyAtomic(node.s, m);
      const key = canonicalKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      push({ s: next, pri: heuristic(next) + (node.depth + 1) * SOLVER_WEIGHTS.depth, depth: node.depth + 1, parent: node, move: m });
    }
  }
  return null;
}
