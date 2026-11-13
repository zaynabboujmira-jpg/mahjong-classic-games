import { createRng, shuffleInPlace, type Rng } from '../core/rng';
import { CLUES } from '../../data/crossword-clues';

/*
 * Mini Crossword: a small criss-cross grid (5×5 or 7×7) built from a list of
 * clued words. Words cross where they share a letter; no two words run side
 * by side, so every run of letters in the grid is a clued word. The same
 * seed always gives the same puzzle (the daily puzzle uses the day number).
 */
export const CW_SIZES = [5, 7] as const;
export type CwSize = (typeof CW_SIZES)[number];
const MIN_WORDS: Record<CwSize, number> = { 5: 5, 7: 8 };
const MAX_WORDS: Record<CwSize, number> = { 5: 7, 7: 12 };

export type Dir = 'across' | 'down';
export interface Entry {
  num: number;
  dir: Dir;
  r: number;
  c: number;
  word: string;
  clue: string;
}
export interface Crossword {
  size: CwSize;
  seed: string;
  /** Solution letters; null for a black square. */
  grid: (string | null)[][];
  entries: Entry[];
  /** Clue number shown in each cell, or 0. */
  numbers: number[][];
}

interface Placed {
  word: string;
  clue: string;
  r: number;
  c: number;
  dir: Dir;
}

const step = (dir: Dir): [number, number] => (dir === 'across' ? [0, 1] : [1, 0]);

function fits(grid: (string | null)[][], used: Set<string>, word: string, r: number, c: number, dir: Dir): number {
  const n = grid.length;
  const [dr, dc] = step(dir);
  const er = r + dr * (word.length - 1);
  const ec = c + dc * (word.length - 1);
  if (r < 0 || c < 0 || er >= n || ec >= n) return -1;
  // The cells just before and after the word must be empty.
  if (grid[r - dr]?.[c - dc]) return -1;
  if (grid[er + dr]?.[ec + dc]) return -1;
  let crossings = 0;
  for (let i = 0; i < word.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    const ch = grid[rr]![cc];
    if (ch) {
      if (ch !== word[i] || used.has(`${rr},${cc},${dir}`)) return -1;
      crossings++;
    } else {
      // A new letter may not touch another word side by side.
      if (grid[rr + dc]?.[cc + dr] || grid[rr - dc]?.[cc - dr]) return -1;
    }
  }
  return crossings;
}

function build(size: CwSize, rng: Rng): Placed[] {
  const grid: (string | null)[][] = Array.from({ length: size }, () => new Array<string | null>(size).fill(null));
  const used = new Set<string>();
  const pool = shuffleInPlace(
    CLUES.filter((c) => c.word.length >= 3 && c.word.length <= size),
    rng,
  );
  const placed: Placed[] = [];
  const put = (p: Placed) => {
    const [dr, dc] = step(p.dir);
    for (let i = 0; i < p.word.length; i++) {
      grid[p.r + dr * i]![p.c + dc * i] = p.word[i]!;
      used.add(`${p.r + dr * i},${p.c + dc * i},${p.dir}`);
    }
    placed.push(p);
  };
  // A long first word across the top half.
  const first = pool.find((w) => w.word.length >= size - 1)!;
  put({ ...first, r: Math.floor(rng() * Math.ceil(size / 2)), c: Math.floor(rng() * (size - first.word.length + 1)), dir: 'across' });
  for (let round = 0; round < 40 && placed.length < MAX_WORDS[size]; round++) {
    let best: Placed | null = null;
    let bestScore = -1;
    for (const cand of pool) {
      if (placed.some((p) => p.word === cand.word)) continue;
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
          for (const dir of ['across', 'down'] as const) {
            const x = fits(grid, used, cand.word, r, c, dir);
            if (x <= 0) continue;
            const score = x * 10 + cand.word.length + rng() * 3;
            if (score > bestScore) {
              bestScore = score;
              best = { ...cand, r, c, dir };
            }
          }
      if (bestScore > 30) break;
    }
    if (!best) break;
    put(best);
  }
  return placed;
}

export function generateCrossword(size: CwSize, seed: string): Crossword {
  const rng = createRng(`cw:${size}:${seed}`);
  let placed: Placed[] = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    const p = build(size, rng);
    const cells = (q: Placed[]) => new Set(q.flatMap((w) => [...w.word].map((_, i) => `${w.r + step(w.dir)[0]! * i},${w.c + step(w.dir)[1]! * i}`))).size;
    if (p.length > placed.length || (p.length === placed.length && cells(p) > cells(placed))) placed = p;
    if (placed.length >= MIN_WORDS[size] && cells(placed) >= size * size * 0.5) break;
  }
  const grid: (string | null)[][] = Array.from({ length: size }, () => new Array<string | null>(size).fill(null));
  for (const p of placed) {
    const [dr, dc] = step(p.dir);
    for (let i = 0; i < p.word.length; i++) grid[p.r + dr * i]![p.c + dc * i] = p.word[i]!;
  }
  // Number the starts in reading order.
  const numbers = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  let n = 0;
  const entries: Entry[] = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const here = placed.filter((p) => p.r === r && p.c === c);
      if (!here.length) continue;
      numbers[r]![c] = ++n;
      for (const p of here) entries.push({ num: n, dir: p.dir, r, c, word: p.word, clue: p.clue });
    }
  entries.sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === 'across' ? -1 : 1));
  return { size, seed, grid, entries, numbers };
}

export class CrosswordGame {
  readonly puzzle: Crossword;
  /** Player's letters ('' for empty). */
  letters: string[][];
  /** Cells marked wrong by Check, and cells filled by Reveal. */
  wrong = new Set<string>();
  revealed = new Set<string>();

  constructor(size: CwSize = 5, seed = '1') {
    this.puzzle = generateCrossword(size, seed);
    this.letters = this.puzzle.grid.map((row) => row.map(() => ''));
  }

  get size() {
    return this.puzzle.size;
  }

  isOpen(r: number, c: number) {
    return !!this.puzzle.grid[r]?.[c];
  }

  /** The entry through a cell in a direction (falling back to the other direction). */
  entryAt(r: number, c: number, dir: Dir): Entry | null {
    const find = (d: Dir) =>
      this.puzzle.entries.find((e) => {
        if (e.dir !== d) return false;
        const [dr, dc] = step(d);
        for (let i = 0; i < e.word.length; i++) if (e.r + dr * i === r && e.c + dc * i === c) return true;
        return false;
      }) ?? null;
    return find(dir) ?? find(dir === 'across' ? 'down' : 'across');
  }

  cellsOf(e: Entry): [number, number][] {
    const [dr, dc] = step(e.dir);
    return Array.from({ length: e.word.length }, (_, i) => [e.r + dr! * i, e.c + dc! * i] as [number, number]);
  }

  set(r: number, c: number, ch: string) {
    if (!this.isOpen(r, c) || this.revealed.has(`${r},${c}`)) return;
    this.letters[r]![c] = ch.toLowerCase();
    this.wrong.delete(`${r},${c}`);
  }

  /** Marks every filled cell that is wrong; returns how many. */
  check(): number {
    this.wrong.clear();
    this.puzzle.grid.forEach((row, r) =>
      row.forEach((ch, c) => {
        const v = this.letters[r]![c];
        if (ch && v && v !== ch) this.wrong.add(`${r},${c}`);
      }),
    );
    return this.wrong.size;
  }

  reveal(r: number, c: number) {
    const ch = this.puzzle.grid[r]?.[c];
    if (!ch) return;
    this.letters[r]![c] = ch;
    this.revealed.add(`${r},${c}`);
    this.wrong.delete(`${r},${c}`);
  }

  get solved(): boolean {
    return this.puzzle.grid.every((row, r) => row.every((ch, c) => !ch || this.letters[r]![c] === ch));
  }
}
