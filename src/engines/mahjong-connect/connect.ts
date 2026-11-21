import { createRng, shuffleInPlace, type Rng } from '../core/rng';
import { faceById, standardPairs } from '../mahjong/tiles';

/*
 * Mahjong Connect (tile-link): a grid of Mahjong tiles with an empty border.
 * Two matching tiles can be removed when a line of at most three straight
 * segments (two bends) joins them through empty cells; the line may run
 * through the empty border around the grid. Clear every tile to win.
 *
 * Deals are random but always start with a move. When no move is left, the
 * remaining tiles are reshuffled for free on the cells they occupy (again
 * with at least one move), so a game can always be finished. Players also
 * get three shuffles of their own to use when they like.
 */
export const CONNECT_LEVELS = ['easy', 'medium', 'hard'] as const;
export type ConnectLevel = (typeof CONNECT_LEVELS)[number];
export const SIZES: Record<ConnectLevel, { cols: number; rows: number }> = {
  easy: { cols: 8, rows: 6 },
  medium: { cols: 12, rows: 8 },
  hard: { cols: 16, rows: 9 },
};
export const FREE_SHUFFLES = 3;

const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

export interface ConnectState {
  level: ConnectLevel;
  seed: string;
  cols: number;
  rows: number;
  /** Face id per cell of the (cols + 2) × (rows + 2) grid, border included; null when empty. */
  tiles: (string | null)[];
  history: { a: number; b: number; face: string; faceB: string }[];
  shuffles: number;
  deal: number;
}

const matchKey = (id: string) => faceById(id).matchKey;

/**
 * The bends of the shortest-turning line from a to b (a, corners..., b), with at
 * most two turns through empty cells, or null. `empty(i)` says whether a cell can be crossed.
 */
export function findPath(W: number, H: number, a: number, b: number, empty: (i: number) => boolean): number[] | null {
  if (a === b) return null;
  const N = W * H;
  // best[cell * 4 + dir] = fewest turns to arrive at cell moving in dir.
  const best = new Int8Array(N * 4).fill(9);
  const prev = new Int32Array(N * 4).fill(-1);
  let frontier: number[] = [];
  for (let d = 0; d < 4; d++) frontier.push(a * 4 + d);
  for (const s of frontier) best[s] = 0;
  let found = -1;
  for (let turns = 0; turns <= 2 && found < 0; turns++) {
    const next: number[] = [];
    // Extend each state straight ahead as far as possible at this turn count.
    for (const s of frontier) {
      const d = s & 3;
      let cell = s >> 2;
      let from = s;
      for (;;) {
        const r = Math.floor(cell / W) + DR[d]!;
        const c = (cell % W) + DC[d]!;
        if (r < 0 || r >= H || c < 0 || c >= W) break;
        const n = r * W + c;
        if (n === b) {
          found = from;
          prev[n * 4 + d] = from;
          break;
        }
        if (!empty(n)) break;
        const st = n * 4 + d;
        if (best[st]! <= turns) break;
        best[st] = turns;
        prev[st] = from;
        from = st;
        cell = n;
        // Turning here costs one more bend.
        for (const nd of [(d + 1) & 3, (d + 3) & 3]) {
          const t = n * 4 + nd;
          if (best[t]! > turns + 1) {
            best[t] = turns + 1;
            prev[t] = st;
            next.push(t);
          }
        }
      }
      if (found >= 0) break;
    }
    frontier = next;
  }
  if (found < 0) return null;
  // Walk back through the states to the start, then keep only the corners.
  const chain: number[] = [];
  for (let st = found; st >= 0; st = prev[st]!) chain.push(st >> 2);
  const cells = [...chain.reverse(), b].filter((c, i, arr) => i === 0 || c !== arr[i - 1]);
  const out = [cells[0]!];
  for (let i = 1; i < cells.length - 1; i++) {
    const p0 = cells[i - 1]!;
    const p1 = cells[i]!;
    const p2 = cells[i + 1]!;
    if (p1 - p0 !== p2 - p1) out.push(p1);
  }
  out.push(b);
  return out;
}

/** Shuffles the faces among `cells` until at least one pair can be removed. */
function dealWithMove(game: ConnectGame, cells: number[], faces: string[], rng: Rng) {
  for (let attempt = 0; attempt < 200; attempt++) {
    shuffleInPlace(faces, rng);
    cells.forEach((c, k) => (game.s.tiles[c] = faces[k]!));
    if (game.hint()) return;
  }
}

export class ConnectGame {
  s: ConnectState;

  constructor(level: ConnectLevel | ConnectState, seed = 'connect') {
    if (typeof level !== 'string') {
      this.s = level;
      return;
    }
    const { cols, rows } = SIZES[level];
    this.s = { level, seed, cols, rows, tiles: [], history: [], shuffles: FREE_SHUFFLES, deal: 0 };
    const rng = createRng(`connect:${level}:${seed}`);
    const W = cols + 2;
    this.s.tiles = new Array<string | null>(W * (rows + 2)).fill(null);
    const inner: number[] = [];
    for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) inner.push(r * W + c);
    const faces = shuffleInPlace(standardPairs(), rng)
      .slice(0, (cols * rows) / 2)
      .flatMap(([a, b]) => [a.id, b.id]);
    dealWithMove(this, inner, faces, rng);
  }

  get W() {
    return this.s.cols + 2;
  }
  get H() {
    return this.s.rows + 2;
  }
  get left() {
    return this.s.tiles.filter(Boolean).length;
  }
  get isWon() {
    return this.left === 0;
  }

  /** The line joining two matching tiles, or null when they cannot be removed together. */
  pathBetween(a: number, b: number): number[] | null {
    const t = this.s.tiles;
    const fa = t[a];
    const fb = t[b];
    if (!fa || !fb || a === b || matchKey(fa) !== matchKey(fb)) return null;
    return findPath(this.W, this.H, a, b, (i) => t[i] === null);
  }

  remove(a: number, b: number): number[] | null {
    const path = this.pathBetween(a, b);
    if (!path) return null;
    const t = this.s.tiles;
    this.s.history.push({ a, b, face: t[a]!, faceB: t[b]! });
    t[a] = null;
    t[b] = null;
    return path;
  }

  undo(): boolean {
    const h = this.s.history.pop();
    if (!h) return false;
    this.s.tiles[h.a] = h.face;
    this.s.tiles[h.b] = h.faceB;
    return true;
  }

  /** A removable pair and its line, or null when the board is stuck. */
  hint(): { a: number; b: number; path: number[] } | null {
    const t = this.s.tiles;
    const byKey = new Map<string, number[]>();
    t.forEach((f, i) => {
      if (!f) return;
      const k = matchKey(f);
      byKey.set(k, [...(byKey.get(k) ?? []), i]);
    });
    for (const cells of byKey.values())
      for (let x = 0; x < cells.length; x++)
        for (let y = x + 1; y < cells.length; y++) {
          const path = this.pathBetween(cells[x]!, cells[y]!);
          if (path) return { a: cells[x]!, b: cells[y]!, path };
        }
    return null;
  }

  /**
   * Rearranges the remaining tiles on the cells they occupy, with at least one
   * move. Costs one shuffle unless `free` (used automatically when no move is left).
   */
  shuffle(free = false): boolean {
    const t = this.s.tiles;
    const cells = t.flatMap((f, i) => (f ? [i] : []));
    if (!cells.length || (!free && this.s.shuffles <= 0)) return false;
    this.s.deal++;
    dealWithMove(this, cells, cells.map((i) => t[i]!), createRng(`connect:shuffle:${this.s.seed}:${this.s.deal}`));
    // Undo cannot reach back past a shuffle.
    this.s.history = [];
    if (!free) this.s.shuffles--;
    return true;
  }
}
