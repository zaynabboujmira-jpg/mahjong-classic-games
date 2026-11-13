import { createRng, type Rng } from '../core/rng';
import { clamp, dist2, type ArcadeEngine, type Input } from './input';

/*
 * Ocean Grow: eat fish smaller than you to grow, and keep away from bigger
 * ones. Reach the size goal to clear a level; the next ocean holds more and
 * bigger predators.
 */
export const W = 360;
export const H = 480;
export const START_R = 10;
const MAX_SPEED = 210;
const ACCEL = 900;
const DRAG = 3;
const MAX_FISH = 13;

export interface Fish {
  x: number;
  y: number;
  vx: number;
  r: number;
  /** Phase of its up-and-down wobble. */
  phase: number;
  hue: number;
}

export class OceanGame implements ArcadeEngine {
  x = W / 2;
  y = H / 2;
  vx = 0;
  vy = 0;
  r = START_R;
  facing = 1;
  fish: Fish[] = [];
  score = 0;
  lives = 3;
  level = 1;
  over = false;
  /** Seconds of protection after respawning. */
  safe = 2;
  time = 0;
  private spawnTimer = 0;
  private rng: Rng;

  constructor(seed: string | Rng = 'ocean') {
    this.rng = typeof seed === 'string' ? createRng(`ocean:${seed}`) : seed;
    for (let i = 0; i < 6; i++) this.spawn(true);
  }

  /** Radius that clears the current level. */
  goal() {
    return START_R + 14 + this.level * 2;
  }
  /** 0..1 towards the goal, for the growth bar. */
  progress() {
    return clamp((this.r - START_R) / (this.goal() - START_R), 0, 1);
  }

  hud() {
    return [
      { label: 'Lives', value: String(this.lives) },
      { label: 'Level', value: String(this.level) },
      { label: 'Growth', value: `${Math.round(this.progress() * 100)}%` },
    ];
  }

  /** New fish: mostly smaller than you early on, more big ones on later levels. */
  spawn(anywhere = false) {
    const bigChance = Math.min(0.55, 0.3 + this.level * 0.05);
    const big = this.rng() < bigChance;
    const r = big ? this.r * (1.15 + this.rng() * (0.8 + this.level * 0.1)) : Math.max(4, this.r * (0.35 + this.rng() * 0.55));
    const left = this.rng() < 0.5;
    const speed = (35 + this.rng() * 60) * (big ? 0.85 : 1.1) * (1 + (this.level - 1) * 0.08);
    let x = left ? -r - 4 : W + r + 4;
    let y = 30 + this.rng() * (H - 60);
    if (anywhere) {
      // Opening fish keep clear of the player.
      do {
        x = this.rng() * W;
        y = 30 + this.rng() * (H - 60);
      } while (dist2(x, y, this.x, this.y) < 110 ** 2);
    }
    this.fish.push({ x, y, vx: left ? speed : -speed, r: Math.min(70, r), phase: this.rng() * Math.PI * 2, hue: Math.floor(this.rng() * 360) });
  }

  step(dt: number, input: Input): string[] {
    const ev: string[] = [];
    if (this.over) return ev;
    this.time += dt;
    if (this.safe > 0) this.safe -= dt;

    // Steering: follow the finger or mouse, or swim with the keys.
    let ax = (input.held.has('right') ? 1 : 0) - (input.held.has('left') ? 1 : 0);
    let ay = (input.held.has('down') ? 1 : 0) - (input.held.has('up') ? 1 : 0);
    if (!ax && !ay && input.pointer) {
      const dx = input.pointer.x - this.x;
      const dy = input.pointer.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        const k = Math.min(1, d / 60);
        ax = (dx / d) * k;
        ay = (dy / d) * k;
      }
    }
    this.vx += ax * ACCEL * dt;
    this.vy += ay * ACCEL * dt;
    const drag = Math.max(0, 1 - DRAG * dt);
    this.vx *= drag;
    this.vy *= drag;
    const sp = Math.hypot(this.vx, this.vy);
    const max = MAX_SPEED * (1 - Math.min(0.3, (this.r - START_R) / 120));
    if (sp > max) {
      this.vx *= max / sp;
      this.vy *= max / sp;
    }
    this.x = clamp(this.x + this.vx * dt, this.r, W - this.r);
    this.y = clamp(this.y + this.vy * dt, this.r, H - this.r);
    if (Math.abs(this.vx) > 8) this.facing = Math.sign(this.vx);

    // Other fish swim across with a gentle wobble.
    for (const f of this.fish) {
      f.x += f.vx * dt;
      f.phase += dt * 2;
      f.y += Math.sin(f.phase) * 12 * dt;
    }
    this.fish = this.fish.filter((f) => f.x > -f.r - 10 && f.x < W + f.r + 10);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.fish.length < MAX_FISH) {
      this.spawn();
      this.spawnTimer = 0.45 + this.rng() * 0.6;
    }

    for (const f of this.fish) {
      const d = Math.sqrt(dist2(f.x, f.y, this.x, this.y));
      if (f.r < this.r && d < this.r + f.r * 0.35) {
        // Grow by a share of the eaten fish's area; points scale with its size.
        const fr = f.r;
        f.r = 0;
        this.r = Math.sqrt(this.r ** 2 + 0.3 * fr ** 2);
        this.score += Math.round(fr) * 10;
        this.eat(ev);
      } else if (f.r > this.r && d < f.r + this.r * 0.35 && this.safe <= 0) {
        this.lives--;
        ev.push('die');
        if (this.lives <= 0) {
          this.over = true;
          ev.push('over');
          return ev;
        }
        Object.assign(this, { x: W / 2, y: H / 2, vx: 0, vy: 0, r: START_R, safe: 2 });
        this.fish = this.fish.filter((g) => dist2(g.x, g.y, W / 2, H / 2) > 120 ** 2);
        return ev;
      }
    }
    this.fish = this.fish.filter((f) => f.r > 0);
    return ev;
  }

  private eat(ev: string[]) {
    ev.push('eat');
    if (this.r >= this.goal()) {
      this.level++;
      this.score += 500;
      this.r = START_R;
      this.safe = 1.5;
      // A fresh ocean scaled to the new, small you.
      this.fish = [];
      for (let i = 0; i < 6; i++) this.spawn(true);
      ev.push('level');
    }
  }
}
