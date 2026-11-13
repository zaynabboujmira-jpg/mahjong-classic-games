import { wrap, type ArcadeEngine, type Input } from './input';

/*
 * River Hopper: hop a little critter across a busy road and a river to the
 * five burrows at the top. Rows (top to bottom): 0 burrows, 1-5 river,
 * 6 safe bank, 7-11 road, 12 start. Positions are in tile units.
 */
export const COLS = 13;
export const ROWS = 13;
export const TILE = 32;
export const BAYS = [1, 3, 6, 9, 11];
export const HOP_TIME = 0.12;
export const TIME_LIMIT = 30;
/** Objects wrap round a loop slightly wider than the screen, so they enter and leave smoothly. */
const LOOP = COLS + 4;

export type LaneKind = 'log' | 'turtle' | 'car' | 'truck';
export interface Lane {
  row: number;
  kind: LaneKind;
  /** Tiles per second (positive = rightwards). */
  speed: number;
  length: number;
  starts: number[];
  /** Turtle groups in this lane dive under every few seconds. */
  dives?: boolean;
}

export const LANES: readonly Lane[] = [
  { row: 1, kind: 'log', speed: 1.3, length: 3, starts: [0, 6, 12] },
  { row: 2, kind: 'turtle', speed: -1.6, length: 2, starts: [1, 6, 11], dives: true },
  { row: 3, kind: 'log', speed: 2.1, length: 5, starts: [0, 9] },
  { row: 4, kind: 'log', speed: 1.0, length: 3, starts: [2, 8, 14] },
  { row: 5, kind: 'turtle', speed: -1.3, length: 3, starts: [0, 6, 12], dives: true },
  { row: 7, kind: 'truck', speed: -1.2, length: 2, starts: [1, 9] },
  { row: 8, kind: 'car', speed: 2.4, length: 1, starts: [0, 6, 11] },
  { row: 9, kind: 'car', speed: -1.7, length: 1, starts: [2, 7, 12] },
  { row: 10, kind: 'car', speed: 1.5, length: 1, starts: [1, 6, 11] },
  { row: 11, kind: 'car', speed: -1.1, length: 1, starts: [3, 9, 15] },
];

export const isRiver = (row: number) => row >= 1 && row <= 5;
export const isRoad = (row: number) => row >= 7 && row <= 11;

export class HopperGame implements ArcadeEngine {
  /** Player position in tiles (x is continuous because logs carry you). */
  x = 6;
  y = 12;
  /** Hop in progress: from → to over HOP_TIME. */
  hop: { fx: number; fy: number; tx: number; ty: number; t: number } | null = null;
  filled: boolean[] = BAYS.map(() => false);
  score = 0;
  lives = 3;
  level = 1;
  over = false;
  time = 0;
  timeLeft = TIME_LIMIT;
  /** Short pause after losing a life or filling a burrow. */
  pause = 0;
  /** Where the last life was lost, for a splash or crash mark. */
  lost: { x: number; y: number; how: 'road' | 'water' | 'time' | 'bank' } | null = null;
  private bestRow = 12;

  hud() {
    return [
      { label: 'Lives', value: String(this.lives) },
      { label: 'Level', value: String(this.level) },
    ];
  }

  private speedScale() {
    return 1 + (this.level - 1) * 0.15;
  }

  /** Left edge (tiles) of every object in a lane at the current time. */
  objectsIn(lane: Lane): number[] {
    return lane.starts.map((s) => wrap(s + lane.speed * this.speedScale() * this.time, LOOP) - 2);
  }

  /** Turtle groups dive for one second in every four (with a warning second before). */
  divePhase(lane: Lane, index: number): 'up' | 'warn' | 'down' {
    if (!lane.dives || index !== 0) return 'up';
    const p = (this.time + lane.row) % 4;
    return p > 3 ? 'down' : p > 2.3 ? 'warn' : 'up';
  }

  private reset() {
    this.x = 6;
    this.y = 12;
    this.hop = null;
    this.timeLeft = TIME_LIMIT;
    this.bestRow = 12;
  }

  private die(how: 'road' | 'water' | 'time' | 'bank', ev: string[]) {
    this.lost = { x: this.x, y: this.y, how };
    this.lives--;
    ev.push(how === 'road' ? 'crash' : how === 'water' ? 'splash' : 'die');
    if (this.lives <= 0) {
      this.over = true;
      ev.push('over');
      return;
    }
    this.pause = 1;
    this.reset();
  }

  step(dt: number, input: Input): string[] {
    const ev: string[] = [];
    if (this.over) return ev;
    this.time += dt;
    if (this.pause > 0) {
      this.pause -= dt;
      return ev;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.die('time', ev);
      return ev;
    }

    // Start a hop: keys, buttons, swipes, or a tap (= forward).
    if (!this.hop) {
      let d: [number, number] | null = null;
      const p = input.pressed;
      if (p.has('up') || input.swipe === 'up' || input.taps > 0) d = [0, -1];
      else if (p.has('down') || input.swipe === 'down') d = [0, 1];
      else if (p.has('left') || input.swipe === 'left') d = [-1, 0];
      else if (p.has('right') || input.swipe === 'right') d = [1, 0];
      if (d) {
        const tx = Math.min(COLS - 1, Math.max(0, Math.round(this.x) + d[0]));
        const ty = Math.min(12, Math.max(0, this.y + d[1]));
        if (tx !== Math.round(this.x) || ty !== this.y) {
          this.hop = { fx: this.x, fy: this.y, tx, ty, t: 0 };
          ev.push('hop');
        }
      }
    }
    if (this.hop) {
      const h = this.hop;
      h.t += dt;
      const k = Math.min(1, h.t / HOP_TIME);
      this.x = h.fx + (h.tx - h.fx) * k;
      this.y = k < 1 ? h.fy : h.ty;
      if (k < 1) return ev;
      this.hop = null;
      this.x = h.tx;
      this.y = h.ty;
      if (this.y < this.bestRow) {
        this.score += 10 * (this.bestRow - this.y);
        this.bestRow = this.y;
      }
      if (this.y === 0) {
        this.landHome(ev);
        return ev;
      }
    }

    // Ride the river, dodge the road.
    if (isRiver(this.y)) {
      const lane = LANES.find((l) => l.row === this.y)!;
      const on = this.objectsIn(lane).findIndex((x0, i) => this.x + 0.5 > x0 + 0.1 && this.x + 0.5 < x0 + lane.length - 0.1 && this.divePhase(lane, i) !== 'down');
      if (on < 0) {
        this.die('water', ev);
        return ev;
      }
      this.x += lane.speed * this.speedScale() * dt;
      if (this.x < -0.4 || this.x > COLS - 0.6) this.die('water', ev);
    } else if (isRoad(this.y)) {
      const lane = LANES.find((l) => l.row === this.y)!;
      if (this.objectsIn(lane).some((x0) => this.x + 0.75 > x0 && this.x + 0.25 < x0 + lane.length)) this.die('road', ev);
    }
    return ev;
  }

  private landHome(ev: string[]) {
    const bay = BAYS.findIndex((b) => Math.abs(b - this.x) < 0.5);
    if (bay < 0 || this.filled[bay]) {
      this.die('bank', ev);
      return;
    }
    this.filled[bay] = true;
    this.score += 50 + 10 * Math.floor(this.timeLeft);
    ev.push('home');
    if (this.filled.every(Boolean)) {
      this.score += 1000;
      this.level++;
      this.filled = BAYS.map(() => false);
      ev.push('level');
    }
    this.pause = 0.6;
    this.reset();
  }
}
