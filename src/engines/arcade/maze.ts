import { createRng, type Rng } from '../core/rng';
import { type ArcadeEngine, type Input } from './input';

/*
 * Maze Chomper: an original maze and characters. You are the Chomper; four
 * Wisps hunt you with different strategies: Dash chases you directly, Scout
 * aims ahead of you, Twist flanks using Dash's position, and Drift wanders.
 * Power orbs turn the Wisps pale so you can catch them.
 *
 * Legend: # wall, . pellet, o power orb, - pen gate, G pen, P start, space empty.
 * The middle row is open at both ends: a tunnel that wraps around.
 */
export const MAZE = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.###.#.###.####',
  '####.#.......#.####',
  '####.#.##-##.#.####',
  '.....#.#GGG#.#.....',
  '####.#.#####.#.####',
  '####.#.......#.####',
  '####.#.#####.#.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....P.....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
];
export const COLS = MAZE[0]!.length;
export const ROWS = MAZE.length;
export const TILE = 16;

type Dir = { x: number; y: number };
const DIRS: Dir[] = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
];
const NONE: Dir = { x: 0, y: 0 };
const same = (a: Dir, b: Dir) => a.x === b.x && a.y === b.y;
const opposite = (a: Dir, b: Dir) => a.x === -b.x && a.y === -b.y && (a.x !== 0 || a.y !== 0);

const START = (() => {
  for (let y = 0; y < ROWS; y++) {
    const x = MAZE[y]!.indexOf('P');
    if (x >= 0) return { x, y };
  }
  throw new Error('Maze has no start');
})();
const GATE = { x: MAZE[8]!.indexOf('-'), y: 8 };
const PEN = { x: GATE.x, y: GATE.y + 1 };
const OUTSIDE = { x: GATE.x, y: GATE.y - 1 };
const GEM_SPOT = { x: GATE.x, y: 11 };
const CORNERS = [
  { x: COLS - 2, y: -2 },
  { x: 1, y: -2 },
  { x: COLS - 1, y: ROWS + 1 },
  { x: 0, y: ROWS + 1 },
];

export const cellAt = (x: number, y: number) => {
  if (y < 0 || y >= ROWS) return '#';
  const row = MAZE[y]!;
  return row[((x % COLS) + COLS) % COLS]!;
};
const isWall = (x: number, y: number, gateOpen: boolean) => {
  const c = cellAt(x, y);
  return c === '#' || (c === '-' && !gateOpen) || (c === 'G' && !gateOpen);
};

interface Mover {
  /** Tile the mover is at (or leaving). */
  tx: number;
  ty: number;
  /** Progress 0..1 towards the next tile in `dir`. */
  t: number;
  dir: Dir;
}
const posX = (m: Mover) => m.tx + m.dir.x * m.t;
const posY = (m: Mover) => m.ty + m.dir.y * m.t;

export type WispName = 'Dash' | 'Scout' | 'Twist' | 'Drift';
export interface Wisp extends Mover {
  name: WispName;
  state: 'pen' | 'leaving' | 'active' | 'eaten';
  /** Seconds until it leaves the pen. */
  wait: number;
}

export class MazeGame implements ArcadeEngine {
  readonly pellets: Set<number>;
  readonly power: Set<number>;
  player: Mover;
  wanted: Dir = { x: -1, y: 0 };
  wisps: Wisp[] = [];
  score = 0;
  lives = 3;
  level = 1;
  over = false;
  /** Seconds of frightened mode left. */
  frightened = 0;
  /** Wisps caught during this frightened spell (doubles the points). */
  private combo = 0;
  /** Pause after dying or clearing a level. */
  pause = 1.2;
  private modeTime = 0;
  gem: { x: number; y: number; time: number; value: number } | null = null;
  private eaten = 0;
  private rng: Rng;
  totalPellets: number;

  constructor(seed: string | Rng = 'maze') {
    this.rng = typeof seed === 'string' ? createRng(`maze:${seed}`) : seed;
    this.pellets = new Set();
    this.power = new Set();
    this.fill();
    this.totalPellets = this.pellets.size + this.power.size;
    this.player = { tx: START.x, ty: START.y, t: 0, dir: NONE };
    this.resetActors();
  }

  private fill() {
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const c = MAZE[y]![x];
        if (c === '.') this.pellets.add(y * COLS + x);
        if (c === 'o') this.power.add(y * COLS + x);
      }
  }

  private resetActors() {
    this.player = { tx: START.x, ty: START.y, t: 0, dir: NONE };
    this.wanted = { x: -1, y: 0 };
    const names: WispName[] = ['Dash', 'Scout', 'Twist', 'Drift'];
    this.wisps = names.map((name, i) => ({
      name,
      tx: i === 0 ? OUTSIDE.x : PEN.x - 1 + Math.max(0, i - 1),
      ty: i === 0 ? OUTSIDE.y : PEN.y,
      t: 0,
      dir: { x: -1, y: 0 },
      state: i === 0 ? 'active' : 'pen',
      wait: i * 2.5,
    }));
    this.frightened = 0;
    this.modeTime = 0;
  }

  get pelletsLeft() {
    return this.pellets.size + this.power.size;
  }

  hud() {
    return [
      { label: 'Lives', value: String(this.lives) },
      { label: 'Level', value: String(this.level) },
    ];
  }

  private speedScale() {
    return Math.min(1.35, 1 + (this.level - 1) * 0.06);
  }

  /** Scatter for 6 s, then chase for 20 s, repeating. */
  get scatter() {
    return this.modeTime % 26 < 6;
  }

  step(dt: number, input: Input): string[] {
    const events: string[] = [];
    if (this.over) return events;
    this.readInput(input);
    if (this.pause > 0) {
      this.pause -= dt;
      return events;
    }
    const wasScatter = this.scatter;
    this.modeTime += dt;
    if (wasScatter !== this.scatter) for (const w of this.wisps) if (w.state === 'active') this.reverse(w);
    if (this.frightened > 0) this.frightened = Math.max(0, this.frightened - dt);
    if (this.gem && (this.gem.time -= dt) <= 0) this.gem = null;

    this.movePlayer(dt * 7.5 * this.speedScale(), events);
    for (const w of this.wisps) this.moveWisp(w, dt);
    this.collide(events);
    if (!this.over && this.pelletsLeft === 0) {
      this.level++;
      this.fill();
      this.eaten = 0;
      this.gem = null;
      this.resetActors();
      this.pause = 1.5;
      events.push('level');
    }
    return events;
  }

  private readInput(input: Input) {
    const map: ['up' | 'left' | 'down' | 'right', Dir][] = [
      ['up', DIRS[0]!],
      ['left', DIRS[1]!],
      ['down', DIRS[2]!],
      ['right', DIRS[3]!],
    ];
    for (const [a, d] of map) if (input.pressed.has(a) || input.held.has(a)) this.wanted = d;
    if (input.swipe) this.wanted = map.find(([a]) => a === input.swipe)![1];
  }

  private movePlayer(dist: number, events: string[]) {
    const p = this.player;
    // Reverse at once, mid-tile.
    if (opposite(this.wanted, p.dir) && p.t > 0) {
      p.tx += p.dir.x;
      p.ty += p.dir.y;
      p.t = 1 - p.t;
      p.dir = this.wanted;
    }
    let left = dist;
    while (left > 0) {
      if (p.t === 0) {
        this.eat(events);
        if (!isWall(p.tx + this.wanted.x, p.ty + this.wanted.y, false)) p.dir = this.wanted;
        else if (same(p.dir, NONE) || isWall(p.tx + p.dir.x, p.ty + p.dir.y, false)) {
          p.dir = NONE;
          return;
        }
      }
      const stepT = Math.min(left, 1 - p.t);
      p.t += stepT;
      left -= stepT;
      if (p.t >= 1 - 1e-9) {
        p.tx = (((p.tx + p.dir.x) % COLS) + COLS) % COLS;
        p.ty += p.dir.y;
        p.t = 0;
      }
    }
    if (p.t === 0) this.eat(events);
  }

  private eat(events: string[]) {
    const p = this.player;
    const k = p.ty * COLS + p.tx;
    if (this.pellets.delete(k)) {
      this.score += 10;
      this.eaten++;
      events.push('pellet');
    } else if (this.power.delete(k)) {
      this.score += 50;
      this.eaten++;
      this.frightened = Math.max(2, 7 - (this.level - 1) * 0.6);
      this.combo = 0;
      for (const w of this.wisps) if (w.state === 'active') this.reverse(w);
      events.push('power');
    } else return;
    if (this.eaten === 60 || this.eaten === 140) {
      this.gem = { ...GEM_SPOT, time: 9, value: 100 * Math.min(8, this.level) + 100 };
    }
  }

  private reverse(w: Wisp) {
    if (w.t > 0) {
      w.tx += w.dir.x;
      w.ty += w.dir.y;
      w.t = 1 - w.t;
    }
    w.dir = { x: -w.dir.x, y: -w.dir.y };
  }

  /** Where each Wisp is heading right now. */
  target(w: Wisp): { x: number; y: number } {
    const p = this.player;
    const pd = same(p.dir, NONE) ? this.wanted : p.dir;
    if (w.state === 'eaten') return PEN;
    if (w.state === 'leaving') return OUTSIDE;
    if (this.scatter) return CORNERS[this.wisps.indexOf(w)]!;
    switch (w.name) {
      case 'Dash':
        return { x: p.tx, y: p.ty };
      case 'Scout':
        return { x: p.tx + pd.x * 4, y: p.ty + pd.y * 4 };
      case 'Twist': {
        const d = this.wisps[0]!;
        const ax = p.tx + pd.x * 2;
        const ay = p.ty + pd.y * 2;
        return { x: ax * 2 - d.tx, y: ay * 2 - d.ty };
      }
      default:
        return { x: p.tx, y: p.ty };
    }
  }

  private moveWisp(w: Wisp, dt: number) {
    if (w.state === 'pen') {
      w.wait -= dt;
      if (w.wait <= 0) w.state = 'leaving';
      return;
    }
    const frightened = this.frightened > 0 && w.state === 'active';
    const speed = (w.state === 'eaten' ? 14 : frightened ? 4.5 : 7 * this.speedScale()) * dt;
    const gate = w.state === 'leaving' || w.state === 'eaten';
    let left = speed;
    while (left > 0) {
      if (w.t === 0) {
        if (w.state === 'leaving' && w.tx === OUTSIDE.x && w.ty === OUTSIDE.y) {
          w.state = 'active';
          w.dir = { x: -1, y: 0 };
        }
        if (w.state === 'eaten' && w.tx === PEN.x && w.ty === PEN.y) {
          w.state = 'leaving';
        }
        const options = DIRS.filter((d) => !isWall(w.tx + d.x, w.ty + d.y, gate) && !(w.state === 'active' && cellAt(w.tx + d.x, w.ty + d.y) === '-'));
        const forward = options.filter((d) => !opposite(d, w.dir));
        const choices = forward.length ? forward : options;
        if (!choices.length) return;
        if ((frightened || w.name === 'Drift') && w.state === 'active') w.dir = choices[Math.floor(this.rng() * choices.length)]!;
        else {
          const tg = this.target(w);
          let best = choices[0]!;
          let bestD = Infinity;
          for (const d of choices) {
            const dd = (w.tx + d.x - tg.x) ** 2 + (w.ty + d.y - tg.y) ** 2;
            if (dd < bestD) {
              bestD = dd;
              best = d;
            }
          }
          w.dir = best;
        }
      }
      const stepT = Math.min(left, 1 - w.t);
      w.t += stepT;
      left -= stepT;
      if (w.t >= 1 - 1e-9) {
        w.tx = (((w.tx + w.dir.x) % COLS) + COLS) % COLS;
        w.ty += w.dir.y;
        w.t = 0;
      }
    }
  }

  private collide(events: string[]) {
    const px = posX(this.player);
    const py = posY(this.player);
    if (this.gem && Math.abs(px - this.gem.x) + Math.abs(py - this.gem.y) < 0.6) {
      this.score += this.gem.value;
      this.gem = null;
      events.push('gem');
    }
    for (const w of this.wisps) {
      if (w.state !== 'active') continue;
      if (Math.abs(posX(w) - px) + Math.abs(posY(w) - py) > 0.7) continue;
      if (this.frightened > 0) {
        this.combo++;
        this.score += 100 * 2 ** this.combo;
        w.state = 'eaten';
        events.push('catch');
      } else {
        this.lives--;
        events.push('die');
        if (this.lives <= 0) {
          this.over = true;
          events.push('over');
        } else {
          this.resetActors();
          this.pause = 1.2;
        }
        return;
      }
    }
  }

  /** Screen positions for drawing, in tiles. */
  playerPos() {
    return { x: posX(this.player), y: posY(this.player), dir: same(this.player.dir, NONE) ? this.wanted : this.player.dir };
  }
  wispPos(w: Wisp) {
    return { x: posX(w), y: posY(w) };
  }
}

/** Every open cell reachable from the start (for tests and the level design). */
export function reachable(): Set<number> {
  const seen = new Set<number>([START.y * COLS + START.x]);
  const queue = [START];
  while (queue.length) {
    const c = queue.shift()!;
    for (const d of DIRS) {
      const x = (((c.x + d.x) % COLS) + COLS) % COLS;
      const y = c.y + d.y;
      const k = y * COLS + x;
      if (!seen.has(k) && !isWall(x, y, false)) {
        seen.add(k);
        queue.push({ x, y });
      }
    }
  }
  return seen;
}
