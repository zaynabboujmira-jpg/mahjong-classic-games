import { describe, expect, it } from 'vitest';
import { Cell, LEVELS, LEVEL_IDS, Minesweeper } from '../../src/engines/minesweeper/game';
import { cellAtPoint, displayOf, fitMines, indexAt } from '../../src/engines/minesweeper/render';

const mineCount = (g: Minesweeper) => g.mines.reduce((n, m) => n + m, 0);

describe('levels', () => {
  it('match the classic sizes', () => {
    expect(LEVELS.beginner).toMatchObject({ width: 9, height: 9, mines: 10 });
    expect(LEVELS.intermediate).toMatchObject({ width: 16, height: 16, mines: 40 });
    expect(LEVELS.expert).toMatchObject({ width: 30, height: 16, mines: 99 });
  });
});

describe.each(LEVEL_IDS)('%s first click', (id) => {
  const level = LEVELS[id];
  const corners = [0, level.width - 1, level.width * (level.height - 1), level.width * level.height - 1];
  const middle = Math.floor(level.height / 2) * level.width + Math.floor(level.width / 2);

  it('never hits a mine and always opens an area (200 games, corners, edges and middle)', () => {
    for (let k = 0; k < 200; k++) {
      const g = new Minesweeper(level, `s${k}`);
      const click = [...corners, middle, level.width * 3 + 0, 5][k % 7]!;
      const opened = g.reveal(click);
      expect(g.status).toBe('playing');
      expect(mineCount(g)).toBe(level.mines);
      expect(g.mines[click]).toBe(0);
      for (const n of g.neighbors[click]!) expect(g.mines[n]).toBe(0);
      expect(g.counts[click]).toBe(0);
      expect(opened.length).toBeGreaterThan(1);
    }
  });

  it('places mines deterministically for a seed and first click', () => {
    const a = new Minesweeper(level, 'same');
    const b = new Minesweeper(level, 'same');
    a.reveal(middle);
    b.reveal(middle);
    expect([...a.mines]).toEqual([...b.mines]);
    const c = new Minesweeper(level, 'different');
    c.reveal(middle);
    expect([...c.mines]).not.toEqual([...a.mines]);
  });
});

describe('play', () => {
  // 5x5, mines at (4,0) and (4,4):
  // . . . 1 *
  // . . . 1 1
  // . . . . .
  // . . . 1 1
  // . . . 1 *
  const board = () => Minesweeper.fromMines(5, 5, [4, 24]);

  it('counts neighbouring mines', () => {
    const g = board();
    expect(g.counts[3]).toBe(1);
    expect(g.counts[9]).toBe(1);
    expect(g.counts[0]).toBe(0);
    expect(g.counts[18]).toBe(1);
  });

  it('flood-fills zeros and stops at numbers', () => {
    const g = board();
    const opened = g.reveal(0);
    expect(opened).toHaveLength(23);
    expect(opened).not.toContain(4);
    expect(opened).not.toContain(24);
    expect(g.status).toBe('won');
  });

  it('opens only the number itself when a number is clicked', () => {
    const g = board();
    expect(g.reveal(3)).toEqual([3]);
    expect(g.status).toBe('playing');
  });

  it('wins when every safe cell is open and flags the remaining mines', () => {
    const g = board();
    g.reveal(0);
    expect(g.status).toBe('won');
    expect(g.state[4]).toBe(Cell.Flagged);
    expect(g.state[24]).toBe(Cell.Flagged);
    expect(g.minesLeft).toBe(0);
  });

  it('loses on a mine and then ignores further input', () => {
    const g = board();
    g.reveal(4);
    expect(g.status).toBe('lost');
    expect(g.exploded).toBe(4);
    expect(g.reveal(0)).toEqual([]);
    expect(g.toggleFlag(1)).toBe(false);
  });

  it('flags and unflags hidden cells, protecting them from reveals', () => {
    const g = board();
    expect(g.toggleFlag(4)).toBe(true);
    expect(g.minesLeft).toBe(1);
    expect(g.reveal(4)).toEqual([]);
    expect(g.status).toBe('playing');
    expect(g.toggleFlag(4)).toBe(true);
    expect(g.minesLeft).toBe(2);
    g.reveal(3);
    expect(g.toggleFlag(3)).toBe(false);
  });

  it('chords only when the flags around a number match it', () => {
    const g = board();
    g.reveal(3);
    expect(g.canChord(3)).toBe(false);
    expect(g.chord(3)).toEqual([]);
    g.toggleFlag(4);
    expect(g.canChord(3)).toBe(true);
    const opened = g.chord(3);
    expect(opened).toContain(2);
    expect(opened).toContain(9);
    expect(g.state[4]).toBe(Cell.Flagged);
    expect(g.status).not.toBe('lost');
  });

  it('chording with a wrong flag opens the real mine and loses', () => {
    const g = board();
    g.reveal(9); // the 1 below-left of the top mine
    g.toggleFlag(8); // wrong: the mine is at 4
    expect(g.canChord(9)).toBe(true);
    g.chord(9);
    expect(g.status).toBe('lost');
    expect(g.exploded).toBe(4);
  });

  it('keeps the first click safe even on a nearly full board', () => {
    const g = new Minesweeper({ width: 3, height: 3, mines: 8 }, 'full');
    g.reveal(4);
    expect(g.mines[4]).toBe(0);
    expect(mineCount(g)).toBe(8);
    expect(g.status).toBe('won');
  });
});

describe('layout', () => {
  it('turns Expert sideways on a portrait phone and keeps cells tappable', () => {
    const l = fitMines(359, 560, 30, 16, 28);
    expect(l.rotated).toBe(true);
    expect(l.cols).toBe(16);
    expect(l.rows).toBe(30);
    expect(l.cell).toBeGreaterThanOrEqual(28);
  });

  it('keeps Expert straight on a wide screen and fits it without scrolling', () => {
    const l = fitMines(1200, 600, 30, 16, 20);
    expect(l.rotated).toBe(false);
    expect(l.width).toBeLessThanOrEqual(1200);
    expect(l.height).toBeLessThanOrEqual(600);
  });

  it('maps display cells back to board cells in both orientations', () => {
    const game = { width: 30 };
    for (const l of [fitMines(359, 560, 30, 16, 28), fitMines(1200, 600, 30, 16, 20)]) {
      for (const i of [0, 29, 31, 479, 250]) {
        const { col, row } = displayOf(l, game, i);
        expect(indexAt(l, game, col, row)).toBe(i);
        expect(cellAtPoint(l, game, col * l.cell + 1, row * l.cell + 1)).toBe(i);
      }
      expect(cellAtPoint(l, game, -1, 5)).toBe(-1);
      expect(cellAtPoint(l, game, l.width + 1, 5)).toBe(-1);
    }
  });
});
