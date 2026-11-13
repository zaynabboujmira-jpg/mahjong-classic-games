import { createRng, type Rng } from '../core/rng';
import { type ArcadeEngine, type Input } from './input';

/*
 * Flappy Wing: tap to flap through gaps between stone columns. Gravity pulls
 * the little bird down; each flap sets an upward speed. The gap narrows a
 * little as the score climbs.
 */
export const W = 288;
export const H = 512;
export const GROUND = 456;
export const BIRD_X = 80;
export const BIRD_R = 12;
export const COLUMN_W = 54;
const GRAVITY = 1450;
const FLAP = -410;
const MAX_FALL = 560;
const SPEED = 130;
const SPACING = 170;

export const MEDALS: readonly { name: string; min: number }[] = [
  { name: 'Platinum', min: 40 },
  { name: 'Gold', min: 30 },
  { name: 'Silver', min: 20 },
  { name: 'Bronze', min: 10 },
];
export const medalFor = (score: number) => MEDALS.find((m) => score >= m.min)?.name ?? null;

export interface Column {
  x: number;
  /** Centre of the gap. */
  gapY: number;
  gap: number;
  scored: boolean;
}

export class FlappyGame implements ArcadeEngine {
  y = H * 0.42;
  vy = 0;
  /** Waiting for the first flap: the bird bobs and nothing scrolls. */
  waiting = true;
  columns: Column[] = [];
  score = 0;
  over = false;
  /** Ground scroll offset, for drawing. */
  scroll = 0;
  time = 0;
  private rng: Rng;

  constructor(seed: string | Rng = 'flappy') {
    this.rng = typeof seed === 'string' ? createRng(`flappy:${seed}`) : seed;
  }

  hud() {
    const m = medalFor(this.score);
    return [{ label: 'Medal', value: m ?? '–' }];
  }

  summary() {
    const m = medalFor(this.score);
    const next = [...MEDALS].reverse().find((x) => x.min > this.score);
    return m ? `${m} medal!${next ? ` ${next.min - this.score} more for ${next.name}.` : ''}` : `${10 - this.score} more for a Bronze medal.`;
  }

  gapSize() {
    return Math.max(104, 132 - Math.floor(this.score / 10) * 6);
  }

  private spawn(x: number) {
    const gap = this.gapSize();
    const min = 70 + gap / 2;
    const max = GROUND - 50 - gap / 2;
    this.columns.push({ x, gapY: min + this.rng() * (max - min), gap, scored: false });
  }

  step(dt: number, input: Input): string[] {
    const ev: string[] = [];
    if (this.over) return ev;
    this.time += dt;
    const flap = input.pressed.has('fire') || input.pressed.has('up') || input.taps > 0;
    if (this.waiting) {
      this.y = H * 0.42 + Math.sin(this.time * 6) * 6;
      if (!flap) return ev;
      this.waiting = false;
      this.spawn(W + 40);
    }
    if (flap) {
      this.vy = FLAP;
      ev.push('flap');
    }
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.y += this.vy * dt;
    if (this.y < BIRD_R) {
      this.y = BIRD_R;
      this.vy = 0;
    }
    this.scroll = (this.scroll + SPEED * dt) % 24;
    for (const c of this.columns) c.x -= SPEED * dt;
    const last = this.columns[this.columns.length - 1];
    if (last && last.x < W - SPACING) this.spawn(last.x + SPACING);
    this.columns = this.columns.filter((c) => c.x > -COLUMN_W - 4);

    for (const c of this.columns) {
      if (!c.scored && c.x + COLUMN_W < BIRD_X - BIRD_R) {
        c.scored = true;
        this.score++;
        ev.push(medalFor(this.score) !== medalFor(this.score - 1) ? 'medal' : 'point');
      }
      if (this.hits(c)) return this.crash(ev);
    }
    if (this.y + BIRD_R >= GROUND) {
      this.y = GROUND - BIRD_R;
      return this.crash(ev);
    }
    return ev;
  }

  /** Circle against the two column rectangles. */
  hits(c: Column): boolean {
    const nearestX = Math.max(c.x, Math.min(BIRD_X, c.x + COLUMN_W));
    const top = c.gapY - c.gap / 2;
    const bottom = c.gapY + c.gap / 2;
    const r = BIRD_R - 2;
    const inX = (BIRD_X - nearestX) ** 2 < r * r;
    if (!inX) return false;
    const nearTop = Math.min(this.y, top);
    const nearBottom = Math.max(this.y, bottom);
    return (BIRD_X - nearestX) ** 2 + (this.y - nearTop) ** 2 < r * r || (BIRD_X - nearestX) ** 2 + (this.y - nearBottom) ** 2 < r * r;
  }

  private crash(ev: string[]) {
    this.over = true;
    ev.push('hit', 'over');
    return ev;
  }
}
