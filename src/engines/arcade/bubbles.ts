import { createRng, type Rng } from '../core/rng';
import { clamp, type ArcadeEngine, type Input } from './input';

/*
 * Bubble Shooter: aim and fire coloured bubbles at the cluster above. A shot
 * bounces off the side walls and sticks where it touches. Three or more of
 * one colour connected pop, and any bubbles left hanging with no link to the
 * ceiling drop for bonus points. Every few shots that pop nothing, a new row
 * pushes the cluster down; if it reaches the line, the game is over. Clear
 * the board to reach the next level.
 */
export const W = 352;
export const H = 540;
export const R = 16;
export const COLS = 11;
export const ROW_H = R * Math.sqrt(3);
export const SHOOTER_Y = H - 46;
export const LOSE_Y = SHOOTER_Y - 2 * R - 6;
const SPEED = 760;
const MAX_ANGLE = (80 * Math.PI) / 180;
export const PALETTE = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
}
export interface Falling {
  x: number;
  y: number;
  vy: number;
  color: number;
  popping: boolean;
  t: number;
}

export class BubbleGame implements ArcadeEngine {
  /** rows[0] is the top row; -1 is empty. */
  rows: number[][] = [];
  /** Whether row 0 is shifted right by half a bubble (alternates as rows are added). */
  shiftTop = false;
  angle = 0;
  current: number;
  next: number;
  shot: Shot | null = null;
  falling: Falling[] = [];
  score = 0;
  level = 1;
  over = false;
  misses = 0;
  shots = 0;
  private rng: Rng;
  private aiming = false;

  constructor(seed = 'bubbles', level = 1) {
    this.rng = createRng(`bubbles:${seed}`);
    this.level = level;
    this.setup();
    this.current = this.pick();
    this.next = this.pick();
  }

  colorsInPlay() {
    return Math.min(PALETTE.length, 3 + Math.floor((this.level + 1) / 2));
  }
  /** Shots that pop nothing before a new row drops in. */
  missLimit() {
    return Math.max(3, 7 - Math.floor(this.level / 2));
  }

  hud() {
    return [
      { label: 'Level', value: String(this.level) },
      { label: 'Row in', value: String(this.missLimit() - this.misses) },
    ];
  }
  summary() {
    return `Reached level ${this.level}.`;
  }

  private setup() {
    const rows = Math.min(9, 4 + this.level);
    this.rows = [];
    this.shiftTop = false;
    for (let r = 0; r < rows; r++) this.rows.push(this.randomRow(r));
    this.misses = 0;
  }

  private randomRow(r: number) {
    const n = this.colsIn(r);
    const out = new Array<number>(COLS).fill(-1);
    for (let c = 0; c < n; c++) {
      // Runs of the same colour make the board readable and fair.
      const prev = c > 0 ? out[c - 1]! : -1;
      out[c] = prev >= 0 && this.rng() < 0.45 ? prev : Math.floor(this.rng() * this.colorsInPlay());
    }
    return out;
  }

  isShifted(r: number) {
    return (r % 2 === 1) !== this.shiftTop;
  }
  colsIn(r: number) {
    return this.isShifted(r) ? COLS - 1 : COLS;
  }
  center(r: number, c: number) {
    return { x: R + c * 2 * R + (this.isShifted(r) ? R : 0), y: R + r * ROW_H };
  }

  neighbours(r: number, c: number): [number, number][] {
    const s = this.isShifted(r);
    const d = s
      ? [
          [0, -1],
          [0, 1],
          [-1, 0],
          [-1, 1],
          [1, 0],
          [1, 1],
        ]
      : [
          [0, -1],
          [0, 1],
          [-1, -1],
          [-1, 0],
          [1, -1],
          [1, 0],
        ];
    return d.map(([dr, dc]) => [r + dr!, c + dc!] as [number, number]).filter(([rr, cc]) => rr >= 0 && cc >= 0 && cc < this.colsIn(rr));
  }

  get(r: number, c: number) {
    return this.rows[r]?.[c] ?? -1;
  }

  /** Picks a colour still on the board (any colour once it is empty). */
  private pick(): number {
    const live = [...new Set(this.rows.flat().filter((v) => v >= 0))];
    if (!live.length) return Math.floor(this.rng() * this.colorsInPlay());
    return live[Math.floor(this.rng() * live.length)]!;
  }

  swap() {
    if (this.shot) return;
    [this.current, this.next] = [this.next, this.current];
  }

  fire() {
    if (this.shot || this.over) return false;
    this.shot = { x: W / 2, y: SHOOTER_Y, vx: Math.sin(this.angle) * SPEED, vy: -Math.cos(this.angle) * SPEED, color: this.current };
    this.current = this.next;
    this.next = this.pick();
    this.shots++;
    return true;
  }

  /** Aims at a point in game units. */
  aimAt(x: number, y: number) {
    const dy = Math.min(-10, y - SHOOTER_Y);
    this.angle = clamp(Math.atan2(x - W / 2, -dy), -MAX_ANGLE, MAX_ANGLE);
  }

  /** Grid cell nearest to a point. */
  cellAt(x: number, y: number): [number, number] {
    const r = Math.max(0, Math.round((y - R) / ROW_H));
    const off = this.isShifted(r) ? R : 0;
    const c = clamp(Math.round((x - R - off) / (2 * R)), 0, this.colsIn(r) - 1);
    return [r, c];
  }

  /** Sticks a bubble at the nearest free cell; returns event names. */
  stick(x: number, y: number, color: number): string[] {
    let [r, c] = this.cellAt(x, y);
    if (this.get(r, c) >= 0) {
      // Occupied: take the closest free neighbour.
      const free = this.neighbours(r, c).filter(([rr, cc]) => this.get(rr, cc) < 0);
      free.sort((a, b) => {
        const pa = this.center(a[0], a[1]);
        const pb = this.center(b[0], b[1]);
        return Math.hypot(pa.x - x, pa.y - y) - Math.hypot(pb.x - x, pb.y - y);
      });
      if (!free.length) return [];
      [r, c] = free[0]!;
    }
    while (this.rows.length <= r) this.rows.push(new Array<number>(COLS).fill(-1));
    this.rows[r]![c] = color;
    const ev: string[] = ['stick'];
    const group = this.flood(r, c, (v) => v === color);
    if (group.length >= 3) {
      for (const [gr, gc] of group) this.remove(gr, gc, true);
      this.score += group.length * 10;
      ev.push('pop');
      const dropped = this.dropFloating();
      if (dropped) {
        this.score += dropped * 20 * Math.min(4, Math.ceil(dropped / 3));
        ev.push('drop');
      }
      this.misses = 0;
    } else {
      this.misses++;
      if (this.misses >= this.missLimit()) {
        this.addRow();
        ev.push('row');
      }
    }
    this.trim();
    if (this.rows.every((row) => row.every((v) => v < 0))) {
      this.score += 500 + this.level * 100;
      this.level++;
      this.setup();
      this.current = this.pick();
      this.next = this.pick();
      ev.push('level');
    } else if (this.lowest() > LOSE_Y) {
      this.over = true;
      ev.push('lose');
    }
    return ev;
  }

  private remove(r: number, c: number, popping: boolean) {
    const p = this.center(r, c);
    this.falling.push({ x: p.x, y: p.y, vy: popping ? 0 : -60, color: this.rows[r]![c]!, popping, t: 0 });
    this.rows[r]![c] = -1;
  }

  flood(r: number, c: number, match: (v: number) => boolean): [number, number][] {
    const seen = new Set<string>([`${r},${c}`]);
    const out: [number, number][] = [];
    const stack: [number, number][] = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      out.push([cr, cc]);
      for (const [nr, nc] of this.neighbours(cr, cc)) {
        const k = `${nr},${nc}`;
        if (seen.has(k) || !match(this.get(nr, nc))) continue;
        seen.add(k);
        stack.push([nr, nc]);
      }
    }
    return out;
  }

  /** Drops every bubble not connected to the top row; returns how many. */
  dropFloating(): number {
    const anchored = new Set<string>();
    for (let c = 0; c < this.colsIn(0); c++) {
      if (this.get(0, c) < 0 || anchored.has(`0,${c}`)) continue;
      for (const [r, cc] of this.flood(0, c, (v) => v >= 0)) anchored.add(`${r},${cc}`);
    }
    let n = 0;
    this.rows.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v >= 0 && !anchored.has(`${r},${c}`)) {
          this.remove(r, c, false);
          n++;
        }
      }),
    );
    return n;
  }

  addRow() {
    this.shiftTop = !this.shiftTop;
    this.rows.unshift(new Array<number>(COLS).fill(-1));
    this.rows[0] = this.randomRow(0);
    // Rows keep their bubbles; a shifted row has one fewer slot.
    this.rows.forEach((row, r) => {
      if (this.isShifted(r)) row[COLS - 1] = -1;
    });
    this.misses = 0;
  }

  private trim() {
    while (this.rows.length && this.rows[this.rows.length - 1]!.every((v) => v < 0)) this.rows.pop();
  }

  /** Lowest bubble edge on the board. */
  lowest() {
    let y = 0;
    this.rows.forEach((row, r) => row.forEach((v, c) => v >= 0 && (y = Math.max(y, this.center(r, c).y + R))));
    return y;
  }

  /** Moves the shot; returns events when it sticks. */
  private moveShot(dt: number): string[] {
    const s = this.shot!;
    const steps = Math.max(1, Math.ceil((SPEED * dt) / (R / 2)));
    for (let i = 0; i < steps; i++) {
      s.x += (s.vx * dt) / steps;
      s.y += (s.vy * dt) / steps;
      if (s.x < R) {
        s.x = R;
        s.vx = Math.abs(s.vx);
      } else if (s.x > W - R) {
        s.x = W - R;
        s.vx = -Math.abs(s.vx);
      }
      let hit = s.y <= R;
      if (!hit) {
        const near = this.cellAt(s.x, s.y);
        for (let r = Math.max(0, near[0] - 1); r <= near[0] + 1 && !hit; r++)
          for (let c = 0; c < this.colsIn(r) && !hit; c++) {
            if (this.get(r, c) < 0) continue;
            const p = this.center(r, c);
            if (Math.hypot(p.x - s.x, p.y - s.y) < 2 * R * 0.86) hit = true;
          }
      }
      if (hit) {
        this.shot = null;
        return this.stick(s.x, Math.max(R, s.y), s.color);
      }
    }
    return [];
  }

  step(dt: number, input: Input): string[] {
    const ev: string[] = [];
    for (const f of this.falling) {
      f.t += dt;
      if (!f.popping) {
        f.vy += 1400 * dt;
        f.y += f.vy * dt;
      }
    }
    this.falling = this.falling.filter((f) => (f.popping ? f.t < 0.18 : f.y < H + R));
    if (this.over) return ev;
    // Aim: keys turn the launcher; a finger or the mouse points it.
    if (input.held.has('left')) this.angle = Math.max(-MAX_ANGLE, this.angle - 1.8 * dt);
    if (input.held.has('right')) this.angle = Math.min(MAX_ANGLE, this.angle + 1.8 * dt);
    if (input.pointer) this.aimAt(input.pointer.x, input.pointer.y);
    let fire = input.pressed.has('fire') || input.pressed.has('up') || input.taps > 0;
    // A touch drag aims; lifting the finger fires.
    if (input.pointer && !input.hover) this.aiming = true;
    else if (this.aiming && !input.pointer) {
      this.aiming = false;
      fire = true;
    } else if (input.hover) this.aiming = false;
    if (input.pressed.has('special') || input.pressed.has('down')) this.swap();
    if (fire && this.fire()) ev.push('fire');
    if (this.shot) ev.push(...this.moveShot(dt));
    return ev;
  }
}
