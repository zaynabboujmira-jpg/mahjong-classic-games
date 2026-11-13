import { createRng, type Rng } from '../core/rng';

/*
 * Paddle Ball physics in a fixed logical field (800 × 500 units). Paddles
 * move vertically at the left (player 1) and right (player 2 or the
 * computer). The renderer may draw the field turned sideways on portrait
 * screens; the physics never change.
 */
export const FIELD = { w: 800, h: 500 };
export const PADDLE = { w: 12, h: 90, inset: 24 };
export const BALL = 10;
export const WIN_SCORE = 7;

export type Level = 'easy' | 'medium' | 'unbeatable';
export const LEVELS: readonly Level[] = ['easy', 'medium', 'unbeatable'];

interface AiTuning {
  /** Max paddle speed, units per second. */
  speed: number;
  /** Seconds before reacting to a new ball direction. */
  reaction: number;
  /** Aim error, units (re-rolled each rally). */
  error: number;
  /** Predict wall bounces instead of chasing the ball. */
  predict: boolean;
}

const AI: Record<Level, AiTuning> = {
  easy: { speed: 260, reaction: 0.28, error: 55, predict: false },
  medium: { speed: 420, reaction: 0.14, error: 28, predict: true },
  // Faster than the ball can ever move vertically, with perfect prediction: it never misses.
  unbeatable: { speed: 2000, reaction: 0, error: 0, predict: true },
};

export const START_SPEED = 380;
export const MAX_SPEED = 900;
/** Steepest return angle, so rallies never become near-vertical. */
const MAX_ANGLE = (55 * Math.PI) / 180;

export type PaddleEvent = 'paddle' | 'wall' | 'score-left' | 'score-right' | 'win-left' | 'win-right';

export interface Paddle {
  y: number;
  /** Target the paddle moves towards (touch / mouse / AI), or null. */
  target: number | null;
  /** Keyboard direction: -1 up, 1 down, 0 none. */
  dir: number;
}

export class PaddleGame {
  readonly left: Paddle;
  readonly right: Paddle;
  ball = { x: FIELD.w / 2, y: FIELD.h / 2, vx: 0, vy: 0 };
  score: [number, number] = [0, 0];
  /** Seconds until the next serve. */
  serveIn = 0.8;
  over = false;
  /** Right paddle controlled by the computer at this level, or null for two players. */
  ai: Level | null;
  private rng: Rng;
  private serveTo = 1;
  private aiDelay = 0;
  private aiAim = 0;
  private lastVx = 0;

  constructor(ai: Level | null, seed: string | Rng = 'paddle') {
    this.ai = ai;
    this.rng = typeof seed === 'string' ? createRng(seed) : seed;
    this.left = { y: FIELD.h / 2, target: null, dir: 0 };
    this.right = { y: FIELD.h / 2, target: null, dir: 0 };
  }

  get speed() {
    return Math.hypot(this.ball.vx, this.ball.vy);
  }

  private serve() {
    const angle = (this.rng() - 0.5) * 0.9;
    this.ball = { x: FIELD.w / 2, y: FIELD.h * (0.3 + this.rng() * 0.4), vx: Math.cos(angle) * START_SPEED * this.serveTo, vy: Math.sin(angle) * START_SPEED };
  }

  /** Where the ball will cross x, following bounces off the top and bottom walls. */
  static predictY(b: { x: number; y: number; vx: number; vy: number }, x: number): number {
    if (b.vx === 0) return b.y;
    const t = (x - b.x) / b.vx;
    if (t < 0) return b.y;
    const top = BALL / 2;
    const span = FIELD.h - BALL;
    let y = b.y + b.vy * t - top;
    const period = span * 2;
    y = ((y % period) + period) % period;
    if (y > span) y = period - y;
    return y + top;
  }

  private movePaddle(p: Paddle, dt: number, maxSpeed: number) {
    const half = PADDLE.h / 2;
    if (p.dir) p.y += p.dir * maxSpeed * dt;
    else if (p.target !== null) {
      const d = p.target - p.y;
      const step = maxSpeed * dt;
      p.y += Math.abs(d) <= step ? d : Math.sign(d) * step;
    }
    p.y = Math.min(FIELD.h - half, Math.max(half, p.y));
  }

  private think(dt: number) {
    const tune = AI[this.ai!];
    const b = this.ball;
    if (Math.sign(b.vx) !== Math.sign(this.lastVx)) {
      this.aiDelay = tune.reaction;
      this.aiAim = (this.rng() - 0.5) * 2 * tune.error;
    }
    this.lastVx = b.vx;
    if (this.aiDelay > 0) {
      this.aiDelay -= dt;
      return;
    }
    const x = FIELD.w - PADDLE.inset - PADDLE.w;
    if (b.vx > 0) {
      const y = tune.predict ? PaddleGame.predictY(b, x) : b.y;
      this.right.target = y + this.aiAim;
    } else this.right.target = this.ai === 'easy' ? b.y : FIELD.h / 2;
  }

  /** Advances the game by dt seconds; returns what happened (for sounds). */
  step(dt: number): PaddleEvent[] {
    const events: PaddleEvent[] = [];
    if (this.over) return events;
    dt = Math.min(dt, 1 / 30);
    const playerSpeed = 620;
    this.movePaddle(this.left, dt, playerSpeed);
    if (this.ai) {
      this.think(dt);
      this.movePaddle(this.right, dt, AI[this.ai].speed);
    } else this.movePaddle(this.right, dt, playerSpeed);

    if (this.serveIn > 0) {
      this.serveIn -= dt;
      if (this.serveIn <= 0) this.serve();
      return events;
    }

    // Sub-steps keep fast balls from tunnelling through paddles.
    const steps = Math.ceil((this.speed * dt) / (BALL / 2)) || 1;
    for (let s = 0; s < steps; s++) {
      const e = this.substep(dt / steps);
      if (e) {
        events.push(e);
        if (e.startsWith('score') || e.startsWith('win')) break;
      }
    }
    return events;
  }

  private substep(dt: number): PaddleEvent | null {
    const b = this.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const r = BALL / 2;
    if (b.y < r) {
      b.y = r;
      b.vy = Math.abs(b.vy);
      return 'wall';
    }
    if (b.y > FIELD.h - r) {
      b.y = FIELD.h - r;
      b.vy = -Math.abs(b.vy);
      return 'wall';
    }
    const lx = PADDLE.inset + PADDLE.w;
    const rx = FIELD.w - PADDLE.inset - PADDLE.w;
    if (b.vx < 0 && b.x - r <= lx && b.x - r >= PADDLE.inset - r && Math.abs(b.y - this.left.y) <= PADDLE.h / 2 + r) {
      this.bounce(this.left, 1, lx + r);
      return 'paddle';
    }
    if (b.vx > 0 && b.x + r >= rx && b.x + r <= rx + PADDLE.w + r && Math.abs(b.y - this.right.y) <= PADDLE.h / 2 + r) {
      this.bounce(this.right, -1, rx - r);
      return 'paddle';
    }
    if (b.x < -r || b.x > FIELD.w + r) {
      const scorer = b.x < 0 ? 1 : 0;
      this.score[scorer]!++;
      this.serveTo = scorer === 0 ? 1 : -1;
      this.ball = { x: FIELD.w / 2, y: FIELD.h / 2, vx: 0, vy: 0 };
      if (this.score[scorer]! >= WIN_SCORE) {
        this.over = true;
        return scorer === 0 ? 'win-left' : 'win-right';
      }
      this.serveIn = 0.9;
      return scorer === 0 ? 'score-left' : 'score-right';
    }
    return null;
  }

  /** Return angle depends on where the ball hits the paddle; speed rises each hit. */
  private bounce(p: Paddle, dir: 1 | -1, x: number) {
    const b = this.ball;
    const offset = Math.max(-1, Math.min(1, (b.y - p.y) / (PADDLE.h / 2)));
    const angle = offset * MAX_ANGLE;
    const speed = Math.min(MAX_SPEED, this.speed * 1.06 + 8);
    b.vx = Math.cos(angle) * speed * dir;
    b.vy = Math.sin(angle) * speed;
    b.x = x;
  }
}
