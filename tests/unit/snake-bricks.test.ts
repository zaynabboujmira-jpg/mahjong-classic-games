import { describe, expect, it } from 'vitest';
import { emptyInput, type Input } from '../../src/engines/arcade/input';
import { GRID, SnakeGame } from '../../src/engines/arcade/snake';
import { BALL_R, BRICK_H, BricksGame, LEVELS, PADDLE_Y, W } from '../../src/engines/arcade/bricks';

const press = (...dirs: ('up' | 'down' | 'left' | 'right' | 'fire')[]): Input => ({ ...emptyInput(), pressed: new Set(dirs) });

describe('Snake', () => {
  it('starts with three segments moving right, food on a free cell', () => {
    const g = new SnakeGame('a');
    expect(g.body).toHaveLength(3);
    expect(g.body.some((p) => p.x === g.food.x && p.y === g.food.y)).toBe(false);
    const head = { ...g.body[0]! };
    g.advance();
    expect(g.body[0]).toEqual({ x: head.x + 1, y: head.y });
    expect(g.body).toHaveLength(3);
  });

  it('ignores reversing and applies queued turns one per step', () => {
    const g = new SnakeGame('a');
    g.turn('left');
    g.advance();
    expect(g.dir).toBe('right');
    g.turn('up');
    g.turn('left');
    g.advance();
    expect(g.dir).toBe('up');
    g.advance();
    expect(g.dir).toBe('left');
  });

  it('grows and scores when it eats', () => {
    const g = new SnakeGame('a');
    const head = g.body[0]!;
    g.food = { x: head.x + 1, y: head.y };
    expect(g.advance()).toEqual(['eat']);
    expect(g.body).toHaveLength(4);
    expect(g.score).toBe(10);
    expect(g.body.some((p) => p.x === g.food.x && p.y === g.food.y)).toBe(false);
  });

  it('crashes into walls in Classic mode and wraps in Wrap mode', () => {
    const classic = new SnakeGame('a', 'classic');
    classic.food = { x: 0, y: 0 };
    let n = 0;
    while (!classic.over && n++ < GRID) classic.advance();
    expect(classic.over).toBe(true);
    expect(classic.body[0]!.x).toBe(GRID - 1);

    const wrap = new SnakeGame('a', 'wrap');
    wrap.food = { x: 0, y: 0 };
    for (let i = 0; i < GRID; i++) wrap.advance();
    expect(wrap.over).toBe(false);
    expect(wrap.body[0]!.x).toBe(6);
  });

  it('crashes into itself', () => {
    const g = new SnakeGame('a', 'wrap');
    g.body = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
    ];
    g.food = { x: 0, y: 0 };
    g.turn('down');
    expect(g.advance()).toEqual(['crash']);
    expect(g.over).toBe(true);
  });

  it('may move into the cell the tail is leaving', () => {
    const g = new SnakeGame('a', 'wrap');
    g.body = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 5 },
    ];
    g.dir = 'up';
    g.food = { x: 0, y: 0 };
    g.turn('right');
    g.advance();
    expect(g.over).toBe(false);
  });

  it('steps at the speed setting and reads swipes', () => {
    const slow = new SnakeGame('a', 'classic', 'easy');
    const fast = new SnakeGame('a', 'classic', 'fast');
    slow.step(0.5, emptyInput());
    fast.step(0.5, emptyInput());
    expect(fast.body[0]!.x - 6).toBeGreaterThan(slow.body[0]!.x - 6);
    const g = new SnakeGame('a');
    g.step(0.01, { ...emptyInput(), swipe: 'down' });
    g.step(0.2, emptyInput());
    expect(g.dir).toBe('down');
    g.step(0.01, press('left'));
    g.step(0.2, emptyInput());
    expect(g.dir).toBe('left');
  });
});

describe('Brick Breaker', () => {
  it('lays out every level inside the court', () => {
    for (let level = 1; level <= LEVELS.length; level++) {
      const g = new BricksGame('l');
      g.level = level;
      g.loadLevel();
      expect(g.bricks.length).toBeGreaterThan(20);
      expect(g.bricks.every((b) => b.x >= 0 && b.x + 34 <= W && b.y + BRICK_H < PADDLE_Y - 100)).toBe(true);
    }
  });

  it('serves from the paddle and launches upwards on fire, tap or after a pause', () => {
    const g = new BricksGame('s');
    expect(g.serving).toBe(true);
    g.step(0.016, emptyInput());
    expect(g.serving).toBe(true);
    g.step(0.016, press('fire'));
    expect(g.serving).toBe(false);
    expect(g.balls[0]!.vy).toBeLessThan(0);
    const t = new BricksGame('t');
    t.step(0.016, { ...emptyInput(), taps: 1 });
    expect(t.serving).toBe(false);
    const idle = new BricksGame('i');
    for (let i = 0; i < 200; i++) idle.step(0.016, emptyInput());
    expect(idle.serving).toBe(false);
  });

  it('the paddle follows the pointer and the keys, inside the court', () => {
    const g = new BricksGame('p');
    g.step(0.016, { ...emptyInput(), pointer: { x: 50, y: 400 } });
    expect(g.paddleX).toBe(50);
    g.step(0.016, { ...emptyInput(), pointer: { x: -100, y: 400 } });
    expect(g.paddleX).toBe(32);
    const held = emptyInput();
    held.held.add('right');
    for (let i = 0; i < 100; i++) g.step(0.05, held);
    expect(g.paddleX).toBe(W - 32);
  });

  it('breaks bricks, scores and bounces back', () => {
    const g = new BricksGame('b');
    g.launch();
    const target = [...g.bricks].reverse().find((b) => b.color !== 'S')!;
    const count = g.bricks.length;
    g.balls = [{ x: target.x + 17, y: target.y + BRICK_H + BALL_R + 4, vx: 0, vy: -300 }];
    for (let i = 0; i < 5; i++) g.step(0.016, emptyInput());
    expect(g.bricks.length).toBe(count - 1);
    expect(g.score).toBe(10);
    expect(g.balls[0]!.vy).toBeGreaterThan(0);
  });

  it('silver bricks take two hits', () => {
    const g = new BricksGame('b');
    g.bricks = [{ x: 100, y: 100, hits: 2, color: 'S' }];
    g.launch();
    g.balls = [{ x: 117, y: 125, vx: 0, vy: -300 }];
    for (let i = 0; i < 5; i++) g.step(0.016, emptyInput());
    expect(g.bricks).toHaveLength(1);
    expect(g.bricks[0]!.hits).toBe(1);
  });

  it('the paddle angle depends on where the ball hits', () => {
    const g = new BricksGame('a');
    g.launch();
    g.paddleX = 180;
    g.balls = [{ x: 205, y: PADDLE_Y - 8, vx: 0, vy: 300 }];
    g.step(0.016, emptyInput());
    expect(g.balls[0]!.vy).toBeLessThan(0);
    expect(g.balls[0]!.vx).toBeGreaterThan(0);
  });

  it('losing the last ball costs a life and serves again; no lives ends the game', () => {
    const g = new BricksGame('l');
    g.launch();
    g.balls = [{ x: 10, y: 470, vx: 0, vy: 300 }];
    g.paddleX = 300;
    g.step(0.1, { ...emptyInput(), pointer: { x: 300, y: 0 } });
    expect(g.lives).toBe(2);
    expect(g.serving).toBe(true);
    g.lives = 1;
    g.launch();
    g.balls = [{ x: 10, y: 470, vx: 0, vy: 300 }];
    g.step(0.1, { ...emptyInput(), pointer: { x: 300, y: 0 } });
    expect(g.over).toBe(true);
  });

  it('power-ups: wider paddle, extra balls, extra life', () => {
    const g = new BricksGame('w');
    g.launch();
    g.apply('wide');
    expect(g.paddleW).toBe(100);
    g.apply('multi');
    expect(g.balls).toHaveLength(2);
    g.apply('life');
    expect(g.lives).toBe(4);
    // A falling power-up is caught by the paddle.
    g.powers = [{ x: g.paddleX, y: PADDLE_Y - 10, kind: 'life' }];
    g.balls = [{ x: 20, y: 200, vx: 0, vy: -10 }];
    g.step(0.1, { ...emptyInput(), pointer: { x: g.paddleX, y: 0 } });
    expect(g.lives).toBe(5);
    expect(g.powers).toHaveLength(0);
  });

  it('clearing the bricks starts the next, faster level', () => {
    const g = new BricksGame('n');
    const speed = g.speed();
    g.launch();
    g.bricks = [];
    g.balls = [{ x: 100, y: 200, vx: 0, vy: -100 }];
    g.step(0.016, emptyInput());
    expect(g.level).toBe(2);
    expect(g.serving).toBe(true);
    expect(g.speed()).toBeGreaterThan(speed);
    expect(g.bricks.length).toBeGreaterThan(0);
  });
});
