import type { Rng } from '../core/rng';

/*
 * Tic Tac Toe (3×3, three in a row) and Five in a Row (15×15, five or more
 * in a row, also known as Gomoku). X moves first. The 3×3 computer uses a
 * full minimax search (it never loses on Hard); the 15×15 computer scores
 * every empty cell by the lines it builds and the lines it blocks.
 */
export type Mark = 0 | 1 | 2;
export const X = 1;
export const O = 2;

export class Grid {
  readonly size: number;
  readonly need: number;
  cells: Mark[];
  turn: 1 | 2 = X;
  moves: number[] = [];
  winner: Mark = 0;
  line: number[] | null = null;

  constructor(size = 3, need = size === 3 ? 3 : 5) {
    this.size = size;
    this.need = need;
    this.cells = new Array<Mark>(size * size).fill(0);
  }

  get full() {
    return this.moves.length === this.cells.length;
  }
  get over() {
    return this.winner !== 0 || this.full;
  }

  play(i: number): boolean {
    if (this.over || this.cells[i] !== 0 || i < 0 || i >= this.cells.length) return false;
    this.cells[i] = this.turn;
    this.moves.push(i);
    const line = this.lineThrough(i);
    if (line) {
      this.winner = this.turn;
      this.line = line;
    }
    this.turn = this.turn === X ? O : X;
    return true;
  }

  undo(): boolean {
    const i = this.moves.pop();
    if (i === undefined) return false;
    this.cells[i] = 0;
    this.turn = this.turn === X ? O : X;
    this.winner = 0;
    this.line = null;
    return true;
  }

  /** The winning run through cell i, if the mark there completes one. */
  lineThrough(i: number): number[] | null {
    const n = this.size;
    const m = this.cells[i];
    if (!m) return null;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ] as const) {
      const run = [i];
      for (const s of [1, -1]) {
        let rr = r + dr * s;
        let cc = c + dc * s;
        while (rr >= 0 && cc >= 0 && rr < n && cc < n && this.cells[rr * n + cc] === m) {
          run.push(rr * n + cc);
          rr += dr * s;
          cc += dc * s;
        }
      }
      if (run.length >= this.need) return run.sort((a, b) => a - b);
    }
    return null;
  }
}

// ----- 3×3: minimax -----

function minimax(g: Grid, me: Mark, depth: number): number {
  if (g.winner) return g.winner === me ? 10 - depth : depth - 10;
  if (g.full) return 0;
  let best = g.turn === me ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (g.cells[i]) continue;
    g.play(i);
    const v = minimax(g, me, depth + 1);
    g.undo();
    best = g.turn === me ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}

export type TttLevel = 'easy' | 'medium' | 'hard';

export function bestTicTacToe(g: Grid, level: TttLevel, rng: Rng = Math.random): number {
  const free = g.cells.flatMap((v, i) => (v ? [] : [i]));
  const me = g.turn;
  // Every level takes a win that is there.
  for (const i of free) {
    g.play(i);
    const won = g.winner === me;
    g.undo();
    if (won) return i;
  }
  const random = level === 'easy' ? 0.7 : level === 'medium' ? 0.3 : 0;
  if (rng() < random) return free[Math.floor(rng() * free.length)]!;
  let best = free[0]!;
  let bestV = -Infinity;
  for (const i of free) {
    g.play(i);
    const v = minimax(g, me, 1) + rng() * 0.01;
    g.undo();
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  }
  return best;
}

// ----- 15×15: threat scoring -----

/** Points for my stones in a five-cell window after playing there, and for blocking theirs. */
const ATTACK = [0, 1, 12, 120, 6000, 1_000_000];
const DEFEND = [0, 1, 10, 180, 120_000];

/**
 * Scores a cell by every five-cell window through it: windows with only my
 * stones grow my lines; windows with only theirs are blocked by playing here.
 * Gapped shapes count too, and an open line appears in more windows.
 */
function windowScore(g: Grid, i: number, me: Mark): { attack: number; defend: number } {
  const n = g.size;
  const r = Math.floor(i / n);
  const c = i % n;
  let attack = 0;
  let defend = 0;
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const) {
    for (let start = -4; start <= 0; start++) {
      let mine = 0;
      let theirs = 0;
      let ok = true;
      for (let k = 0; k < 5; k++) {
        const rr = r + dr * (start + k);
        const cc = c + dc * (start + k);
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) {
          ok = false;
          break;
        }
        const v = g.cells[rr * n + cc];
        if (v === me) mine++;
        else if (v) theirs++;
      }
      if (!ok) continue;
      if (!theirs) attack += ATTACK[mine + 1]!;
      if (!mine) defend += DEFEND[theirs]!;
    }
  }
  return { attack, defend };
}

export function bestGomoku(g: Grid, level: 'easy' | 'hard', rng: Rng = Math.random): number {
  const n = g.size;
  if (!g.moves.length) return Math.floor(n / 2) * n + Math.floor(n / 2);
  const me = g.turn;
  let best = -1;
  let bestV = -Infinity;
  for (let i = 0; i < g.cells.length; i++) {
    if (g.cells[i]) continue;
    // Only cells near existing stones.
    const r = Math.floor(i / n);
    const c = i % n;
    let near = false;
    for (let dr = -2; dr <= 2 && !near; dr++)
      for (let dc = -2; dc <= 2 && !near; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < n && cc < n && g.cells[rr * n + cc]) near = true;
      }
    if (!near) continue;
    const { attack, defend } = windowScore(g, i, me);
    // Easy still completes five and stops a four, but otherwise plays loosely.
    const v = level === 'easy' ? (attack >= ATTACK[5]! ? attack : attack * 0.3) + (defend >= DEFEND[4]! ? defend : defend * 0.2) + rng() * 400 : attack + defend + rng();
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  }
  return best;
}
