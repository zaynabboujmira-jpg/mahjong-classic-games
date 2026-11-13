import { createRng, type Rng } from '../core/rng';

/*
 * Checkers (American rules, 8×8): pieces sit on the dark squares. Men move
 * one square diagonally forward; kings move one square diagonally either
 * way. Jumping is compulsory, and a jumping piece must keep jumping while it
 * can (you may choose which sequence). A man that reaches the far row is
 * crowned and its move ends. You lose with no pieces or no legal move.
 * Forty moves each with no capture or crowning is a draw.
 *
 * Squares are 0..63, row 0 at the top. Red starts at the bottom and moves first.
 */
export const RED = 1;
export const WHITE = 2;
export type Side = 1 | 2;
export const EMPTY = 0;
export const RED_MAN = 1;
export const RED_KING = 2;
export const WHITE_MAN = 3;
export const WHITE_KING = 4;
export type Piece = 0 | 1 | 2 | 3 | 4;

export const sideOf = (p: Piece): Side | 0 => (p === 1 || p === 2 ? RED : p === 3 || p === 4 ? WHITE : 0);
export const isKing = (p: Piece) => p === RED_KING || p === WHITE_KING;
export const isDark = (s: number) => ((s >> 3) + (s & 7)) % 2 === 1;
const DRAW_PLIES = 80;

export interface CMove {
  /** Squares visited: start, then each landing square. */
  path: number[];
  /** Squares of the pieces jumped. */
  captures: number[];
}

export class Checkers {
  board: Piece[] = new Array<Piece>(64).fill(EMPTY);
  turn: Side = RED;
  /** Plies since the last capture or crowning. */
  quiet = 0;
  history: { board: Piece[]; turn: Side; quiet: number; move: CMove }[] = [];

  constructor(setup?: string, turn: Side = RED) {
    if (setup) this.load(setup, turn);
    else
      for (let s = 0; s < 64; s++) {
        if (!isDark(s)) continue;
        const r = s >> 3;
        if (r < 3) this.board[s] = WHITE_MAN;
        else if (r > 4) this.board[s] = RED_MAN;
      }
  }

  /** Loads 8 rows of '.', 'r', 'R', 'w', 'W' (row 0 first) and an optional side to move. */
  load(rows: string, turn: Side = RED) {
    const cells = rows.replace(/\s+/g, '');
    this.board = [...cells].map((ch) => ({ '.': 0, r: 1, R: 2, w: 3, W: 4 })[ch] as Piece);
    this.turn = turn;
    this.quiet = 0;
    this.history = [];
  }

  private forward(p: Piece): number[] {
    if (isKing(p)) return [-1, 1];
    return sideOf(p) === RED ? [-1] : [1];
  }

  private jumpsFrom(from: number, piece: Piece, board: Piece[], path: number[], captures: number[], out: CMove[]) {
    const r = from >> 3;
    const c = from & 7;
    let extended = false;
    const enemy = sideOf(piece) === RED ? WHITE : RED;
    for (const dr of this.forward(piece))
      for (const dc of [-1, 1]) {
        const mr = r + dr;
        const mc = c + dc;
        const lr = r + 2 * dr;
        const lc = c + 2 * dc;
        if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
        const mid = mr * 8 + mc;
        const land = lr * 8 + lc;
        if (sideOf(board[mid]!) !== enemy || captures.includes(mid) || board[land] !== EMPTY) continue;
        extended = true;
        const crowned = !isKing(piece) && (sideOf(piece) === RED ? lr === 0 : lr === 7);
        if (crowned) out.push({ path: [...path, land], captures: [...captures, mid] });
        else this.jumpsFrom(land, piece, board, [...path, land], [...captures, mid], out);
      }
    if (!extended && captures.length) out.push({ path, captures });
  }

  /** All legal moves for the side to move; jumps are compulsory. */
  moves(side: Side = this.turn): CMove[] {
    const jumps: CMove[] = [];
    const steps: CMove[] = [];
    for (let s = 0; s < 64; s++) {
      const p = this.board[s]!;
      if (sideOf(p) !== side) continue;
      // The moving piece leaves its square, so a king may jump back through it.
      const b = [...this.board];
      b[s] = EMPTY;
      this.jumpsFrom(s, p, b, [s], [], jumps);
      if (jumps.length) continue;
      const r = s >> 3;
      const c = s & 7;
      for (const dr of this.forward(p))
        for (const dc of [-1, 1]) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
          if (this.board[nr * 8 + nc] === EMPTY) steps.push({ path: [s, nr * 8 + nc], captures: [] });
        }
    }
    return jumps.length ? jumps : steps;
  }

  play(m: CMove) {
    this.history.push({ board: [...this.board], turn: this.turn, quiet: this.quiet, move: m });
    const from = m.path[0]!;
    const to = m.path[m.path.length - 1]!;
    let p = this.board[from]!;
    this.board[from] = EMPTY;
    for (const c of m.captures) this.board[c] = EMPTY;
    const crowned = !isKing(p) && (sideOf(p) === RED ? to >> 3 === 0 : to >> 3 === 7);
    if (crowned) p = (p + 1) as Piece;
    this.board[to] = p;
    this.quiet = m.captures.length || crowned ? 0 : this.quiet + 1;
    this.turn = this.turn === RED ? WHITE : RED;
  }

  undo(): CMove | null {
    const h = this.history.pop();
    if (!h) return null;
    this.board = h.board;
    this.turn = h.turn;
    this.quiet = h.quiet;
    return h.move;
  }

  count(side: Side) {
    return this.board.filter((p) => sideOf(p) === side).length;
  }

  /** The winner, 'draw', or null while the game goes on. */
  result(): Side | 'draw' | null {
    if (this.moves().length === 0) return this.turn === RED ? WHITE : RED;
    if (this.quiet >= DRAW_PLIES) return 'draw';
    return null;
  }
}

// ----- computer player -----

export type CheckersLevel = 'easy' | 'medium' | 'hard';
export const CHECKERS_LEVELS: readonly CheckersLevel[] = ['easy', 'medium', 'hard'];
const DEPTH: Record<CheckersLevel, number> = { easy: 2, medium: 4, hard: 7 };
const WIN = 100_000;

/** Material and position from `side`'s point of view. */
export function evaluate(g: Checkers, side: Side): number {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = g.board[i]!;
    if (!p) continue;
    const r = i >> 3;
    const c = i & 7;
    let v = isKing(p) ? 165 : 100;
    if (!isKing(p)) {
      // Advance, and keep the back row as a guard against kings.
      const adv = sideOf(p) === RED ? 7 - r : r;
      v += adv * 4;
      if (adv === 0) v += 8;
    } else v += c > 1 && c < 6 && r > 1 && r < 6 ? 8 : 0;
    if (c > 1 && c < 6) v += 3;
    s += sideOf(p) === side ? v : -v;
  }
  return s;
}

function search(g: Checkers, depth: number, alpha: number, beta: number, me: Side, ply: number): number {
  const moves = g.moves();
  if (!moves.length) return g.turn === me ? -WIN + ply : WIN - ply;
  if (g.quiet >= DRAW_PLIES) return 0;
  // Keep searching while captures are pending, so exchanges are seen to the end.
  if (depth <= 0 && (!moves[0]!.captures.length || depth < -6)) return evaluate(g, me);
  const maximizing = g.turn === me;
  let best = maximizing ? -Infinity : Infinity;
  moves.sort((a, b) => b.captures.length - a.captures.length);
  for (const m of moves) {
    g.play(m);
    const v = search(g, depth - 1, alpha, beta, me, ply + 1);
    g.undo();
    if (maximizing) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseCheckersMove(game: Checkers, level: CheckersLevel, rng: Rng = createRng(game.board.join('') + game.turn)): CMove | null {
  const g = new Checkers();
  g.board = [...game.board];
  g.turn = game.turn;
  g.quiet = game.quiet;
  const moves = g.moves();
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0]!;
  const me = g.turn;
  const scored = moves.map((m) => {
    g.play(m);
    const v = search(g, DEPTH[level] - 1, -Infinity, Infinity, me, 1);
    g.undo();
    return { m, v: v + (level === 'easy' ? (rng() - 0.5) * 120 : level === 'medium' ? (rng() - 0.5) * 6 : rng() * 0.5) };
  });
  scored.sort((a, b) => b.v - a.v);
  return scored[0]!.m;
}
