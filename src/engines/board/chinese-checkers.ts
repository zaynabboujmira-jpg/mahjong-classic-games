import { createRng, type Rng } from '../core/rng';

/*
 * Chinese Checkers on the six-pointed star (121 holes): a hexagon of 61 holes
 * plus six triangular points of 10. Each player starts with 10 marbles in one
 * point and races them into the opposite point.
 *
 * A move is either one step to an adjacent empty hole, or a chain of hops:
 * jump over one adjacent marble (any colour) into the empty hole directly
 * beyond, and keep hopping as long as you like. Steps and hops cannot be
 * mixed. A marble may pass through any point but may only end its move in
 * the open middle, its own starting point or its target point.
 *
 * A player wins when all ten of their marbles are in the target point, or
 * when the target point is full and holds at least one of their marbles (so
 * an opponent who never leaves cannot block a win).
 *
 * Holes use cube coordinates (x + y + z = 0). The star is every hole where
 * max(x, y, z) <= 4 or min(x, y, z) >= -4. The six points are named by the
 * coordinate that runs past 4: "z+" is drawn at the bottom of the screen.
 */
export const POINTS = ['z+', 'x-', 'y+', 'z-', 'x+', 'y-'] as const;
export type Point = (typeof POINTS)[number];
export const OPPOSITE: Record<Point, Point> = { 'z+': 'z-', 'z-': 'z+', 'x+': 'x-', 'x-': 'x+', 'y+': 'y-', 'y-': 'y+' };

export interface Hole {
  x: number;
  y: number;
  z: number;
  point: Point | null;
}

export const HOLES: readonly Hole[] = (() => {
  const out: Hole[] = [];
  for (let z = -8; z <= 8; z++)
    for (let x = -8; x <= 8; x++) {
      const y = -x - z;
      if (y < -8 || y > 8) continue;
      if (!(Math.max(x, y, z) <= 4 || Math.min(x, y, z) >= -4)) continue;
      const point: Point | null = x > 4 ? 'x+' : x < -4 ? 'x-' : y > 4 ? 'y+' : y < -4 ? 'y-' : z > 4 ? 'z+' : z < -4 ? 'z-' : null;
      out.push({ x, y, z, point });
    }
  return out;
})();

const INDEX = new Map(HOLES.map((h, i) => [`${h.x},${h.y},${h.z}`, i]));
const at = (x: number, y: number, z: number) => INDEX.get(`${x},${y},${z}`) ?? -1;
const DIRS = [
  [1, -1, 0],
  [1, 0, -1],
  [0, 1, -1],
  [-1, 1, 0],
  [-1, 0, 1],
  [0, -1, 1],
] as const;
/** NEIGHBOURS[i][d]: the hole next to i in direction d, or -1. */
export const NEIGHBOURS: readonly (readonly number[])[] = HOLES.map((h) => DIRS.map(([dx, dy, dz]) => at(h.x + dx, h.y + dy, h.z + dz)));
export const POINT_HOLES: Record<Point, number[]> = Object.fromEntries(POINTS.map((p) => [p, HOLES.flatMap((h, i) => (h.point === p ? [i] : []))])) as Record<Point, number[]>;
/** The far tip of each point (the hole 8 away from the centre). */
const TIP: Record<Point, number> = Object.fromEntries(POINTS.map((p) => [p, POINT_HOLES[p].find((i) => Math.max(...['x', 'y', 'z'].map((k) => Math.abs(HOLES[i]![k as 'x'])) ) === 8)!])) as Record<Point, number>;

export const distance = (a: number, b: number) => {
  const p = HOLES[a]!;
  const q = HOLES[b]!;
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z));
};

/** Starting points for each table size, in turn order (clockwise from you at the bottom). */
export const SETUPS: Record<number, Point[]> = {
  2: ['z+', 'z-'],
  3: ['z+', 'y+', 'x+'],
  4: ['z+', 'x-', 'z-', 'x+'],
  6: ['z+', 'x-', 'y+', 'z-', 'x+', 'y-'],
};

export interface Move {
  from: number;
  to: number;
  /** Holes visited, from start to end (two entries for a step). */
  path: number[];
}

export interface CCState {
  /** Owner of each hole: a player index, or -1 for empty. */
  board: number[];
  starts: Point[];
  turn: number;
  winner: number;
  moves: number;
  history: { move: Move; player: number }[];
}

export class ChineseCheckers {
  s: CCState;

  constructor(players: number | CCState = 2) {
    if (typeof players !== 'number') {
      this.s = players;
      return;
    }
    const starts = SETUPS[players];
    if (!starts) throw new Error(`Unsupported player count ${players}`);
    const board = HOLES.map(() => -1);
    starts.forEach((p, k) => POINT_HOLES[p].forEach((i) => (board[i] = k)));
    this.s = { board, starts: starts.slice(), turn: 0, winner: -1, moves: 0, history: [] };
  }

  get players() {
    return this.s.starts.length;
  }
  target = (player: number) => OPPOSITE[this.s.starts[player]!];
  marbles = (player: number) => this.s.board.flatMap((o, i) => (o === player ? [i] : []));

  /** May `player` end a move on hole i? (Open middle, own start or own target only.) */
  canRest(player: number, i: number) {
    const p = HOLES[i]!.point;
    return p === null || p === this.s.starts[player] || p === this.target(player);
  }

  /** Every legal move for the marble on `from`. */
  movesFrom(from: number, board = this.s.board): Move[] {
    const player = board[from]!;
    const out: Move[] = [];
    for (const n of NEIGHBOURS[from]!) if (n >= 0 && board[n] === -1 && this.canRest(player, n)) out.push({ from, to: n, path: [from, n] });
    // Hop chains: breadth-first, shortest path to each landing hole.
    const prev = new Map<number, number>([[from, -1]]);
    const queue = [from];
    while (queue.length) {
      const c = queue.shift()!;
      for (let d = 0; d < 6; d++) {
        const over = NEIGHBOURS[c]![d]!;
        if (over < 0 || board[over] === -1 || over === from) continue;
        const land = NEIGHBOURS[over]![d]!;
        if (land < 0 || (board[land] !== -1 && land !== from) || prev.has(land)) continue;
        prev.set(land, c);
        queue.push(land);
      }
    }
    for (const [to] of prev) {
      if (to === from || !this.canRest(player, to)) continue;
      const path = [to];
      for (let c = prev.get(to)!; c !== -1; c = prev.get(c)!) path.unshift(c);
      out.push({ from, to, path });
    }
    return out;
  }

  legalMoves(player = this.s.turn): Move[] {
    if (this.s.winner >= 0) return [];
    return this.marbles(player).flatMap((i) => this.movesFrom(i));
  }

  hasWon(player: number, board = this.s.board) {
    const target = POINT_HOLES[this.target(player)];
    if (target.every((i) => board[i] === player)) return true;
    return target.every((i) => board[i] !== -1) && target.some((i) => board[i] === player);
  }

  play(move: Move): boolean {
    const s = this.s;
    const player = s.turn;
    if (s.winner >= 0 || s.board[move.from] !== player) return false;
    const legal = this.movesFrom(move.from).find((m) => m.to === move.to);
    if (!legal) return false;
    s.board[move.from] = -1;
    s.board[move.to] = player;
    s.history.push({ move: legal, player });
    s.moves++;
    if (this.hasWon(player)) s.winner = player;
    else this.nextTurn();
    return true;
  }

  private nextTurn() {
    const s = this.s;
    for (let k = 1; k <= this.players; k++) {
      const p = (s.turn + 1) % this.players;
      s.turn = p;
      if (this.legalMoves(p).length) return;
    }
  }

  /** Takes back the last move. */
  undo(): boolean {
    const last = this.s.history.pop();
    if (!last) return false;
    this.s.board[last.move.to] = -1;
    this.s.board[last.move.from] = last.player;
    this.s.turn = last.player;
    this.s.winner = -1;
    this.s.moves--;
    return true;
  }

  /** Total distance of a player's marbles from their target tip (0 is impossible; a full target scores 20). */
  progress(player: number, board = this.s.board) {
    const tip = TIP[this.target(player)];
    let sum = 0;
    for (let i = 0; i < board.length; i++) if (board[i] === player) sum += distance(i, tip);
    return sum;
  }
}

export type CCLevel = 'easy' | 'medium' | 'hard';

/**
 * Computer move. All levels rank moves by how much closer they bring the
 * marble to the far tip of the target, with a bonus for moving stragglers.
 * Easy adds noise; Hard also looks at the best reply of the next player in a
 * two-player game and avoids leaving marbles stranded at home.
 */
export function chooseMove(g: ChineseCheckers, level: CCLevel = 'medium', rng: Rng = createRng(g.s.moves + 1)): Move | null {
  const player = g.s.turn;
  const moves = g.legalMoves(player);
  if (!moves.length) return null;
  const tip = TIP[g.target(player)];
  const targetSet = new Set(POINT_HOLES[g.target(player)]);
  const mine = g.marbles(player);
  const worst = Math.max(...mine.map((i) => distance(i, tip)));
  const board = g.s.board;
  let best: Move = moves[0]!;
  let bestScore = -Infinity;
  for (const m of moves) {
    const before = distance(m.from, tip);
    const after = distance(m.to, tip);
    let score = before - after;
    // Moving the last marbles home matters; leaving the target is almost never right.
    if (before >= worst - 1) score += 0.6;
    if (targetSet.has(m.from) && !targetSet.has(m.to)) score -= 4;
    if (!targetSet.has(m.from) && targetSet.has(m.to)) score += 0.5;
    // Inside the target, fill the deepest holes first.
    if (targetSet.has(m.to) && targetSet.has(m.from)) score += before > after ? 0.3 : -2;
    if (level === 'hard') {
      if (before >= worst - 2) score += 0.4;
      if (g.players === 2) {
        board[m.from] = -1;
        board[m.to] = player;
        const opp = 1 - player;
        const oppTip = TIP[g.target(opp)];
        let reply = 0;
        for (const i of g.marbles(opp)) for (const r of g.movesFrom(i)) reply = Math.max(reply, distance(r.from, oppTip) - distance(r.to, oppTip));
        board[m.to] = -1;
        board[m.from] = player;
        score -= reply * 0.35;
      }
    }
    if (level === 'easy') score += rng() * 2.5;
    else score += rng() * 0.05;
    if (score > bestScore) (bestScore = score), (best = m);
  }
  return best;
}
