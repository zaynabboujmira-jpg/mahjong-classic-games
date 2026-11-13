import { createRng, type Rng } from '../core/rng';
import { dist2, wrap, type ArcadeEngine, type Input } from './input';

/*
 * Space Rocks: a vector-style shooter. The ship turns, thrusts and drifts
 * with inertia; everything wraps around the screen edges. Rocks split into
 * two smaller ones when hit. Hyperspace jumps to a random spot.
 */
export const W = 480;
export const H = 480;
export const SHIP_R = 10;
export const ROCK_R = [0, 13, 24, 42];
const ROCK_POINTS = [0, 100, 50, 20];
const TURN = 4.2;
const THRUST = 280;
const DRAG = 0.45;
const MAX_SPEED = 330;
const BULLET_SPEED = 440;
const BULLET_LIFE = 0.95;
const MAX_BULLETS = 5;
const EXTRA_LIFE_EVERY = 10_000;

export interface Rock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: 1 | 2 | 3;
  /** Outline radii (0.7-1.15 of the size) for a lumpy shape. */
  shape: number[];
  spin: number;
  angle: number;
}
export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export class RocksGame implements ArcadeEngine {
  ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2 };
  rocks: Rock[] = [];
  bullets: Bullet[] = [];
  score = 0;
  lives = 3;
  wave = 0;
  over = false;
  /** Seconds of spawn protection (drawn as a shield). */
  shield = 2;
  /** Seconds until the ship reappears after being hit. */
  respawn = 0;
  thrusting = false;
  private cooldown = 0;
  private hyperCooldown = 0;
  private nextExtra = EXTRA_LIFE_EVERY;
  private rng: Rng;

  constructor(seed: string | Rng = 'rocks') {
    this.rng = typeof seed === 'string' ? createRng(`rocks:${seed}`) : seed;
    this.nextWave();
  }

  hud() {
    return [
      { label: 'Lives', value: String(this.lives) },
      { label: 'Wave', value: String(this.wave) },
    ];
  }

  makeRock(x: number, y: number, size: 1 | 2 | 3): Rock {
    const speed = (40 + this.rng() * 50) * (4 - size) ** 0.5 * (1 + this.wave * 0.06);
    const a = this.rng() * Math.PI * 2;
    return {
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size,
      shape: Array.from({ length: 11 }, () => 0.72 + this.rng() * 0.42),
      spin: (this.rng() - 0.5) * 1.6,
      angle: 0,
    };
  }

  private nextWave() {
    this.wave++;
    const n = Math.min(11, 3 + this.wave);
    for (let i = 0; i < n; i++) {
      // Spawn away from the ship.
      let x = 0;
      let y = 0;
      do {
        x = this.rng() * W;
        y = this.rng() * H;
      } while (dist2(x, y, this.ship.x, this.ship.y) < 150 ** 2);
      this.rocks.push(this.makeRock(x, y, 3));
    }
  }

  step(dt: number, input: Input): string[] {
    const ev: string[] = [];
    if (this.over) return ev;
    const s = this.ship;
    this.cooldown -= dt;
    this.hyperCooldown -= dt;
    if (this.shield > 0) this.shield -= dt;

    if (this.respawn > 0) {
      this.respawn -= dt;
      if (this.respawn <= 0) {
        Object.assign(s, { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2 });
        this.shield = 2.5;
      }
    } else {
      const turn = (input.held.has('right') ? 1 : 0) - (input.held.has('left') ? 1 : 0);
      s.angle += turn * TURN * dt;
      this.thrusting = input.held.has('up');
      if (this.thrusting) {
        s.vx += Math.cos(s.angle) * THRUST * dt;
        s.vy += Math.sin(s.angle) * THRUST * dt;
      }
      const drag = Math.max(0, 1 - DRAG * dt);
      s.vx *= drag;
      s.vy *= drag;
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > MAX_SPEED) {
        s.vx *= MAX_SPEED / sp;
        s.vy *= MAX_SPEED / sp;
      }
      s.x = wrap(s.x + s.vx * dt, W);
      s.y = wrap(s.y + s.vy * dt, H);

      const fire = input.pressed.has('fire') || input.taps > 0 || (input.held.has('fire') && this.cooldown <= -0.12);
      if (fire && this.cooldown <= 0 && this.bullets.length < MAX_BULLETS) {
        this.bullets.push({
          x: s.x + Math.cos(s.angle) * SHIP_R,
          y: s.y + Math.sin(s.angle) * SHIP_R,
          vx: s.vx + Math.cos(s.angle) * BULLET_SPEED,
          vy: s.vy + Math.sin(s.angle) * BULLET_SPEED,
          life: BULLET_LIFE,
        });
        this.cooldown = 0.16;
        ev.push('fire');
      }
      if (input.pressed.has('special') && this.hyperCooldown <= 0) {
        s.x = 30 + this.rng() * (W - 60);
        s.y = 30 + this.rng() * (H - 60);
        s.vx = 0;
        s.vy = 0;
        this.hyperCooldown = 2;
        this.shield = Math.max(this.shield, 0.6);
        ev.push('hyper');
      }
    }

    for (const b of this.bullets) {
      b.x = wrap(b.x + b.vx * dt, W);
      b.y = wrap(b.y + b.vy * dt, H);
      b.life -= dt;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    for (const r of this.rocks) {
      r.x = wrap(r.x + r.vx * dt, W);
      r.y = wrap(r.y + r.vy * dt, H);
      r.angle += r.spin * dt;
    }

    // Bullets against rocks.
    const born: Rock[] = [];
    for (const r of this.rocks) {
      const rr = ROCK_R[r.size]!;
      const b = this.bullets.find((b) => dist2(b.x, b.y, r.x, r.y) < rr * rr);
      if (!b) continue;
      b.life = 0;
      r.size = (r.size - 1) as Rock['size'];
      this.score += ROCK_POINTS[r.size + 1]!;
      ev.push(`bang${r.size + 1}`);
      if (r.size > 0) born.push(this.makeRock(r.x, r.y, r.size as 1 | 2), this.makeRock(r.x, r.y, r.size as 1 | 2));
    }
    this.rocks = [...this.rocks.filter((r) => r.size > 0), ...born];
    this.bullets = this.bullets.filter((b) => b.life > 0);

    // Ship against rocks.
    if (this.respawn <= 0 && this.shield <= 0) {
      const hit = this.rocks.find((r) => dist2(r.x, r.y, s.x, s.y) < (ROCK_R[r.size]! * 0.85 + SHIP_R) ** 2);
      if (hit) {
        this.lives--;
        ev.push('die');
        if (this.lives <= 0) {
          this.over = true;
          ev.push('over');
          return ev;
        }
        this.respawn = 1.5;
      }
    }

    if (this.score >= this.nextExtra) {
      this.lives++;
      this.nextExtra += EXTRA_LIFE_EVERY;
      ev.push('extra');
    }
    if (this.rocks.length === 0) {
      this.nextWave();
      this.shield = Math.max(this.shield, 1.5);
      ev.push('wave');
    }
    return ev;
  }
}
