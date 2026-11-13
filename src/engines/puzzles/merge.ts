import { createRng, type Rng } from '../core/rng';

/*
 * Number Merge: slide every tile in one direction; two equal tiles that meet
 * merge into their sum (once per move). After each move that changes the
 * board a new 2 (90%) or 4 (10%) appears in a random empty cell. Reaching the
 * target tile wins; play may continue. The game ends when no move is left.
 *
 * Tiles carry ids so the UI can animate each one from its old cell to the
 * new one; merged tiles keep the id of one parent and list both.
 */
export type Dir = 'up' | 'down' | 'left' | 'right';
export const SIZES = [3, 4, 5] as const;
export type MergeSize = (typeof SIZES)[number];
/** The winning tile for each board size (a 3×3 board cannot reasonably reach 2048). */
export const TARGET: Record<MergeSize, number> = { 3: 256, 4: 2048, 5: 4096 };

export interface Tile {
  id: number;
  value: number;
  r: number;
  c: number;
  /** Set on the move it appeared. */
  isNew?: boolean;
  /** Set on the move it was formed by a merge. */
  merged?: boolean;
}

interface Snapshot {
  tiles: Tile[];
  score: number;
  won: boolean;
  rngState: number;
}

export interface MoveResult {
  moved: boolean;
  gained: number;
  merges: number;
  /** Tiles that slid into another and disappeared, with the cell they moved to (for the slide animation). */
  gone: Tile[];
}

export class MergeGame {
  readonly size: MergeSize;
  tiles: Tile[] = [];
  score = 0;
  won = false;
  moves = 0;
  private nextId = 1;
  private rng: Rng;
  private rngCalls = 0;
  private seed: string;
  private history: Snapshot | null = null;

  constructor(size: MergeSize = 4, seed = 'merge') {
    this.size = size;
    this.seed = seed;
    this.rng = createRng(`merge:${seed}`);
    this.spawn();
    this.spawn();
  }

  get target() {
    return TARGET[this.size];
  }
  get best() {
    return this.tiles.reduce((m, t) => Math.max(m, t.value), 0);
  }
  get canUndo() {
    return this.history !== null;
  }

  /** Board as rows of values (0 = empty). */
  grid(): number[][] {
    const g = Array.from({ length: this.size }, () => Array<number>(this.size).fill(0));
    for (const t of this.tiles) g[t.r]![t.c] = t.value;
    return g;
  }

  /** For tests: replace the board. */
  load(values: number[][]) {
    this.tiles = [];
    values.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v) this.tiles.push({ id: this.nextId++, value: v, r, c });
      }),
    );
    this.history = null;
  }

  private random() {
    this.rngCalls++;
    return this.rng();
  }

  private spawn() {
    const empty: [number, number][] = [];
    const g = this.grid();
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) if (!g[r]![c]) empty.push([r, c]);
    if (!empty.length) return;
    const [r, c] = empty[Math.floor(this.random() * empty.length)]!;
    this.tiles.push({ id: this.nextId++, value: this.random() < 0.9 ? 2 : 4, r, c, isNew: true });
  }

  private snapshot(): Snapshot {
    return { tiles: this.tiles.map((t) => ({ ...t })), score: this.score, won: this.won, rngState: this.rngCalls };
  }

  /** Slides all tiles; returns what happened. A move that changes nothing does not count. */
  move(dir: Dir): MoveResult {
    const before = this.snapshot();
    const n = this.size;
    const at = new Map<string, Tile>();
    for (const t of this.tiles) {
      delete t.isNew;
      delete t.merged;
      at.set(`${t.r},${t.c}`, t);
    }
    // Lines are read from the side the tiles move towards.
    const lines: [number, number][][] = [];
    for (let i = 0; i < n; i++) {
      const line: [number, number][] = [];
      for (let j = 0; j < n; j++) {
        const k = dir === 'left' || dir === 'up' ? j : n - 1 - j;
        line.push(dir === 'left' || dir === 'right' ? [i, k] : [k, i]);
      }
      lines.push(line);
    }
    let moved = false;
    let gained = 0;
    let merges = 0;
    const gone: Tile[] = [];
    const kept: Tile[] = [];
    for (const line of lines) {
      const row = line.map(([r, c]) => at.get(`${r},${c}`)).filter((t): t is Tile => !!t);
      let slot = 0;
      for (let i = 0; i < row.length; i++) {
        const t = row[i]!;
        const next = row[i + 1];
        const [r, c] = line[slot]!;
        if (next && next.value === t.value) {
          // Merge: t stays (doubled), next slides into it and disappears.
          t.value *= 2;
          t.merged = true;
          gained += t.value;
          merges++;
          next.r = r;
          next.c = c;
          gone.push(next);
          i++;
        }
        if (t.r !== r || t.c !== c) moved = true;
        if (t.merged) moved = true;
        t.r = r;
        t.c = c;
        kept.push(t);
        slot++;
      }
    }
    if (!moved) {
      this.tiles = before.tiles;
      return { moved: false, gained: 0, merges: 0, gone: [] };
    }
    this.tiles = kept;
    this.score += gained;
    this.moves++;
    if (this.best >= this.target) this.won = true;
    this.spawn();
    this.history = before;
    return { moved, gained, merges, gone };
  }

  /** Takes back the last move (one step). */
  undo(): boolean {
    const h = this.history;
    if (!h) return false;
    this.tiles = h.tiles.map((t) => ({ ...t }));
    this.score = h.score;
    this.won = h.won;
    this.moves = Math.max(0, this.moves - 1);
    // Rewind the random stream so the same move gives the same new tile.
    this.rng = createRng(`merge:${this.seed}`);
    this.rngCalls = 0;
    while (this.rngCalls < h.rngState) this.random();
    this.history = null;
    return true;
  }

  /** True when a move is still possible. */
  canMove(): boolean {
    const g = this.grid();
    const n = this.size;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const v = g[r]![c]!;
        if (!v) return true;
        if (c + 1 < n && g[r]![c + 1] === v) return true;
        if (r + 1 < n && g[r + 1]![c] === v) return true;
      }
    return false;
  }

  get over() {
    return !this.canMove();
  }
}
