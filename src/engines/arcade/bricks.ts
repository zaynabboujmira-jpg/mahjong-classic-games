import { createRng, type Rng } from '../core/rng';
import { clamp, type ArcadeEngine, type Input } from './input';

/*
 * Brick Breaker: keep the ball in play with the paddle and clear every brick.
 * Silver bricks take two hits. Some bricks drop a power-up: a wider paddle,
 * an extra ball, or an extra life. Five layouts, then they repeat faster.
 */
export const W = 360;
export const H = 480;
export const PADDLE_Y = 446;
export const PADDLE_H = 10;
export const BALL_R = 5;
export const BRICK_COLS = 10;
export const BRICK_W = 34;
export const BRICK_H = 14;
export const BRICK_GAP = 2;
export const BRICK_TOP = 56;
const BRICK_LEFT = (W - (BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP)) / 2;
const PADDLE_W = 64;
const WIDE_W = 100;
const WIDE_TIME = 15;
const PADDLE_SPEED = 420;
const DROP_CHANCE = 0.12;
const MAX_BALLS = 6;

/**
 * Brick layouts, one string per row: '.' empty, '1'-'5' a colour (one hit),
 * 'S' silver (two hits).
 */
export const LEVELS: readonly string[][] = [
  ['1111111111', '2222222222', '3333333333', '4444444444', '5555555555'],
  ['....11....', '...2222...', '..333333..', '.44444444.', '5555555555', 'SS.SS.SS.S'],
  ['1.1.1.1.1.', '.2.2.2.2.2', '3.3.3.3.3.', '.4.4.4.4.4', 'SSSSSSSSSS', '5555555555'],
  ['S11111111S', 'S2......2S', 'S2.3333.2S', 'S2.4444.2S', 'S2......2S', 'S55555555S'],
  ['1111..1111', '2SS2..2SS2', '3333..3333', '..........', '4444444444', 'S5S5S5S5S5', '5555555555'],
];

export type PowerKind = 'wide' | 'multi' | 'life';
export interface Brick {
  x: number;
  y: number;
  hits: number;
  color: string;
}
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface Power {
  x: number;
  y: number;
  kind: PowerKind;
}

export class BricksGame implements ArcadeEngine {
  paddleX = W / 2;
  balls: Ball[] = [];
  bricks: Brick[] = [];
  powers: Power[] = [];
  lives = 3;
  level = 1;
  score = 0;
  over = false;
  /** Ball resting on the paddle, waiting to be launched. */
  serving = true;
  wideFor = 0;
  private serveTimer = 0;
  private rng: Rng;

  constructor(seed = 'bricks') {
    this.rng = createRng(`bricks:${seed}`);
    this.loadLevel();
  }

  get paddleW() {
    return this.wideFor > 0 ? WIDE_W : PADDLE_W;
  }
  /** Ball speed for this level (pixels per second). */
  speed() {
    return Math.min(470, 280 + (this.level - 1) * 22);
  }

  hud() {
    return [
      { label: 'Lives', value: String(this.lives) },
      { label: 'Level', value: String(this.level) },
    ];
  }

  summary() {
    return `Reached level ${this.level}.`;
  }

  loadLevel() {
    const rows = LEVELS[(this.level - 1) % LEVELS.length]!;
    this.bricks = [];
    rows.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === '.') return;
        this.bricks.push({
          x: BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          hits: ch === 'S' ? 2 : 1,
          color: ch,
        });
      }),
    );
    this.powers = [];
    this.serve();
  }

  serve() {
    this.serving = true;
    this.serveTimer = 0;
    this.balls = [{ x: this.paddleX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0 }];
  }

  launch() {
    if (!this.serving) return;
    this.serving = false;
    const s = this.speed();
    const a = -Math.PI / 2 + (this.rng() - 0.5) * 0.6;
    this.balls[0]!.vx = Math.cos(a) * s;
    this.balls[0]!.vy = Math.sin(a) * s;
  }

  step(dt: number, input: Input): string[] {
    const ev: string[] = [];
    if (this.over) return ev;
    // Paddle: follows the pointer, or the keys.
    const half = this.paddleW / 2;
    if (input.pointer) this.paddleX = input.pointer.x;
    if (input.held.has('left')) this.paddleX -= PADDLE_SPEED * dt;
    if (input.held.has('right')) this.paddleX += PADDLE_SPEED * dt;
    this.paddleX = clamp(this.paddleX, half, W - half);
    if (this.wideFor > 0) this.wideFor = Math.max(0, this.wideFor - dt);

    if (this.serving) {
      this.balls[0]!.x = this.paddleX;
      this.serveTimer += dt;
      if (input.pressed.has('fire') || input.pressed.has('up') || input.taps > 0 || this.serveTimer > 3) {
        this.launch();
        ev.push('launch');
      }
      return ev;
    }

    for (const b of this.balls) this.moveBall(b, dt, ev);
    const before = this.balls.length;
    this.balls = this.balls.filter((b) => b.y - BALL_R < H);
    if (this.balls.length < before && this.balls.length === 0) {
      this.lives--;
      this.wideFor = 0;
      ev.push('lose');
      if (this.lives <= 0) {
        this.over = true;
        return ev;
      }
      this.serve();
      return ev;
    }

    // Power-ups fall and are caught by the paddle.
    for (const p of this.powers) p.y += 120 * dt;
    this.powers = this.powers.filter((p) => {
      if (p.y + 8 >= PADDLE_Y && p.y - 8 <= PADDLE_Y + PADDLE_H && Math.abs(p.x - this.paddleX) <= half + 8) {
        this.apply(p.kind);
        ev.push('power');
        return false;
      }
      return p.y < H + 10;
    });

    if (this.bricks.length === 0) {
      this.level++;
      this.score += 100;
      ev.push('level');
      this.loadLevel();
    }
    return ev;
  }

  apply(kind: PowerKind) {
    if (kind === 'wide') this.wideFor = WIDE_TIME;
    else if (kind === 'life') this.lives = Math.min(9, this.lives + 1);
    else {
      const add: Ball[] = [];
      for (const b of this.balls) {
        if (this.balls.length + add.length >= MAX_BALLS) break;
        const s = Math.hypot(b.vx, b.vy);
        const a = Math.atan2(b.vy, b.vx);
        add.push({ x: b.x, y: b.y, vx: Math.cos(a + 0.5) * s, vy: Math.sin(a + 0.5) * s });
      }
      this.balls.push(...add);
    }
  }

  private moveBall(b: Ball, dt: number, ev: string[]) {
    // Sub-steps so a fast ball never skips through a brick.
    const dist = Math.hypot(b.vx, b.vy) * dt;
    const n = Math.max(1, Math.ceil(dist / (BALL_R * 0.8)));
    for (let i = 0; i < n; i++) {
      b.x += (b.vx * dt) / n;
      b.y += (b.vy * dt) / n;
      if (b.x < BALL_R) {
        b.x = BALL_R;
        b.vx = Math.abs(b.vx);
        ev.push('wall');
      } else if (b.x > W - BALL_R) {
        b.x = W - BALL_R;
        b.vx = -Math.abs(b.vx);
        ev.push('wall');
      }
      if (b.y < BALL_R) {
        b.y = BALL_R;
        b.vy = Math.abs(b.vy);
        ev.push('wall');
      }
      // Paddle: the hit position sets the angle.
      const half = this.paddleW / 2;
      if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y + BALL_R <= PADDLE_Y + PADDLE_H + 6 && Math.abs(b.x - this.paddleX) <= half + BALL_R) {
        const off = clamp((b.x - this.paddleX) / half, -1, 1);
        const a = -Math.PI / 2 + off * 1.05;
        const s = Math.max(this.speed(), Math.hypot(b.vx, b.vy));
        b.vx = Math.cos(a) * s;
        b.vy = Math.sin(a) * s;
        b.y = PADDLE_Y - BALL_R;
        ev.push('paddle');
      }
      const hit = this.bricks.findIndex((k) => b.x + BALL_R > k.x && b.x - BALL_R < k.x + BRICK_W && b.y + BALL_R > k.y && b.y - BALL_R < k.y + BRICK_H);
      if (hit >= 0) {
        const k = this.bricks[hit]!;
        // Bounce on the side with the smaller overlap.
        const ox = Math.min(b.x + BALL_R - k.x, k.x + BRICK_W - (b.x - BALL_R));
        const oy = Math.min(b.y + BALL_R - k.y, k.y + BRICK_H - (b.y - BALL_R));
        if (ox < oy) {
          b.vx = b.x < k.x + BRICK_W / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
        } else {
          b.vy = b.y < k.y + BRICK_H / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
        }
        k.hits--;
        if (k.hits <= 0) {
          this.bricks.splice(hit, 1);
          this.score += k.color === 'S' ? 25 : 10;
          ev.push('brick');
          if (this.rng() < DROP_CHANCE) {
            const r = this.rng();
            this.powers.push({ x: k.x + BRICK_W / 2, y: k.y + BRICK_H / 2, kind: r < 0.45 ? 'wide' : r < 0.85 ? 'multi' : 'life' });
          }
        } else ev.push('tough');
        // Keep the ball from going too flat.
        if (Math.abs(b.vy) < 80) b.vy = b.vy < 0 ? -80 : 80;
        break;
      }
    }
  }
}
