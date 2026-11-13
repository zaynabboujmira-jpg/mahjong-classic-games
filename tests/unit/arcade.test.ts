import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engines/core/rng';
import { LIVES, MemoryGame } from '../../src/engines/arcade/memory';
import { BALL, FIELD, MAX_SPEED, PADDLE, PaddleGame, WIN_SCORE, type Level } from '../../src/engines/arcade/paddle';

/** Plays the current sequence back correctly. */
const repeat = (g: MemoryGame) => {
  g.shown();
  let r: string = 'ok';
  for (const p of g.sequence.slice()) r = g.input(p);
  return r;
};
const wrongPad = (g: MemoryGame) => (g.sequence[g.pos]! + 1) % 4;

describe('Color Memory', () => {
  it('starts with one light and adds one per round', () => {
    const g = new MemoryGame('classic', 'a');
    expect(g.sequence).toHaveLength(1);
    expect(g.score).toBe(0);
    for (let round = 1; round <= 10; round++) {
      expect(repeat(g)).toBe('round');
      expect(g.sequence).toHaveLength(round + 1);
      expect(g.score).toBe(round);
    }
    expect(g.sequence.every((p) => p >= 0 && p <= 3)).toBe(true);
  });

  it('ignores presses while the sequence is playing', () => {
    const g = new MemoryGame('strict', 'b');
    expect(g.input(wrongPad(g))).toBe('ok');
    expect(g.lives).toBe(1);
  });

  it('keeps the sequence when a round is cleared (only one new step is appended)', () => {
    const g = new MemoryGame('classic', 'c');
    const before = g.sequence.slice();
    repeat(g);
    expect(g.sequence.slice(0, before.length)).toEqual(before);
  });

  it('classic: a mistake costs a life and replays the same sequence; three mistakes end it', () => {
    const g = new MemoryGame('classic', 'd');
    repeat(g);
    const seq = g.sequence.slice();
    g.shown();
    expect(g.input(wrongPad(g))).toBe('retry');
    expect(g.lives).toBe(LIVES.classic - 1);
    expect(g.status).toBe('showing');
    expect(g.sequence).toEqual(seq);
    g.shown();
    g.input(wrongPad(g));
    g.shown();
    expect(g.input(wrongPad(g))).toBe('over');
    expect(g.status).toBe('over');
  });

  it('strict and speed: the first mistake ends the game', () => {
    for (const mode of ['strict', 'speed'] as const) {
      const g = new MemoryGame(mode, 'e');
      repeat(g);
      g.shown();
      expect(g.input(wrongPad(g))).toBe('over');
      expect(g.score).toBe(1);
    }
  });

  it('speed mode plays back faster every round, never below 170 ms', () => {
    const g = new MemoryGame('speed', 'f');
    const first = g.stepMs();
    for (let i = 0; i < 30; i++) repeat(g);
    expect(g.stepMs()).toBeLessThan(first);
    expect(g.stepMs()).toBeGreaterThanOrEqual(170);
    const c = new MemoryGame('classic', 'f');
    expect(c.stepMs()).toBeGreaterThan(400);
  });

  it('is reproducible from a seed', () => {
    const a = new MemoryGame('classic', 'same');
    const b = new MemoryGame('classic', 'same');
    for (let i = 0; i < 5; i++) {
      repeat(a);
      repeat(b);
    }
    expect(a.sequence).toEqual(b.sequence);
  });
});

/** Runs the game for `seconds` at 60 fps; returns all events. */
function run(g: PaddleGame, seconds: number, each?: () => void) {
  const events: string[] = [];
  for (let i = 0; i < seconds * 60 && !g.over; i++) {
    each?.();
    events.push(...g.step(1 / 60));
  }
  return events;
}

describe('Paddle Ball physics', () => {
  it('serves after a short pause, then the ball moves', () => {
    const g = new PaddleGame('medium', 'serve');
    run(g, 0.5);
    expect(g.speed).toBe(0);
    run(g, 0.5);
    expect(g.speed).toBeGreaterThan(300);
  });

  it('bounces off the top and bottom walls and stays inside the field', () => {
    const g = new PaddleGame(null, 'walls');
    g.serveIn = 0;
    g.ball = { x: 400, y: 20, vx: 0.0001, vy: -500 };
    const e = g.step(1 / 30);
    expect(e).toContain('wall');
    expect(g.ball.vy).toBeGreaterThan(0);
    expect(g.ball.y).toBeGreaterThanOrEqual(BALL / 2);
  });

  it('returns the ball off a paddle, steeper off the edge, and speeds up', () => {
    const g = new PaddleGame(null, 'paddle');
    g.serveIn = 0;
    g.left.y = 250;
    g.ball = { x: PADDLE.inset + PADDLE.w + 20, y: 250, vx: -400, vy: 0 };
    run(g, 0.1);
    expect(g.ball.vx).toBeGreaterThan(0);
    expect(Math.abs(g.ball.vy)).toBeLessThan(1);
    expect(g.speed).toBeGreaterThan(400);

    const h = new PaddleGame(null, 'edge');
    h.serveIn = 0;
    h.left.y = 250;
    h.ball = { x: PADDLE.inset + PADDLE.w + 20, y: 250 + PADDLE.h / 2 - 2, vx: -400, vy: 0 };
    run(h, 0.1);
    expect(h.ball.vx).toBeGreaterThan(0);
    expect(h.ball.vy).toBeGreaterThan(200);
  });

  it('never tunnels through a paddle at top speed', () => {
    const g = new PaddleGame(null, 'fast');
    g.serveIn = 0;
    g.left.y = 250;
    g.ball = { x: 200, y: 250, vx: -MAX_SPEED, vy: 0 };
    const e = run(g, 0.4);
    expect(e).toContain('paddle');
    expect(g.score).toEqual([0, 0]);
  });

  it('scores when the ball passes a paddle, and the game ends at 7', () => {
    const g = new PaddleGame(null, 'score');
    g.serveIn = 0;
    g.left.y = 50;
    g.ball = { x: 100, y: 400, vx: -500, vy: 0 };
    const e = run(g, 1);
    expect(e).toContain('score-right');
    expect(g.score).toEqual([0, 1]);
    g.score = [0, WIN_SCORE - 1];
    g.serveIn = 0;
    g.ball = { x: 100, y: 400, vx: -500, vy: 0 };
    run(g, 1);
    expect(g.over).toBe(true);
    expect(g.score[1]).toBe(WIN_SCORE);
  });

  it('predicts where the ball crosses, through wall bounces', () => {
    // Straight line: no bounce.
    expect(PaddleGame.predictY({ x: 0, y: 250, vx: 100, vy: 0 }, 400)).toBeCloseTo(250);
    // Heads up at 45 degrees and reflects off the top wall.
    const y = PaddleGame.predictY({ x: 0, y: 100, vx: 100, vy: -100 }, 200);
    expect(y).toBeCloseTo(BALL / 2 + (200 - (100 - BALL / 2)));
    for (let k = 0; k < 50; k++) {
      const p = PaddleGame.predictY({ x: 400, y: 250, vx: 300, vy: (k - 25) * 37 }, FIELD.w - 40);
      expect(p).toBeGreaterThanOrEqual(BALL / 2 - 1e-6);
      expect(p).toBeLessThanOrEqual(FIELD.h - BALL / 2 + 1e-6);
    }
  });
});

/** Player 1 is a simple bot that tracks the ball with a capped speed and a random offset. */
function rally(level: Level, seed: string, seconds: number) {
  const g = new PaddleGame(level, seed);
  const rng = createRng(seed + 'p1');
  let aim = 0;
  return run(g, seconds, () => {
    if (g.ball.vx < 0 && Math.abs(g.ball.x - 400) < 5) aim = (rng() - 0.5) * 70;
    g.left.target = g.ball.y + aim;
  }).length >= 0 ? g : g;
}

describe('Paddle Ball computer levels', () => {
  it('Unbeatable never concedes a point', () => {
    for (let s = 0; s < 6; s++) {
      const g = rally('unbeatable', `u${s}`, 120);
      expect(g.score[0]).toBe(0);
    }
  });

  it('Easy concedes points that Unbeatable would not', () => {
    let easyConceded = 0;
    for (let s = 0; s < 6; s++) easyConceded += rally('easy', `e${s}`, 60).score[0];
    expect(easyConceded).toBeGreaterThan(0);
  });

  it('Medium sits between Easy and Unbeatable', () => {
    let easy = 0;
    let medium = 0;
    for (let s = 0; s < 8; s++) {
      easy += rally('easy', `m${s}`, 60).score[0];
      medium += rally('medium', `m${s}`, 60).score[0];
    }
    expect(medium).toBeLessThanOrEqual(easy);
  });
});
