import { describe, expect, it } from 'vitest';
import { cageErrors, generateKiller, killerSolve } from '../../src/engines/sudoku/killer';
import { KillerGame } from '../../src/engines/sudoku/killer-game';
import { bit, isConsistent } from '../../src/engines/sudoku/grid';

const adjacent = (a: number, b: number) => (Math.abs(a - b) === 9) || (Math.abs(a - b) === 1 && Math.floor(a / 9) === Math.floor(b / 9));

describe('killer sudoku generator', () => {
  for (const level of ['easy', 'hard'] as const) {
    it(`${level}: cages cover the grid, are connected, sum right and never repeat a digit; one solution`, () => {
      for (const seed of ['a', 'b', 'c']) {
        const p = generateKiller(level, seed);
        expect(isConsistent(p.solution)).toBe(true);
        const cells = p.cages.flatMap((c) => c.cells).sort((x, y) => x - y);
        expect(cells).toEqual(Array.from({ length: 81 }, (_, i) => i));
        for (const c of p.cages) {
          expect(c.cells.length).toBeGreaterThanOrEqual(1);
          expect(c.cells.length).toBeLessThanOrEqual(5);
          expect(c.cells.reduce((t, i) => t + p.solution[i]!, 0)).toBe(c.sum);
          expect(new Set(c.cells.map((i) => p.solution[i])).size).toBe(c.cells.length);
          // Connected: grow from the first cell through orthogonal neighbours.
          const seen = new Set([c.cells[0]!]);
          for (let changed = true; changed; ) {
            changed = false;
            for (const x of c.cells) if (!seen.has(x) && [...seen].some((y) => adjacent(x, y))) seen.add(x), (changed = true);
          }
          expect(seen.size).toBe(c.cells.length);
        }
        for (let i = 0; i < 81; i++) if (p.givens[i]) expect(p.givens[i]).toBe(p.solution[i]);
        const r = killerSolve(p.cages, p.givens, 2, 5_000_000);
        expect(r.exhausted).toBe(false);
        expect(r.count).toBe(1);
        expect(r.all[0]).toEqual(p.solution);
      }
    }, 60_000);
  }

  it('is deterministic for a level and seed', () => {
    expect(generateKiller('easy', 'same')).toEqual(generateKiller('easy', 'same'));
  });
});

describe('killer sudoku game', () => {
  const p = generateKiller('easy', 'game');

  it('flags repeated digits and wrong totals in a cage', () => {
    const cage = p.cages.find((c) => c.cells.length >= 2)!;
    const values = new Array<number>(81).fill(0);
    values[cage.cells[0]!] = 5;
    values[cage.cells[1]!] = 5;
    expect([...cageErrors(p.cages, values)].sort()).toEqual([cage.cells[0], cage.cells[1]].sort());
    const ok = new Array<number>(81).fill(0);
    for (const i of cage.cells) ok[i] = p.solution[i]!;
    expect(cageErrors(p.cages, ok).size).toBe(0);
    ok[cage.cells[0]!] = (p.solution[cage.cells[0]!]! % 9) + 1;
    expect(cageErrors(p.cages, ok).size).toBeGreaterThan(0);
  });

  it('notes keep the true digit and hints always place the right digit until solved', () => {
    const g = new KillerGame(p.cages, p.givens, p.solution);
    g.fillNotes();
    for (let i = 0; i < 81; i++) if (!g.values[i]) expect(g.notes[i]! & bit(p.solution[i]!)).toBeTruthy();
    for (let n = 0; n < 81 && !g.isWon; n++) {
      const h = g.hint();
      expect(h.kind).toBe('place');
      if (h.kind === 'place') expect(h.digit).toBe(p.solution[h.cell]);
      g.applyHint(h);
    }
    expect(g.isWon).toBe(true);
  });

  it('hints fix a wrong digit first, and undo restores the grid', () => {
    const g = new KillerGame(p.cages, p.givens, p.solution);
    const i = p.givens.findIndex((v) => !v);
    g.setValue(i, (p.solution[i]! % 9) + 1);
    expect(g.hint().kind).toBe('wrong');
    g.undo();
    expect(g.values[i]).toBe(0);
  });
});
