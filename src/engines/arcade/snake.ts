import { createRng, type Rng } from '../core/rng';
import { type ArcadeEngine, type Input } from './input';

/*
 * Snake: steer a growing snake to the food on a 20×20 grid. Each food adds a
 * segment and points; running into yourself (or a wall in Classic mode) ends
 * the game. In Wrap mode the snake comes out on the opposite side.
 */
export const GRID = 20;
export const CELL = 20;
export const W = GRID * CELL;
export const H = GRID * CELL;

export type SnakeMode = 'classic' | 'wrap';
export type SnakeSpeed = 'easy' | 'normal' | 'fast';
export const SNAKE_MODES: readonly SnakeMode[] = ['classic', 'wrap'];
export const SNAKE_SPEEDS: readonly SnakeSpeed[] = ['easy', 'normal', 'fast'];
/** Steps per second at the start, and the cap. */
const RATE: Record<SnakeSpeed, [number, number]> = { easy: [6, 9], normal: [9, 14], fast: [13, 20] };
const POINTS: Record<SnakeSpeed, number> = { easy: 5, normal: 10, fast: 15 };

type Dir = 'up' | 'down' | 'left' | 'right';
const VEC: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export interface Point {
  x: number;
  y: number;
}

export class SnakeGame implements ArcadeEngine {
  readonly mode: SnakeMode;
  readonly speed: SnakeSpeed;
  /** Head first. */
  body: Point[];
  dir: Dir = 'right';
  /** Turns queued by fast key presses, applied one per step. */
  private queue: Dir[] = [];
  food: Point;
  score = 0;
  eaten = 0;
  over = false;
  /** Fraction of the way to the next step, for smooth drawing. */
  progress = 0;
  private rng: Rng;

  constructor(seed = 'snake', mode: SnakeMode = 'classic', speed: SnakeSpeed = 'normal') {
    this.mode = mode;
    this.speed = speed;
    this.rng = createRng(`snake:${seed}`);
    const y = Math.floor(GRID / 2);
    this.body = [
      { x: 6, y },
      { x: 5, y },
      { x: 4, y },
    ];
    this.food = this.placeFood();
  }

  rate() {
    const [start, cap] = RATE[this.speed];
    return Math.min(cap, start + this.eaten * 0.25);
  }

  hud() {
    return [{ label: 'Length', value: String(this.body.length) }];
  }

  summary() {
    return `Length ${this.body.length} · ${this.mode === 'wrap' ? 'Wrap' : 'Classic'}, ${this.speed}.`;
  }

  private placeFood(): Point {
    const taken = new Set(this.body.map((p) => p.y * GRID + p.x));
    const free: number[] = [];
    for (let i = 0; i < GRID * GRID; i++) if (!taken.has(i)) free.push(i);
    const i = free[Math.floor(this.rng() * free.length)] ?? 0;
    return { x: i % GRID, y: Math.floor(i / GRID) };
  }

  /** Queues a turn; reversing straight into yourself is ignored. */
  turn(d: Dir) {
    const last = this.queue[this.queue.length - 1] ?? this.dir;
    if (d === last || d === OPPOSITE[last] || this.queue.length >= 3) return;
    this.queue.push(d);
  }

  /** Moves one cell; returns event names. */
  advance(): string[] {
    const next = this.queue.shift();
    if (next) this.dir = next;
    const [dx, dy] = VEC[this.dir];
    const head = this.body[0]!;
    let x = head.x + dx;
    let y = head.y + dy;
    if (this.mode === 'wrap') {
      x = (x + GRID) % GRID;
      y = (y + GRID) % GRID;
    } else if (x < 0 || y < 0 || x >= GRID || y >= GRID) {
      this.over = true;
      return ['crash'];
    }
    const eats = x === this.food.x && y === this.food.y;
    // The tail moves away this step unless the snake grows, so it is not an obstacle.
    const solid = eats ? this.body : this.body.slice(0, -1);
    if (solid.some((p) => p.x === x && p.y === y)) {
      this.over = true;
      return ['crash'];
    }
    this.body.unshift({ x, y });
    if (eats) {
      this.eaten++;
      this.score += POINTS[this.speed];
      if (this.body.length >= GRID * GRID) {
        this.over = true;
        return ['eat', 'win'];
      }
      this.food = this.placeFood();
      return ['eat'];
    }
    this.body.pop();
    return [];
  }

  step(dt: number, input: Input): string[] {
    if (this.over) return [];
    for (const d of ['up', 'down', 'left', 'right'] as const) if (input.pressed.has(d)) this.turn(d);
    if (input.swipe) this.turn(input.swipe);
    const ev: string[] = [];
    this.progress += dt * this.rate();
    while (this.progress >= 1 && !this.over) {
      this.progress -= 1;
      ev.push(...this.advance());
    }
    return ev;
  }
}
