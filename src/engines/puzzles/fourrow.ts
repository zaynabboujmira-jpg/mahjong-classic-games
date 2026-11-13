import { createRng, type Rng } from '../core/rng';

/*
 * Four in a Row: two players drop discs into a 7-column, 6-row upright grid;
 * a disc falls to the lowest free cell. Four in a line (across, down or
 * diagonal) wins; a full grid is a draw.
 *
 * The computer uses minimax with alpha-beta pruning, centre-first move
 * ordering and a window-counting evaluation. Easy searches 2 plies and
 * sometimes picks a random move; Medium 4 plies; Hard 7 plies.
 */
export const COLS = 7;
export const ROWS = 6;
export type Player = 1 | 2;
export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard'];
const DEPTH: Record<Level, number> = { easy: 2, medium: 4, hard: 7 };
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const WIN = 1_000_000;

/** Every line of four cells, as [row, col] lists (row 0 is the bottom). */
export const LINES: [number, number][][] = (() => {
  const out: [number, number][][] = [];
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of dirs) {
        const cells: [number, number][] = [];
        for (let k = 0; k < 4; k++) {
          const rr = r + dr! * k;
          const cc = c + dc! * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
          cells.push([rr, cc]);
        }
        if (cells.length === 4) out.push(cells);
      }
  return out;
})();

/** The lines through each cell, for a fast win check. */
const LINES_AT: [number, number][][][][] = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) => LINES.filter((l) => l.some(([rr, cc]) => rr === r && cc === c))),
);

export class FourRow {
  /** board[row][col], row 0 at the bottom; 0 = empty. */
  board: (0 | Player)[][] = Array.from({ length: ROWS }, () => new Array<0 | Player>(COLS).fill(0));
  turn: Player = 1;
  winner: Player | 0 = 0;
  /** The winning four cells, when there is a winner. */
  line: [number, number][] | null = null;
  moves: number[] = [];

  get draw() {
    return !this.winner && this.moves.length === ROWS * COLS;
  }
  get over() {
    return this.winner !== 0 || this.draw;
  }

  height(col: number) {
    let h = 0;
    while (h < ROWS && this.board[h]![col]) h++;
    return h;
  }
  canDrop(col: number) {
    return !this.over && col >= 0 && col < COLS && this.height(col) < ROWS;
  }
  validMoves() {
    return ORDER.filter((c) => this.height(c) < ROWS);
  }

  /** Drops the current player's disc; returns the row it landed in, or -1. */
  drop(col: number): number {
    if (!this.canDrop(col)) return -1;
    const row = this.height(col);
    this.board[row]![col] = this.turn;
    this.moves.push(col);
    const line = this.winningLine(row, col);
    if (line) {
      this.winner = this.turn;
      this.line = line;
    }
    this.turn = this.turn === 1 ? 2 : 1;
    return row;
  }

  /** Takes back the last disc. */
  undo(): boolean {
    const col = this.moves.pop();
    if (col === undefined) return false;
    this.board[this.height(col) - 1]![col] = 0;
    this.turn = this.turn === 1 ? 2 : 1;
    this.winner = 0;
    this.line = null;
    return true;
  }

  private winningLine(row: number, col: number): [number, number][] | null {
    const p = this.board[row]![col]!;
    for (const l of LINES_AT[row]![col]!) {
      if (l.every(([r, c]) => this.board[r]![c] === p)) return l;
    }
    return null;
  }

  clone(): FourRow {
    const g = new FourRow();
    g.board = this.board.map((r) => [...r]);
    g.turn = this.turn;
    g.winner = this.winner;
    g.line = this.line;
    g.moves = [...this.moves];
    return g;
  }
}

/** Static score from `me`'s point of view: open twos and threes, centre control. */
export function evaluate(g: FourRow, me: Player): number {
  const you: Player = me === 1 ? 2 : 1;
  let s = 0;
  for (let r = 0; r < ROWS; r++) {
    if (g.board[r]![3] === me) s += 3;
    else if (g.board[r]![3] === you) s -= 3;
  }
  for (const l of LINES) {
    let mine = 0;
    let theirs = 0;
    for (const [r, c] of l) {
      const v = g.board[r]![c];
      if (v === me) mine++;
      else if (v === you) theirs++;
    }
    if (mine && theirs) continue;
    if (mine === 3) s += 50;
    else if (mine === 2) s += 6;
    if (theirs === 3) s -= 60;
    else if (theirs === 2) s -= 6;
  }
  return s;
}

/** Columns where the player to move would win at once. */
function winningMoves(g: FourRow, player: Player): number[] {
  const out: number[] = [];
  const turn = g.turn;
  g.turn = player;
  for (const c of g.validMoves()) {
    g.drop(c);
    if (g.winner === player) out.push(c);
    g.undo();
  }
  g.turn = turn;
  return out;
}

/**
 * Alpha-beta search with threat forcing: a node takes an immediate win at
 * once, and when the opponent threatens to win it only considers blocking
 * (two threats at once is a lost position). This keeps tactics sharp at a
 * modest depth.
 */
function search(g: FourRow, depth: number, alpha: number, beta: number, me: Player): number {
  if (g.winner) return g.winner === me ? WIN + depth : -WIN - depth;
  if (g.draw) return 0;
  const mover = g.turn;
  const sign = mover === me ? 1 : -1;
  if (winningMoves(g, mover).length) return sign * (WIN + depth);
  if (depth <= 0) return evaluate(g, me);
  const threats = winningMoves(g, mover === 1 ? 2 : 1);
  if (threats.length > 1) return -sign * (WIN + depth - 1);
  const moves = threats.length === 1 ? threats : g.validMoves();
  const maximizing = mover === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const c of moves) {
    g.drop(c);
    const v = search(g, depth - 1, alpha, beta, me);
    g.undo();
    if (maximizing) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

/** The computer's column for the player to move. */
export function bestMove(game: FourRow, level: Level, rng: Rng = createRng(game.moves.join(''))): number {
  const g = game.clone();
  const me = g.turn;
  const moves = g.validMoves();
  if (moves.length === 0) return -1;
  // Easy: one move in three is random (but it still takes an immediate win).
  if (level === 'easy' && rng() < 0.33) {
    for (const c of moves) {
      g.drop(c);
      const won = g.winner === me;
      g.undo();
      if (won) return c;
    }
    return moves[Math.floor(rng() * moves.length)]!;
  }
  let best = moves[0]!;
  let bestScore = -Infinity;
  for (const c of moves) {
    g.drop(c);
    const v = search(g, DEPTH[level] - 1, bestScore, Infinity, me);
    g.undo();
    if (v > bestScore) {
      bestScore = v;
      best = c;
    }
  }
  return best;
}
