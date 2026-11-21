import { hashSeed } from '../core/rng';

/*
 * Infinite Minesweeper: an endless field. Whether a cell holds a mine comes
 * from a hash of the seed and its coordinates, so the board needs no storage,
 * is the same every time for a seed, and extends in every direction. The 5×5
 * square around the start is always clear, so the first click opens an area.
 *
 * Score: the number of safe cells revealed. Classic mode ends at the first
 * mine; Relaxed mode gives three lives, and a mine hit is marked and play goes on.
 * A flood of empty cells is capped per click (zero regions are finite in
 * practice at these densities, but the cap keeps every click instant).
 */
export const INF_LEVELS = ['easy', 'normal', 'hard'] as const;
export type InfLevel = (typeof INF_LEVELS)[number];
export const DENSITY: Record<InfLevel, number> = { easy: 0.12, normal: 0.17, hard: 0.22 };
export type InfMode = 'classic' | 'relaxed';
export const LIVES: Record<InfMode, number> = { classic: 1, relaxed: 3 };
const FLOOD_CAP = 4000;

export const key = (x: number, y: number) => `${x},${y}`;
export const parse = (k: string): [number, number] => {
  const i = k.indexOf(',');
  return [Number(k.slice(0, i)), Number(k.slice(i + 1))];
};

export interface InfState {
  seed: string;
  level: InfLevel;
  mode: InfMode;
  revealed: string[];
  flags: string[];
  /** Mines that were hit (Relaxed mode), shown as exploded. */
  hits: string[];
  lives: number;
  over: boolean;
  /** Camera centre, in cells. */
  cx: number;
  cy: number;
}

export class InfiniteMines {
  readonly seedHash: number;
  readonly threshold: number;
  revealed: Set<string>;
  flags: Set<string>;
  hits: Set<string>;
  lives: number;
  over: boolean;
  private numberCache = new Map<string, number>();

  constructor(
    readonly seed: string,
    readonly level: InfLevel,
    readonly mode: InfMode,
    saved?: InfState,
  ) {
    this.seedHash = hashSeed(`infmines:${seed}`);
    this.threshold = Math.floor(DENSITY[level] * 0x100000000);
    this.revealed = new Set(saved?.revealed ?? []);
    this.flags = new Set(saved?.flags ?? []);
    this.hits = new Set(saved?.hits ?? []);
    this.lives = saved?.lives ?? LIVES[mode];
    this.over = saved?.over ?? false;
  }

  /** Is there a mine at (x, y)? Pure: a hash of the seed and the coordinates. */
  isMine(x: number, y: number): boolean {
    if (Math.abs(x) <= 2 && Math.abs(y) <= 2) return false;
    let h = this.seedHash ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0 < this.threshold;
  }

  /** Mines among the eight neighbours. */
  count(x: number, y: number): number {
    const k = key(x, y);
    const cached = this.numberCache.get(k);
    if (cached !== undefined) return cached;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && this.isMine(x + dx, y + dy)) n++;
    if (this.numberCache.size > 50_000) this.numberCache.clear();
    this.numberCache.set(k, n);
    return n;
  }

  get score() {
    return this.revealed.size;
  }

  /** Opens a cell. Returns 'mine' on a hit, otherwise how many cells opened. */
  reveal(x: number, y: number): number | 'mine' {
    const k = key(x, y);
    if (this.over || this.flags.has(k) || this.revealed.has(k) || this.hits.has(k)) return 0;
    if (this.isMine(x, y)) {
      this.hits.add(k);
      this.lives--;
      if (this.lives <= 0) this.over = true;
      return 'mine';
    }
    let opened = 0;
    const stack: [number, number][] = [[x, y]];
    while (stack.length && opened < FLOOD_CAP) {
      const [cx, cy] = stack.pop()!;
      const ck = key(cx, cy);
      if (this.revealed.has(ck) || this.flags.has(ck) || this.isMine(cx, cy)) continue;
      this.revealed.add(ck);
      opened++;
      if (this.count(cx, cy) === 0)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if (dx || dy) if (!this.revealed.has(key(cx + dx, cy + dy))) stack.push([cx + dx, cy + dy]);
    }
    return opened;
  }

  toggleFlag(x: number, y: number): boolean {
    const k = key(x, y);
    if (this.over || this.revealed.has(k) || this.hits.has(k)) return false;
    if (this.flags.has(k)) this.flags.delete(k);
    else this.flags.add(k);
    return true;
  }

  /** On a revealed number with that many flags (or hits) around it, opens the other neighbours. */
  chord(x: number, y: number): number | 'mine' {
    if (this.over || !this.revealed.has(key(x, y))) return 0;
    const n = this.count(x, y);
    let marked = 0;
    const closed: [number, number][] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const k = key(x + dx, y + dy);
        if (this.flags.has(k) || this.hits.has(k)) marked++;
        else if (!this.revealed.has(k)) closed.push([x + dx, y + dy]);
      }
    if (!n || marked !== n || !closed.length) return 0;
    let opened = 0;
    for (const [cx, cy] of closed) {
      const r = this.reveal(cx, cy);
      if (r === 'mine') return 'mine';
      opened += r;
    }
    return opened;
  }

  serialize(cx: number, cy: number): InfState {
    return { seed: this.seed, level: this.level, mode: this.mode, revealed: [...this.revealed], flags: [...this.flags], hits: [...this.hits], lives: this.lives, over: this.over, cx, cy };
  }
}
