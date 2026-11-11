import { createRng, shuffleInPlace, type Rng } from '../core/rng';

export const LEVEL_IDS = ['beginner', 'intermediate', 'expert'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export interface Level {
  id: LevelId;
  name: string;
  width: number;
  height: number;
  mines: number;
}

/** The three classic sizes. Expert is 30 wide by 16 tall. */
export const LEVELS: Record<LevelId, Level> = {
  beginner: { id: 'beginner', name: 'Beginner', width: 9, height: 9, mines: 10 },
  intermediate: { id: 'intermediate', name: 'Intermediate', width: 16, height: 16, mines: 40 },
  expert: { id: 'expert', name: 'Expert', width: 30, height: 16, mines: 99 },
};

/** Cell states stored in Minesweeper.state. */
export const Cell = { Hidden: 0, Revealed: 1, Flagged: 2 } as const;

export type Status = 'ready' | 'playing' | 'won' | 'lost';

/**
 * Classic Minesweeper. Mines are placed on the first reveal, never on the
 * clicked cell or its neighbours, so the first click always opens an area.
 * Placement is deterministic for a given seed and first click.
 */
export class Minesweeper {
  readonly width: number;
  readonly height: number;
  readonly mineCount: number;
  readonly size: number;
  /** 1 where there is a mine (all 0 until the first reveal). */
  readonly mines: Uint8Array;
  /** Number of neighbouring mines. */
  readonly counts: Uint8Array;
  readonly state: Uint8Array;
  readonly neighbors: readonly (readonly number[])[];
  status: Status = 'ready';
  /** The mine that was clicked, when lost. */
  exploded = -1;
  revealed = 0;
  flags = 0;
  private rng: Rng;

  constructor(level: Pick<Level, 'width' | 'height' | 'mines'>, seed: string | Rng) {
    this.width = level.width;
    this.height = level.height;
    this.size = level.width * level.height;
    this.mineCount = Math.min(level.mines, this.size - 1);
    this.mines = new Uint8Array(this.size);
    this.counts = new Uint8Array(this.size);
    this.state = new Uint8Array(this.size);
    this.rng = typeof seed === 'string' ? createRng(`mines:${seed}`) : seed;
    this.neighbors = Array.from({ length: this.size }, (_, i) => {
      const x = i % this.width;
      const y = Math.floor(i / this.width);
      const out: number[] = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < this.width && ny < this.height) out.push(ny * this.width + nx);
        }
      return out;
    });
  }

  get minesLeft() {
    return this.mineCount - this.flags;
  }
  get isOver() {
    return this.status === 'won' || this.status === 'lost';
  }

  /**
   * Places mines away from `safe`. Its neighbours are kept clear too when the
   * board has room, so the first click is a zero and opens an area.
   */
  private plant(safe: number): void {
    const keepClear = new Set([safe, ...this.neighbors[safe]!]);
    if (this.size - keepClear.size < this.mineCount) keepClear.clear(), keepClear.add(safe);
    const spots: number[] = [];
    for (let i = 0; i < this.size; i++) if (!keepClear.has(i)) spots.push(i);
    shuffleInPlace(spots, this.rng);
    for (let k = 0; k < this.mineCount; k++) this.mines[spots[k]!] = 1;
    for (let i = 0; i < this.size; i++) {
      let n = 0;
      for (const j of this.neighbors[i]!) n += this.mines[j]!;
      this.counts[i] = n;
    }
    this.status = 'playing';
  }

  /** Test helper: start from a fixed mine layout. */
  static fromMines(width: number, height: number, mineCells: readonly number[]): Minesweeper {
    const g = new Minesweeper({ width, height, mines: mineCells.length }, 'fixed');
    for (const m of mineCells) g.mines[m] = 1;
    for (let i = 0; i < g.size; i++) {
      let n = 0;
      for (const j of g.neighbors[i]!) n += g.mines[j]!;
      g.counts[i] = n;
    }
    g.status = 'playing';
    return g;
  }

  /** Opens a cell (flood-filling zeros). Returns the cells that changed. */
  reveal(i: number): number[] {
    if (this.isOver || this.state[i] !== Cell.Hidden) return [];
    if (this.status === 'ready') this.plant(i);
    if (this.mines[i]) {
      this.state[i] = Cell.Revealed;
      this.exploded = i;
      this.status = 'lost';
      return [i];
    }
    const opened: number[] = [];
    const stack = [i];
    while (stack.length) {
      const c = stack.pop()!;
      if (this.state[c] !== Cell.Hidden) continue;
      this.state[c] = Cell.Revealed;
      this.revealed++;
      opened.push(c);
      if (this.counts[c] === 0) for (const n of this.neighbors[c]!) if (this.state[n] === Cell.Hidden && !this.mines[n]) stack.push(n);
    }
    this.checkWin();
    return opened;
  }

  /** Places or removes a flag on a hidden cell. */
  toggleFlag(i: number): boolean {
    if (this.isOver) return false;
    if (this.state[i] === Cell.Hidden) {
      this.state[i] = Cell.Flagged;
      this.flags++;
      return true;
    }
    if (this.state[i] === Cell.Flagged) {
      this.state[i] = Cell.Hidden;
      this.flags--;
      return true;
    }
    return false;
  }

  /** Flags around a revealed number. */
  flagsAround = (i: number) => this.neighbors[i]!.reduce((n, j) => n + (this.state[j] === Cell.Flagged ? 1 : 0), 0);

  /** True when chording this cell would open something. */
  canChord(i: number): boolean {
    return (
      !this.isOver &&
      this.state[i] === Cell.Revealed &&
      this.counts[i]! > 0 &&
      this.flagsAround(i) === this.counts[i] &&
      this.neighbors[i]!.some((j) => this.state[j] === Cell.Hidden)
    );
  }

  /**
   * Chord: on a revealed number whose flags all are placed, opens every
   * other neighbour at once. A wrong flag means a mine is opened: game over.
   */
  chord(i: number): number[] {
    if (!this.canChord(i)) return [];
    const opened: number[] = [];
    for (const j of this.neighbors[i]!) {
      if (this.state[j] !== Cell.Hidden) continue;
      opened.push(...this.reveal(j));
      if (this.status === 'lost') {
        // reveal() already recorded the exploded cell.
        break;
      }
    }
    return opened;
  }

  private checkWin() {
    if (this.revealed !== this.size - this.mineCount) return;
    this.status = 'won';
    for (let i = 0; i < this.size; i++) {
      if (this.mines[i] && this.state[i] !== Cell.Flagged) {
        this.state[i] = Cell.Flagged;
        this.flags++;
      }
    }
  }
}
