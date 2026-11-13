import { describe, expect, it } from 'vitest';
import { emptyInput, swipeOf, type Action, type Input } from '../../src/engines/arcade/input';
import { COLS, MAZE, MazeGame, ROWS, reachable } from '../../src/engines/arcade/maze';
import { InvadersGame, PLAYER_Y } from '../../src/engines/arcade/invaders';
import { ROCK_R, RocksGame } from '../../src/engines/arcade/rocks';
import { BAYS, HopperGame, LANES, TIME_LIMIT } from '../../src/engines/arcade/hopper';
import { FlappyGame, GROUND, medalFor } from '../../src/engines/arcade/flappy';
import { OceanGame, START_R } from '../../src/engines/arcade/ocean';

const input = (over: Partial<Input> = {}): Input => ({ ...emptyInput(), ...over });
const press = (...a: Action[]) => input({ pressed: new Set(a), held: new Set(a) });
const hold = (...a: Action[]) => input({ held: new Set(a) });
const run = (g: { step: (dt: number, i: Input) => string[]; over: boolean }, seconds: number, inp: Input | (() => Input) = input()) => {
  const ev: string[] = [];
  for (let i = 0; i < Math.round(seconds * 60) && !g.over; i++) ev.push(...g.step(1 / 60, typeof inp === 'function' ? inp() : inp));
  return ev;
};

describe('shared input', () => {
  it('turns drags into swipes and short touches into taps', () => {
    expect(swipeOf(0, 0, 60, 10)).toBe('right');
    expect(swipeOf(0, 0, -5, -80)).toBe('up');
    expect(swipeOf(0, 0, 6, 4)).toBeNull();
  });
});

describe('Maze Chomper', () => {
  it('has a rectangular maze whose every pellet can be reached', () => {
    expect(MAZE.every((r) => r.length === COLS)).toBe(true);
    const open = reachable();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if ('.o'.includes(MAZE[y]![x]!)) expect(open.has(y * COLS + x)).toBe(true);
    expect(new MazeGame('x').power.size).toBe(4);
  });

  it('eats pellets as the Chomper moves and never walks through walls', () => {
    const g = new MazeGame('eat');
    g.wisps.forEach((w) => (w.state = 'pen'));
    g.wisps.forEach((w) => (w.wait = 999));
    const left = g.pelletsLeft;
    run(g, 3, hold('left'));
    expect(g.pelletsLeft).toBeLessThan(left);
    expect(g.score).toBeGreaterThan(0);
    const p = g.playerPos();
    expect(MAZE[Math.round(p.y)]![Math.round(p.x)]).not.toBe('#');
  });

  it('reverses at once mid-corridor', () => {
    const g = new MazeGame('rev');
    g.pause = 0;
    g.step(1 / 60, hold('left'));
    g.step(1 / 20, hold('left'));
    const before = g.playerPos().x;
    g.step(1 / 60, press('right'));
    expect(g.playerPos().dir.x).toBe(1);
    expect(g.playerPos().x).toBeGreaterThan(before - 0.2);
  });

  it('gives each Wisp its own target', () => {
    const g = new MazeGame('targets');
    g.pause = 0;
    run(g, 7);
    const [dash, scout] = g.wisps;
    const p = g.player;
    expect(g.target(dash!)).toEqual({ x: p.tx, y: p.ty });
    expect(g.target(scout!)).not.toEqual({ x: p.tx, y: p.ty });
  });

  it('power orbs frighten the Wisps; catching them doubles the points', () => {
    const g = new MazeGame('power');
    g.pause = 0;
    const orb = [...g.power][0]!;
    g.player = { tx: orb % COLS, ty: Math.floor(orb / COLS), t: 0, dir: { x: 0, y: 0 } };
    const ev = g.step(1 / 60, input());
    expect(ev).toContain('power');
    expect(g.frightened).toBeGreaterThan(5);
    const w = g.wisps[0]!;
    w.state = 'active';
    w.tx = g.player.tx;
    w.ty = g.player.ty;
    w.t = 0;
    const before = g.score;
    g.step(1 / 60, input());
    expect(w.state).toBe('eaten');
    expect(g.score - before).toBe(200);
  });

  it('a Wisp catches a Chomper that stands still, and the game ends after three lives', () => {
    const g = new MazeGame('caught');
    run(g, 240, input());
    expect(g.lives).toBe(0);
    expect(g.over).toBe(true);
  });

  it('clearing every pellet starts the next level', () => {
    const g = new MazeGame('clear');
    g.pause = 0;
    g.pellets.clear();
    g.power.clear();
    const ev = g.step(1 / 60, input());
    expect(ev).toContain('level');
    expect(g.level).toBe(2);
    expect(g.pelletsLeft).toBe(g.totalPellets);
  });
});

describe('Alien Invaders', () => {
  it('fires one shot at a time and scores by row', () => {
    const g = new InvadersGame('shoot');
    g.step(1 / 60, press('fire'));
    expect(g.shot).not.toBeNull();
    const first = g.shot;
    g.step(1 / 60, press('fire'));
    expect(g.shot).toBe(first);
    // Line up under the bottom-left alien and fire until it falls.
    const target = g.aliens.find((a) => a.row === 4 && a.col === 0)!;
    g.playerX = g.alienX(target) + 10;
    run(g, 1.5, () => (g.shot ? input() : press('fire')));
    expect(g.score).toBeGreaterThanOrEqual(10);
  });

  it('marches faster as the fleet shrinks and steps down at the edges', () => {
    const g = new InvadersGame('march');
    const full = g.stepInterval();
    g.aliens.slice(0, 40).forEach((a) => (a.alive = false));
    expect(g.stepInterval()).toBeLessThan(full);
    const y0 = g.oy;
    run(g, 6, input());
    expect(g.oy).toBeGreaterThan(y0);
  });

  it('shields crumble where they are hit', () => {
    const g = new InvadersGame('shield');
    const s = g.shields[0]!;
    const before = s.cells.reduce((a, b) => a + b, 0);
    expect(g.erode(s.x + 24, 380, 3)).toBe(true);
    expect(s.cells.reduce((a, b) => a + b, 0)).toBeLessThan(before);
  });

  it('follows a finger and fires while it is held', () => {
    const g = new InvadersGame('touch');
    run(g, 1, input({ pointer: { x: 60, y: 400 } }));
    expect(g.playerX).toBeLessThan(80);
    expect(g.shot).not.toBeNull();
  });

  it('ends when the fleet reaches the cannon, and a cleared fleet brings a new wave', () => {
    const g = new InvadersGame('land');
    g.oy = PLAYER_Y;
    run(g, 2, input());
    expect(g.over).toBe(true);
    const h = new InvadersGame('wave');
    h.aliens.forEach((a) => (a.alive = false));
    expect(h.step(1 / 60, input())).toContain('wave');
    expect(h.wave).toBe(2);
    expect(h.alive).toHaveLength(45);
  });
});

describe('Space Rocks', () => {
  it('thrusts with inertia and wraps around the edges', () => {
    const g = new RocksGame('fly');
    g.rocks = [];
    g.ship.angle = 0;
    run(g, 1, hold('up'));
    const v = g.ship.vx;
    expect(v).toBeGreaterThan(100);
    run(g, 0.5, input());
    expect(g.ship.vx).toBeGreaterThan(0);
    expect(g.ship.vx).toBeLessThan(v);
    g.ship.x = 479;
    g.ship.vx = 200;
    g.step(1 / 30, input());
    expect(g.ship.x).toBeLessThan(20);
  });

  it('splits a large rock into two medium ones and scores it', () => {
    const g = new RocksGame('split');
    g.rocks = [g.makeRock(300, 240, 3)];
    g.rocks[0]!.vx = 0;
    g.rocks[0]!.vy = 0;
    g.ship.angle = 0;
    run(g, 0.6, () => press('fire'));
    expect(g.score).toBeGreaterThanOrEqual(20);
    expect(g.rocks.some((r) => r.size === 2)).toBe(true);
  });

  it('loses a life on contact, then protects the ship with a shield', () => {
    const g = new RocksGame('crash');
    g.shield = 0;
    g.rocks = [g.makeRock(g.ship.x, g.ship.y, 3)];
    expect(g.step(1 / 60, input())).toContain('die');
    expect(g.lives).toBe(2);
    run(g, 1.6, input());
    expect(g.shield).toBeGreaterThan(0);
  });

  it('jumps to hyperspace with a cooldown', () => {
    const g = new RocksGame('hyper');
    const ev = g.step(1 / 60, press('special'));
    expect(ev).toContain('hyper');
    expect(g.step(1 / 60, press('special'))).not.toContain('hyper');
  });

  it('starts each wave with more rocks, away from the ship', () => {
    const g = new RocksGame('wave');
    expect(g.rocks).toHaveLength(4);
    for (const r of g.rocks) expect(Math.hypot(r.x - g.ship.x, r.y - g.ship.y)).toBeGreaterThan(150 - ROCK_R[3]!);
    g.rocks = [];
    g.step(1 / 60, input());
    expect(g.wave).toBe(2);
    expect(g.rocks).toHaveLength(5);
  });
});

describe('River Hopper', () => {
  const safeHop = (g: HopperGame, a: Action) => {
    g.step(1 / 60, press(a));
    run(g, 0.2, input());
  };

  it('hops one tile per press and scores forward progress', () => {
    const g = new HopperGame();
    safeHop(g, 'up');
    expect(g.y).toBe(11);
    expect(g.score).toBe(10);
    safeHop(g, 'down');
    expect(g.y).toBe(12);
    expect(g.score).toBe(10);
  });

  it('loses a life when a car hits', () => {
    const g = new HopperGame();
    g.y = 8;
    const lane = LANES.find((l) => l.row === 8)!;
    g.x = Math.round(g.objectsIn(lane)[0]! + 0.0);
    g.x = Math.min(12, Math.max(0, g.x));
    const ev = run(g, 2, input());
    expect(ev.some((e) => e === 'crash')).toBe(true);
    expect(g.lives).toBe(2);
  });

  it('falls in the water off a log, and rides the log when on one', () => {
    const g = new HopperGame();
    g.y = 3;
    const lane = LANES.find((l) => l.row === 3)!;
    const log = g.objectsIn(lane).find((x) => x > 0 && x < 8)!;
    g.x = log + 1;
    const x0 = g.x;
    g.step(0.1, input());
    expect(g.lives).toBe(3);
    expect(g.x).toBeGreaterThan(x0);
    const h = new HopperGame();
    h.y = 1;
    const l1 = LANES.find((l) => l.row === 1)!;
    const starts = h.objectsIn(l1);
    let gapX = 0;
    for (let x = 0; x < 13; x++) if (starts.every((s) => x + 0.5 < s || x + 0.5 > s + l1.length)) gapX = x;
    h.x = gapX;
    expect(h.step(1 / 60, input())).toContain('splash');
  });

  it('fills a burrow, rejects a filled one, and levels up when all five are full', () => {
    const g = new HopperGame();
    g.filled = [false, true, true, true, true];
    g.y = 1;
    g.x = BAYS[0]!;
    g.hop = { fx: BAYS[0]!, fy: 1, tx: BAYS[0]!, ty: 0, t: 0 };
    const ev = run(g, 0.3, input());
    expect(ev).toContain('home');
    expect(ev).toContain('level');
    expect(g.level).toBe(2);
    expect(g.filled.every((f) => !f)).toBe(true);
    const h = new HopperGame();
    h.filled[0] = true;
    h.hop = { fx: BAYS[0]!, fy: 1, tx: BAYS[0]!, ty: 0, t: 0 };
    run(h, 0.3, input());
    expect(h.lives).toBe(2);
  });

  it('runs out of time', () => {
    const g = new HopperGame();
    run(g, TIME_LIMIT + 0.5, input());
    expect(g.lives).toBe(2);
  });
});

describe('Flappy Wing', () => {
  it('waits for the first flap, then falls under gravity', () => {
    const g = new FlappyGame('wait');
    run(g, 1, input());
    expect(g.waiting).toBe(true);
    expect(g.columns).toHaveLength(0);
    g.step(1 / 60, press('fire'));
    expect(g.waiting).toBe(false);
    expect(g.vy).toBeLessThan(0);
    run(g, 0.6, input());
    expect(g.vy).toBeGreaterThan(0);
  });

  it('crashes into the ground without flapping', () => {
    const g = new FlappyGame('ground');
    g.step(1 / 60, input({ taps: 1 }));
    const ev = run(g, 3, input());
    expect(ev).toContain('hit');
    expect(g.over).toBe(true);
    expect(g.y).toBeLessThanOrEqual(GROUND);
  });

  it('scores a point for each column passed when flying through the gaps', () => {
    const g = new FlappyGame('fly');
    g.step(1 / 60, press('fire'));
    // An autopilot that flaps whenever the bird sinks below the next gap's centre.
    const pilot = () => {
      const next = g.columns.find((c) => c.x + 54 > 60) ?? null;
      const target = next ? next.gapY + 12 : 250;
      return g.y > target && g.vy > -50 ? press('fire') : input();
    };
    run(g, 20, pilot);
    expect(g.over).toBe(false);
    expect(g.score).toBeGreaterThanOrEqual(10);
  });

  it('awards medals at 10, 20, 30 and 40', () => {
    expect(medalFor(9)).toBeNull();
    expect(medalFor(10)).toBe('Bronze');
    expect(medalFor(25)).toBe('Silver');
    expect(medalFor(30)).toBe('Gold');
    expect(medalFor(99)).toBe('Platinum');
  });

  it('narrows the gap as the score climbs', () => {
    const g = new FlappyGame('gap');
    const wide = g.gapSize();
    g.score = 50;
    expect(g.gapSize()).toBeLessThan(wide);
    expect(g.gapSize()).toBeGreaterThanOrEqual(104);
  });
});

describe('Ocean Grow', () => {
  it('swims towards the pointer and with the keys', () => {
    const g = new OceanGame('steer');
    g.fish = [];
    run(g, 1, input({ pointer: { x: 40, y: 40 } }));
    expect(g.x).toBeLessThan(150);
    expect(g.y).toBeLessThan(200);
    run(g, 1, hold('right'));
    expect(g.vx).toBeGreaterThan(0);
  });

  it('grows by eating smaller fish', () => {
    const g = new OceanGame('eat');
    g.fish = [{ x: g.x, y: g.y, vx: 0, r: 6, phase: 0, hue: 0 }];
    g.safe = 0;
    const ev = g.step(1 / 60, input());
    expect(ev).toContain('eat');
    expect(g.r).toBeGreaterThan(START_R);
    expect(g.score).toBe(60);
  });

  it('loses a life to a bigger fish, then respawns protected', () => {
    const g = new OceanGame('bite');
    g.safe = 0;
    g.fish = [{ x: g.x, y: g.y, vx: 0, r: 30, phase: 0, hue: 0 }];
    expect(g.step(1 / 60, input())).toContain('die');
    expect(g.lives).toBe(2);
    expect(g.safe).toBeGreaterThan(0);
    expect(g.r).toBe(START_R);
  });

  it('levels up when the growth bar is full', () => {
    const g = new OceanGame('level');
    g.r = g.goal() - 0.5;
    g.fish = [{ x: g.x, y: g.y, vx: 0, r: 10, phase: 0, hue: 0 }];
    const ev = g.step(1 / 60, input());
    expect(ev).toContain('level');
    expect(g.level).toBe(2);
    expect(g.r).toBe(START_R);
  });

  it('keeps spawning a mix of smaller and bigger fish', () => {
    const g = new OceanGame('mix');
    g.safe = 999;
    run(g, 20, input());
    expect(g.fish.some((f) => f.r < g.r)).toBe(true);
    expect(g.fish.some((f) => f.r > g.r)).toBe(true);
  });
});
