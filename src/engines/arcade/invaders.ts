import { createRng, type Rng } from '../core/rng';
import { clamp, type ArcadeEngine, type Input } from './input';

/*
 * Alien Invaders: a fixed shooter with original alien designs. A formation
 * marches side to side and steps down at each edge, speeding up as it thins
 * out. Four shields crumble pixel by pixel; a bonus saucer crosses the top.
 */
export const W = 360;
export const H = 480;
export const PLAYER_Y = 440;
const PLAYER_W = 26;
const COLS = 9;
const ROWS = 5;
const CELL_W = 30;
const CELL_H = 26;
export const ALIEN_W = 20;
export const ALIEN_H = 14;
/** Shield bitmaps: 24 × 16 cells of 2 px each. */
export const SHIELD_COLS = 24;
export const SHIELD_ROWS = 16;
export const SHIELD_CELL = 2;
export const SHIELD_Y = 372;
const ROW_POINTS = [30, 20, 20, 10, 10];
const SAUCER_POINTS = [50, 100, 150, 300];

export interface Alien {
  col: number;
  row: number;
  alive: boolean;
}
export interface Shot {
  x: number;
  y: number;
  vy: number;
}
export interface Shield {
  x: number;
  cells: Uint8Array;
}

function shieldShape(): Uint8Array {
  const cells = new Uint8Array(SHIELD_COLS * SHIELD_ROWS);
  for (let r = 0; r < SHIELD_ROWS; r++)
    for (let c = 0; c < SHIELD_COLS; c++) {
      const corner = r < 4 && (c < 4 - r || c >= SHIELD_COLS - (4 - r));
      const arch = r >= 10 && c >= 7 && c < SHIELD_COLS - 7;
      cells[r * SHIELD_COLS + c] = corner || arch ? 0 : 1;
    }
  return cells;
}

export class InvadersGame implements ArcadeEngine {
  playerX = W / 2;
  aliens: Alien[] = [];
  /** Formation offset: left edge and top of row 0. */
  ox = 30;
  oy = 70;
  private dir = 1;
  private stepTimer = 0;
  private stepIndex = 0;
  shot: Shot | null = null;
  bombs: Shot[] = [];
  shields: Shield[] = [];
  saucer: { x: number; vx: number } | null = null;
  private saucerTimer = 18;
  private bombTimer = 1.5;
  score = 0;
  lives = 3;
  wave = 1;
  over = false;
  /** Seconds of invulnerability after being hit. */
  hit = 0;
  private rng: Rng;

  constructor(seed: string | Rng = 'invaders') {
    this.rng = typeof seed === 'string' ? createRng(`invaders:${seed}`) : seed;
    this.newWave();
  }

  private newWave() {
    this.aliens = [];
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) this.aliens.push({ col, row, alive: true });
    this.ox = 30;
    this.oy = 70 + Math.min(64, (this.wave - 1) * 10);
    this.dir = 1;
    this.bombs = [];
    this.shot = null;
    if (this.wave === 1 || this.wave % 3 === 1) this.shields = [0, 1, 2, 3].map((i) => ({ x: 34 + i * 82, cells: shieldShape() }));
  }

  hud() {
    return [
      { label: 'Lives', value: String(this.lives) },
      { label: 'Wave', value: String(this.wave) },
    ];
  }

  get alive() {
    return this.aliens.filter((a) => a.alive);
  }
  alienX = (a: Alien) => this.ox + a.col * CELL_W;
  alienY = (a: Alien) => this.oy + a.row * CELL_H;

  /** Seconds between formation steps: faster with fewer aliens and later waves. */
  stepInterval() {
    const left = this.alive.length / (ROWS * COLS);
    return Math.max(0.04, (0.05 + 0.55 * left) * Math.pow(0.9, this.wave - 1));
  }

  step(dt: number, input: Input): string[] {
    const ev: string[] = [];
    if (this.over) return ev;
    if (this.hit > 0) this.hit -= dt;

    // Move: buttons or keys, or follow a finger / mouse.
    const speed = 190;
    let dx = (input.held.has('right') ? 1 : 0) - (input.held.has('left') ? 1 : 0);
    if (!dx && input.pointer && !input.hover) dx = clamp((input.pointer.x - this.playerX) / 12, -1, 1);
    this.playerX = clamp(this.playerX + dx * speed * dt, PLAYER_W / 2 + 4, W - PLAYER_W / 2 - 4);
    const wantsFire = input.pressed.has('fire') || input.held.has('fire') || input.held.has('up') || input.taps > 0 || (!!input.pointer && !input.hover);
    if (wantsFire && !this.shot && this.hit <= 0) {
      this.shot = { x: this.playerX, y: PLAYER_Y - 10, vy: -430 };
      ev.push('shoot');
    }

    // March.
    this.stepTimer -= dt;
    if (this.stepTimer <= 0) {
      this.stepTimer = this.stepInterval();
      const alive = this.alive;
      const minX = Math.min(...alive.map(this.alienX));
      const maxX = Math.max(...alive.map(this.alienX)) + ALIEN_W;
      if ((this.dir > 0 && maxX + 8 > W - 6) || (this.dir < 0 && minX - 8 < 6)) {
        this.dir = -this.dir;
        this.oy += 12;
      } else this.ox += 8 * this.dir;
      ev.push(`march${this.stepIndex++ % 4}`);
      const lowest = Math.max(...alive.map((a) => this.alienY(a) + ALIEN_H));
      if (lowest >= PLAYER_Y - 8) {
        this.over = true;
        ev.push('over');
        return ev;
      }
      // Aliens that reach a shield wipe it out where they touch.
      for (const a of alive) this.erode(this.alienX(a) + ALIEN_W / 2, this.alienY(a) + ALIEN_H / 2, 12);
    }

    // Player shot.
    if (this.shot) {
      this.shot.y += this.shot.vy * dt;
      if (this.shot.y < 0) this.shot = null;
      else if (this.erode(this.shot.x, this.shot.y, 3)) this.shot = null;
      else {
        for (const a of this.alive) {
          const x = this.alienX(a);
          const y = this.alienY(a);
          if (this.shot.x >= x && this.shot.x <= x + ALIEN_W && this.shot.y >= y && this.shot.y <= y + ALIEN_H) {
            a.alive = false;
            this.score += ROW_POINTS[a.row]!;
            this.shot = null;
            ev.push('alien');
            break;
          }
        }
        if (this.shot && this.saucer && Math.abs(this.shot.x - this.saucer.x) < 16 && this.shot.y < 52 && this.shot.y > 30) {
          this.score += SAUCER_POINTS[Math.floor(this.rng() * SAUCER_POINTS.length)]!;
          this.saucer = null;
          this.shot = null;
          ev.push('saucer-hit');
        }
      }
    }

    // Alien bombs.
    this.bombTimer -= dt;
    if (this.bombTimer <= 0 && this.bombs.length < 2 + Math.min(3, Math.floor(this.wave / 2))) {
      this.bombTimer = (0.5 + this.rng() * 0.9) / (1 + (this.wave - 1) * 0.15);
      const bottoms = new Map<number, Alien>();
      for (const a of this.alive) if (!bottoms.has(a.col) || bottoms.get(a.col)!.row < a.row) bottoms.set(a.col, a);
      const list = [...bottoms.values()];
      if (list.length) {
        // Usually from the column above the player, sometimes random.
        const near = list.reduce((b, a) => (Math.abs(this.alienX(a) - this.playerX) < Math.abs(this.alienX(b) - this.playerX) ? a : b));
        const a = this.rng() < 0.45 ? near : list[Math.floor(this.rng() * list.length)]!;
        this.bombs.push({ x: this.alienX(a) + ALIEN_W / 2, y: this.alienY(a) + ALIEN_H, vy: 170 + this.wave * 12 });
      }
    }
    for (const b of this.bombs) b.y += b.vy * dt;
    this.bombs = this.bombs.filter((b) => {
      if (b.y > H) return false;
      if (this.erode(b.x, b.y, 3)) return false;
      if (this.shot && Math.abs(this.shot.x - b.x) < 4 && Math.abs(this.shot.y - b.y) < 8) {
        this.shot = null;
        return false;
      }
      if (this.hit <= 0 && Math.abs(b.x - this.playerX) < PLAYER_W / 2 && b.y > PLAYER_Y - 8 && b.y < PLAYER_Y + 10) {
        this.lives--;
        this.hit = 1.5;
        ev.push('player');
        if (this.lives <= 0) {
          this.over = true;
          ev.push('over');
        }
        return false;
      }
      return true;
    });

    // Bonus saucer.
    this.saucerTimer -= dt;
    if (!this.saucer && this.saucerTimer <= 0) {
      const fromLeft = this.rng() < 0.5;
      this.saucer = { x: fromLeft ? -20 : W + 20, vx: fromLeft ? 80 : -80 };
      this.saucerTimer = 20 + this.rng() * 10;
      ev.push('saucer');
    }
    if (this.saucer) {
      this.saucer.x += this.saucer.vx * dt;
      if (this.saucer.x < -30 || this.saucer.x > W + 30) this.saucer = null;
    }

    if (!this.over && this.alive.length === 0) {
      this.wave++;
      this.newWave();
      ev.push('wave');
    }
    return ev;
  }

  /** Erases shield cells within `r` px of a point; true if anything was there. */
  erode(x: number, y: number, r: number): boolean {
    let hit = false;
    for (const s of this.shields) {
      const cx = Math.floor((x - s.x) / SHIELD_CELL);
      const cy = Math.floor((y - SHIELD_Y) / SHIELD_CELL);
      const rc = Math.ceil(r / SHIELD_CELL);
      if (cx < -rc || cx >= SHIELD_COLS + rc || cy < -rc || cy >= SHIELD_ROWS + rc) continue;
      const centre = cx >= 0 && cx < SHIELD_COLS && cy >= 0 && cy < SHIELD_ROWS && s.cells[cy * SHIELD_COLS + cx];
      if (!centre && r < 6) continue;
      for (let yy = cy - rc; yy <= cy + rc; yy++)
        for (let xx = cx - rc; xx <= cx + rc; xx++) {
          if (xx < 0 || yy < 0 || xx >= SHIELD_COLS || yy >= SHIELD_ROWS) continue;
          if ((xx - cx) ** 2 + (yy - cy) ** 2 > rc * rc) continue;
          if (s.cells[yy * SHIELD_COLS + xx]) {
            // Ragged edges: not every cell in the blast goes.
            if (r < 6 && (xx - cx) ** 2 + (yy - cy) ** 2 === rc * rc && this.rng() < 0.5) continue;
            s.cells[yy * SHIELD_COLS + xx] = 0;
            hit = true;
          }
        }
    }
    return hit;
  }
}
