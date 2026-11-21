import { describe, expect, it } from 'vitest';
import { ACTIVE, GRID_CELLS, GRIDS_OF, SIZE, SamuraiGame, UNITS, generateSamurai, gridLevels, type SamuraiLevel } from '../../src/engines/sudoku/samurai';
import { countSolutions } from '../../src/engines/sudoku/solver';

describe('samurai geometry', () => {
  it('has five grids covering 369 cells, with four shared boxes', () => {
    expect(ACTIVE.filter(Boolean)).toHaveLength(369);
    expect(GRIDS_OF.filter((g) => g.length === 2)).toHaveLength(36);
    expect(UNITS).toHaveLength(135);
  });
});

describe('samurai generator', () => {
  for (const level of ['easy', 'medium', 'hard'] as SamuraiLevel[]) {
    it(`${level}: a valid solution, givens from it, and every grid unique and logic-solvable`, () => {
      const t = performance.now();
      const p = generateSamurai(level, 'test-' + level);
      for (const s of ['a', 'b', 'c']) expect(Math.max(...gridLevels(generateSamurai(level, s).givens).map((l) => l.level))).toBe({ easy: 1, medium: 2, hard: 3 }[level]);
      const ms = performance.now() - t;
      for (const u of UNITS) expect(new Set(u.map((c) => p.solution[c])).size).toBe(9);
      for (let c = 0; c < SIZE; c++) {
        if (!ACTIVE[c]) expect(p.solution[c]).toBe(0);
        if (p.givens[c]) expect(p.givens[c]).toBe(p.solution[c]);
      }
      for (const cells of GRID_CELLS) expect(countSolutions(cells.map((c) => p.givens[c]!))).toBe(1);
      const levels = gridLevels(p.givens);
      expect(levels.every((l) => l.solved)).toBe(true);
      const max = { easy: 1, medium: 2, hard: 3 }[level];
      expect(Math.max(...levels.map((l) => l.level))).toBeLessThanOrEqual(max);
      expect(Math.max(...levels.map((l) => l.level))).toBe(max);
      const clues = p.givens.filter(Boolean).length;
      console.log(level, Math.round(ms) + 'ms', clues, 'clues', levels.map((l) => l.level).join(','));
      expect(ms).toBeLessThan(20_000);
    });
  }
  it('is deterministic', () => {
    expect(generateSamurai('easy', 'x').givens).toEqual(generateSamurai('easy', 'x').givens);
  });
});

describe('samurai game', () => {
  const p = generateSamurai('medium', 'game');
  it('hints solve the whole puzzle with correct digits', () => {
    const g = new SamuraiGame(p.givens, p.solution);
    for (let n = 0; n < 400 && !g.isWon; n++) {
      const h = g.hint();
      expect(h.kind).toBe('place');
      if (h.kind === 'place') expect(h.digit).toBe(p.solution[h.cell]);
      g.applyHint(h);
    }
    expect(g.isWon).toBe(true);
  });
  it('wrong digits, conflicts, notes in shared boxes, undo and restore', () => {
    const g = new SamuraiGame(p.givens, p.solution);
    const shared = p.givens.findIndex((v, c) => !v && GRIDS_OF[c]!.length === 2);
    const wrong = (p.solution[shared]! % 9) + 1;
    g.setValue(shared, wrong);
    expect(g.isWrong(shared)).toBe(true);
    expect(g.hint().kind).toBe('wrong');
    g.undo();
    expect(g.values[shared]).toBe(0);
    g.fillNotes();
    for (let c = 0; c < SIZE; c++) if (ACTIVE[c] && !g.values[c]) expect(g.notes[c]! & (1 << (p.solution[c]! - 1))).toBeTruthy();
    const copy = new SamuraiGame(p.givens, p.solution);
    expect(copy.restore(JSON.parse(JSON.stringify(g.serialize())))).toBe(true);
    expect(copy.notes).toEqual(g.notes);
  });
});
