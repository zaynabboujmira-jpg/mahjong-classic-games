import { createRng, type Rng } from '../core/rng';
import { BISHOP, Chess, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE, colorOf, typeOf, type Move } from './chess';

/*
 * The computer player: negamax with alpha-beta pruning, quiescence search on
 * captures, MVV-LVA move ordering and iterative deepening under a time
 * budget. Evaluation is material plus piece-square tables.
 *
 *   Beginner  – one move deep, noisy, and sometimes just plays any move.
 *   Club      – up to 3 moves deep (≈0.4 s).
 *   Tactician – up to 6 moves deep (≈1.2 s), with quiescence.
 */
export type ChessLevel = 'beginner' | 'club' | 'tactician';
export const CHESS_LEVELS: readonly ChessLevel[] = ['beginner', 'club', 'tactician'];
const SETTINGS: Record<ChessLevel, { depth: number; ms: number; noise: number; randomMove: number }> = {
  beginner: { depth: 1, ms: 200, noise: 120, randomMove: 0.25 },
  club: { depth: 3, ms: 450, noise: 15, randomMove: 0 },
  tactician: { depth: 6, ms: 1200, noise: 0, randomMove: 0 },
};

export const VALUE = [0, 100, 320, 330, 500, 900, 0];
const MATE = 100_000;

// Piece-square tables from White's side, rank 8 first (as on a printed board).
const PST: Record<number, number[]> = {
  [PAWN]: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5,
    10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [KNIGHT]: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10,
    15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  [BISHOP]: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10,
    10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  [ROOK]: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
    0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
  ],
  [QUEEN]: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0,
    5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  [KING]: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40,
    -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
};
const KING_END = [
  -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50,
];

/** Index into a rank-8-first table for a piece of `color` on square `s` (a1 = 0). */
const pstIndex = (s: number, color: number) => (color === WHITE ? (7 - (s >> 3)) * 8 + (s & 7) : (s >> 3) * 8 + (s & 7));

/** Static evaluation in centipawns from the side to move's point of view. */
export function evaluate(g: Chess): number {
  let score = 0;
  let heavy = 0;
  for (let s = 0; s < 64; s++) {
    const p = g.board[s]!;
    const t = typeOf(p);
    if (t && t !== PAWN && t !== KING) heavy += VALUE[t]!;
  }
  const endgame = heavy <= 1300;
  for (let s = 0; s < 64; s++) {
    const p = g.board[s]!;
    if (!p) continue;
    const t = typeOf(p);
    const c = colorOf(p);
    const table = t === KING && endgame ? KING_END : PST[t]!;
    const v = VALUE[t]! + table[pstIndex(s, c)]!;
    score += c === WHITE ? v : -v;
  }
  return g.turn === WHITE ? score : -score;
}

const orderScore = (m: Move) => (m.captured ? 10 * VALUE[typeOf(m.captured)]! - VALUE[typeOf(m.piece)]! + 10_000 : 0) + (m.promo ? 8000 + VALUE[m.promo]! : 0);

class Search {
  nodes = 0;
  stopped = false;
  private deadline: number;
  constructor(
    private g: Chess,
    ms: number,
  ) {
    this.deadline = Date.now() + ms;
  }

  private timeUp() {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) this.stopped = true;
    return this.stopped;
  }

  quiesce(alpha: number, beta: number, depth = 0): number {
    if (this.timeUp()) return 0;
    const stand = evaluate(this.g);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (depth > 6) return alpha;
    const moves = this.g.moves(-1, true).sort((a, b) => orderScore(b) - orderScore(a));
    for (const m of moves) {
      this.g.makeMove(m);
      const v = -this.quiesce(-beta, -alpha, depth + 1);
      this.g.unmakeMove();
      if (this.stopped) return 0;
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  negamax(depth: number, alpha: number, beta: number, ply: number, quiet: boolean): number {
    if (this.timeUp()) return 0;
    const moves = this.g.moves();
    if (!moves.length) return this.g.inCheck() ? -MATE + ply : 0;
    if (this.g.half >= 100) return 0;
    if (depth <= 0) return quiet ? this.quiesce(alpha, beta) : evaluate(this.g);
    moves.sort((a, b) => orderScore(b) - orderScore(a));
    let best = -Infinity;
    for (const m of moves) {
      this.g.makeMove(m);
      // Look one move further when the reply is a check.
      const ext = this.g.inCheck() && ply < 6 ? 1 : 0;
      const v = -this.negamax(depth - 1 + ext, -beta, -alpha, ply + 1, quiet);
      this.g.unmakeMove();
      if (this.stopped) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  /** Scores every root move at a depth, best first. */
  root(moves: Move[], depth: number, quiet: boolean, exact: boolean): { move: Move; score: number }[] | null {
    const out: { move: Move; score: number }[] = [];
    let alpha = -Infinity;
    for (const m of moves) {
      this.g.makeMove(m);
      // Exact scores for every move when a weaker level needs to rank them; otherwise only the best matters.
      const v = -this.negamax(depth - 1, -Infinity, exact ? Infinity : -alpha, 1, quiet);
      this.g.unmakeMove();
      if (this.stopped) return null;
      out.push({ move: m, score: v });
      if (v > alpha) alpha = v;
    }
    return out.sort((a, b) => b.score - a.score);
  }
}

/** Chooses the computer's move for the side to move. */
export function chooseMove(game: Chess, level: ChessLevel, rng: Rng = createRng(game.fen())): Move | null {
  const g = new Chess(game.fen());
  const moves = g.moves();
  if (!moves.length) return null;
  const set = SETTINGS[level];
  if (set.randomMove && rng() < set.randomMove) {
    return moves[Math.floor(rng() * moves.length)]!;
  }
  const search = new Search(g, set.ms);
  let ranked: { move: Move; score: number }[] = moves.map((move) => ({ move, score: 0 })).sort((a, b) => orderScore(b.move) - orderScore(a.move));
  for (let depth = 1; depth <= set.depth; depth++) {
    const r = search.root(
      ranked.map((x) => x.move),
      depth,
      level !== 'beginner',
      set.noise > 0,
    );
    if (!r) break;
    ranked = r;
    if (ranked[0]!.score > MATE - 100) break;
  }
  if (!set.noise) return ranked[0]!.move;
  // Weaker levels pick among moves close to the best, with some noise.
  const noisy = ranked.map((x) => ({ move: x.move, score: x.score + (rng() - 0.5) * 2 * set.noise }));
  noisy.sort((a, b) => b.score - a.score);
  return noisy[0]!.move;
}

