import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/data/word-themes';
import { CLUES } from '../../src/data/crossword-clues';
import { WS_SIZES, WordSearchGame, cellsOf, generateWordSearch, lineBetween } from '../../src/engines/puzzles/wordsearch';
import { CW_SIZES, CrosswordGame, generateCrossword } from '../../src/engines/puzzles/crossword';
import { BubbleGame, COLS, LOSE_Y, R, SHOOTER_Y, W } from '../../src/engines/arcade/bubbles';
import { emptyInput } from '../../src/engines/arcade/input';

const dictionary = (n: number) => {
  const raw = readFileSync(`public/words/${n}.txt`, 'utf8').trim();
  const set = new Set<string>();
  for (let i = 0; i < raw.length; i += n) set.add(raw.slice(i, i + n));
  return set;
};
const DICT = { 4: dictionary(4), 5: dictionary(5), 6: dictionary(6) } as Record<number, Set<string>>;

describe('Word lists', () => {
  it('theme words are lowercase dictionary words, unique within a theme', () => {
    for (const t of THEMES) {
      expect(new Set(t.words).size).toBe(t.words.length);
      expect(t.words.length).toBeGreaterThanOrEqual(25);
      for (const w of t.words) {
        expect(w).toMatch(/^[a-z]{3,10}$/);
        if (DICT[w.length]) expect(DICT[w.length]!.has(w), `${w} (${t.id})`).toBe(true);
      }
    }
  });

  it('crossword words are dictionary words with a clue, listed once', () => {
    expect(CLUES.length).toBeGreaterThan(250);
    expect(new Set(CLUES.map((c) => c.word)).size).toBe(CLUES.length);
    for (const c of CLUES) {
      expect(c.word).toMatch(/^[a-z]{3,7}$/);
      expect(c.clue.length).toBeGreaterThan(3);
      expect(new RegExp(`\b${c.word}\b`).test(c.clue.toLowerCase()), c.word).toBe(false);
      if (DICT[c.word.length]) expect(DICT[c.word.length]!.has(c.word), c.word).toBe(true);
    }
  });
});

describe('Word Search', () => {
  it('hides every listed word in the grid, for every size and theme', () => {
    for (const size of WS_SIZES)
      for (const t of THEMES) {
        const p = generateWordSearch(size, t.id, 'x');
        expect(p.grid).toHaveLength(size);
        expect(p.grid.every((row) => row.length === size && row.every((ch) => /^[a-z]$/.test(ch)))).toBe(true);
        for (const w of p.words) {
          const text = cellsOf(w, w.word.length)
            .map(([r, c]) => p.grid[r]![c])
            .join('');
          expect(text).toBe(w.word);
        }
        expect(new Set(p.words.map((w) => w.word)).size).toBe(p.words.length);
      }
  });

  it('is deterministic and the small grid only runs forwards', () => {
    expect(generateWordSearch(12, 'food', 's')).toEqual(generateWordSearch(12, 'food', 's'));
    const small = generateWordSearch(10, 'animals', 's');
    expect(small.words.every((w) => w.dc >= 0 && !(w.dr < 0 && w.dc === 0))).toBe(true);
  });

  it('finds words by dragging either way, and only straight lines count', () => {
    const g = new WordSearchGame(12, 'ocean', 'drag');
    const [a, b] = g.puzzle.words;
    const end = (w: typeof a) => [w!.r + w!.dr * (w!.word.length - 1), w!.c + w!.dc * (w!.word.length - 1)] as [number, number];
    expect(g.select([a!.r, a!.c], end(a))).toBe(a!.word);
    expect(g.select([a!.r, a!.c], end(a))).toBeNull();
    expect(g.select(end(b), [b!.r, b!.c])).toBe(b!.word);
    expect(lineBetween([0, 0], [2, 3])).toBeNull();
    expect(lineBetween([0, 0], [3, 3])).toHaveLength(4);
    expect(g.found.size).toBe(2);
    const h = g.hint()!;
    expect(g.found.has(h.word)).toBe(false);
  });
});

describe('Mini Crossword', () => {
  it('builds connected grids where every run of letters is a clued word', () => {
    for (const size of CW_SIZES)
      for (let s = 0; s < 12; s++) {
        const p = generateCrossword(size, String(s));
        expect(p.entries.length).toBeGreaterThanOrEqual(size === 5 ? 4 : 6);
        // Every horizontal and vertical run of 2+ letters is an entry.
        const runs: string[] = [];
        for (let r = 0; r < size; r++) {
          for (const dir of ['across', 'down'] as const) {
            let run = '';
            let start = 0;
            for (let i = 0; i <= size; i++) {
              const ch = i < size ? (dir === 'across' ? p.grid[r]![i] : p.grid[i]![r]) : null;
              if (ch) {
                if (!run) start = i;
                run += ch;
              } else {
                if (run.length > 1) runs.push(`${dir}:${dir === 'across' ? r : start},${dir === 'across' ? start : r}:${run}`);
                run = '';
              }
            }
          }
        }
        const entries = p.entries.map((e) => `${e.dir}:${e.r},${e.c}:${e.word}`);
        expect(runs.sort()).toEqual(entries.sort());
        // All words connect into one grid.
        const cells = new Set<string>();
        p.grid.forEach((row, r) => row.forEach((ch, c) => ch && cells.add(`${r},${c}`)));
        const seen = new Set<string>([[...cells][0]!]);
        const stack = [[...cells][0]!];
        while (stack.length) {
          const [r, c] = stack.pop()!.split(',').map(Number);
          for (const k of [`${r! + 1},${c}`, `${r! - 1},${c}`, `${r},${c! + 1}`, `${r},${c! - 1}`])
            if (cells.has(k) && !seen.has(k)) {
              seen.add(k);
              stack.push(k);
            }
        }
        expect(seen.size).toBe(cells.size);
      }
  });

  it('numbers entries in reading order and is deterministic', () => {
    const p = generateCrossword(7, 'daily300');
    expect(generateCrossword(7, 'daily300')).toEqual(p);
    for (const e of p.entries) expect(p.numbers[e.r]![e.c]).toBe(e.num);
    const nums = [...new Set(p.entries.map((e) => e.num))].sort((a, b) => a - b);
    expect(nums).toEqual(nums.map((_, i) => i + 1));
  });

  it('checks, reveals and detects a solved grid', () => {
    const g = new CrosswordGame(5, 'play');
    const e = g.puzzle.entries[0]!;
    const cells = g.cellsOf(e);
    g.set(cells[0]![0], cells[0]![1], 'q');
    expect(g.check()).toBe(e.word[0] === 'q' ? 0 : 1);
    g.reveal(cells[0]![0], cells[0]![1]);
    expect(g.letters[cells[0]![0]]![cells[0]![1]]).toBe(e.word[0]);
    g.set(cells[0]![0], cells[0]![1], 'z');
    expect(g.letters[cells[0]![0]]![cells[0]![1]]).toBe(e.word[0]);
    expect(g.entryAt(cells[1]![0], cells[1]![1], e.dir)).toBe(e);
    expect(g.solved).toBe(false);
    g.puzzle.grid.forEach((row, r) => row.forEach((ch, c) => ch && g.set(r, c, ch)));
    expect(g.solved).toBe(true);
  });

  it('generates quickly', () => {
    const t = performance.now();
    for (let s = 0; s < 10; s++) generateCrossword(7, `speed${s}`);
    expect((performance.now() - t) / 10).toBeLessThan(400);
  });
});

describe('Bubble Shooter', () => {
  it('fills the start rows and only uses colours in play', () => {
    const g = new BubbleGame('a');
    expect(g.rows.length).toBe(5);
    expect(g.rows.flat().every((v) => v < g.colorsInPlay())).toBe(true);
    expect(g.rows[1]![COLS - 1]).toBe(-1);
    expect(g.rows.flat().filter((v) => v >= 0)).toContain(g.current);
  });

  it('aims within limits and fires upwards', () => {
    const g = new BubbleGame('b');
    g.aimAt(W, SHOOTER_Y);
    expect(g.angle).toBeCloseTo((80 * Math.PI) / 180);
    g.aimAt(W / 2, 0);
    expect(g.angle).toBe(0);
    expect(g.fire()).toBe(true);
    expect(g.fire()).toBe(false);
    expect(g.shot!.vy).toBeLessThan(0);
  });

  it('pops three of a colour and drops what hangs below', () => {
    const g = new BubbleGame('c');
    g.rows = [
      [0, 0, -1, -1, -1, -1, -1, -1, 3, -1, -1],
      [1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    ];
    // Row 1 is shifted; (1,0) hangs from (0,0) and (0,1).
    g.rows.push([2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]);
    g.rows[1]![0] = 0;
    const p = g.center(0, 2);
    const ev = g.stick(p.x, p.y, 0);
    expect(ev).toContain('pop');
    expect(ev).toContain('drop');
    expect(g.score).toBe(4 * 10 + 20);
  });

  it('a miss counts towards a new row, which pushes the board down', () => {
    const g = new BubbleGame('d');
    const rows = g.rows.length;
    g.misses = g.missLimit() - 1;
    const free = g.center(rows + 1, 3);
    g.rows.push(new Array(COLS).fill(-1));
    g.rows[rows]![3] = 1;
    g.rows[rows]![4] = 2;
    const ev = g.stick(free.x, free.y, 3);
    expect(ev).toContain('row');
    expect(g.rows.length).toBeGreaterThan(rows);
    expect(g.misses).toBe(0);
  });

  it('a shot bounces off the wall and sticks to the cluster', () => {
    const g = new BubbleGame('e');
    g.angle = -1.2;
    g.fire();
    let events: string[] = [];
    for (let i = 0; i < 200 && g.shot; i++) events = g.step(1 / 60, emptyInput());
    expect(g.shot).toBeNull();
    expect(events).toContain('stick');
  });

  it('touch aiming fires when the finger lifts', () => {
    const g = new BubbleGame('f');
    g.step(0.016, { ...emptyInput(), pointer: { x: 100, y: 100 }, hover: false });
    expect(g.shot).toBeNull();
    g.step(0.016, emptyInput());
    expect(g.shot).not.toBeNull();
  });

  it('clearing the board starts the next level; reaching the line ends the game', () => {
    const g = new BubbleGame('g');
    g.rows = [[1, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1]];
    const p = g.center(0, 2);
    expect(g.stick(p.x, p.y, 1)).toContain('level');
    expect(g.level).toBe(2);
    const h = new BubbleGame('h');
    while (h.lowest() <= LOSE_Y - R) h.rows.push(new Array(COLS).fill(0).map((_, c) => (c % 2 ? 1 : 2)));
    h.misses = h.missLimit() - 1;
    const q = h.center(h.rows.length, 5);
    h.stick(q.x, q.y, 4);
    expect(h.over).toBe(true);
  });
});
