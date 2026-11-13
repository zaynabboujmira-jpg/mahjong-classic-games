import { createRng, shuffleInPlace, type Rng } from '../core/rng';
import { themeById, THEMES } from '../../data/word-themes';

/*
 * Word Search: hide a theme's words in a letter grid (across, down and
 * diagonally; backwards too on the bigger grids), then fill the gaps with
 * random letters. Find a word by dragging from its first letter to its last.
 */
export const WS_SIZES = [10, 12, 15] as const;
export type WsSize = (typeof WS_SIZES)[number];
const WORD_COUNT: Record<WsSize, number> = { 10: 8, 12: 11, 15: 15 };
const FORWARD: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
];
const ALL: [number, number][] = [...FORWARD, [0, -1], [-1, 0], [-1, -1], [1, -1]];
/** Filler letters roughly in English frequency, so the grid looks natural. */
const FILL = 'eeeeeeeeeeeettttttttaaaaaaaaoooooooiiiiiiinnnnnnnsssssshhhhhhrrrrrrddddllllcccuuummwwffggyyppbbvkjxqz';

export interface Placement {
  word: string;
  r: number;
  c: number;
  dr: number;
  dc: number;
}

export interface WordSearch {
  size: WsSize;
  theme: string;
  seed: string;
  grid: string[][];
  words: Placement[];
}

export function cellsOf(p: { r: number; c: number; dr: number; dc: number }, length: number): [number, number][] {
  return Array.from({ length }, (_, i) => [p.r + p.dr * i, p.c + p.dc * i] as [number, number]);
}

function tryPlace(grid: (string | null)[][], word: string, rng: Rng, dirs: [number, number][]): Placement | null {
  const n = grid.length;
  const options: Placement[] = [];
  for (const [dr, dc] of dirs)
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const er = r + dr * (word.length - 1);
        const ec = c + dc * (word.length - 1);
        if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
        let overlap = 0;
        let ok = true;
        for (let i = 0; i < word.length && ok; i++) {
          const ch = grid[r + dr * i]![c + dc * i];
          if (ch === null) continue;
          if (ch === word[i]) overlap++;
          else ok = false;
        }
        // Never hide a word entirely inside another one.
        if (ok && overlap < word.length) options.push({ word, r, c, dr, dc, ...{ overlap } } as Placement & { overlap: number });
      }
  if (!options.length) return null;
  // Prefer placements that cross other words, for a denser puzzle.
  const crossing = options.filter((o) => (o as Placement & { overlap: number }).overlap > 0);
  const pool = crossing.length && rng() < 0.6 ? crossing : options;
  const pick = pool[Math.floor(rng() * pool.length)]!;
  return { word: pick.word, r: pick.r, c: pick.c, dr: pick.dr, dc: pick.dc };
}

export function generateWordSearch(size: WsSize, themeId: string, seed: string): WordSearch {
  const theme = themeById(themeId);
  const rng = createRng(`ws:${size}:${theme.id}:${seed}`);
  const dirs = size === 10 ? FORWARD : ALL;
  for (let attempt = 0; attempt < 50; attempt++) {
    const grid: (string | null)[][] = Array.from({ length: size }, () => new Array<string | null>(size).fill(null));
    const pool = shuffleInPlace(
      theme.words.filter((w) => w.length <= size),
      rng,
    )
      .slice(0, WORD_COUNT[size] + 4)
      .sort((a, b) => b.length - a.length);
    const words: Placement[] = [];
    for (const w of pool) {
      if (words.length >= WORD_COUNT[size]) break;
      const p = tryPlace(grid, w, rng, dirs);
      if (!p) continue;
      cellsOf(p, w.length).forEach(([r, c], i) => (grid[r]![c] = w[i]!));
      words.push(p);
    }
    if (words.length < WORD_COUNT[size]) continue;
    const full = grid.map((row) => row.map((ch) => ch ?? FILL[Math.floor(rng() * FILL.length)]!));
    words.sort((a, b) => a.word.localeCompare(b.word));
    return { size, theme: theme.id, seed, grid: full, words };
  }
  throw new Error(`Could not build a ${size}×${size} word search for ${theme.id}`);
}

/** The letters along a straight line between two cells, or null if the cells are not in line. */
export function lineBetween(a: [number, number], b: [number, number]): [number, number][] | null {
  const dr = Math.sign(b[0] - a[0]);
  const dc = Math.sign(b[1] - a[1]);
  const lr = Math.abs(b[0] - a[0]);
  const lc = Math.abs(b[1] - a[1]);
  if (lr && lc && lr !== lc) return null;
  return cellsOf({ r: a[0], c: a[1], dr, dc }, Math.max(lr, lc) + 1);
}

export class WordSearchGame {
  readonly puzzle: WordSearch;
  found = new Set<string>();
  /** Lines found, for drawing. */
  lines: { word: string; cells: [number, number][] }[] = [];
  hints = 0;

  constructor(size: WsSize = 10, themeId = THEMES[0]!.id, seed = '1') {
    this.puzzle = generateWordSearch(size, themeId, seed);
  }

  get done() {
    return this.found.size === this.puzzle.words.length;
  }

  /** Checks a drag from cell a to cell b; returns the word found, or null. */
  select(a: [number, number], b: [number, number]): string | null {
    const cells = lineBetween(a, b);
    if (!cells || cells.length < 2) return null;
    const text = cells.map(([r, c]) => this.puzzle.grid[r]![c]).join('');
    const back = [...text].reverse().join('');
    const hit = this.puzzle.words.find((w) => !this.found.has(w.word) && (w.word === text || w.word === back));
    if (!hit) return null;
    this.found.add(hit.word);
    this.lines.push({ word: hit.word, cells });
    return hit.word;
  }

  /** A hint: the first cell of a word not found yet. */
  hint(): { word: string; cell: [number, number] } | null {
    const w = this.puzzle.words.find((x) => !this.found.has(x.word));
    if (!w) return null;
    this.hints++;
    return { word: w.word, cell: [w.r, w.c] };
  }
}
