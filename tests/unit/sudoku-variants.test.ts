import { describe, expect, it } from 'vitest';
import { VARIANTS, VARIANT_LEVELS, generateVariant, jigsawRegions, makeShape, singlesSolve, solveShape } from '../../src/engines/sudoku/variants';
import { createRng } from '../../src/engines/core/rng';

describe('sudoku variant shapes', () => {
  it('builds the right units for each variant', () => {
    expect(makeShape('6x6').units).toHaveLength(18);
    expect(makeShape('diagonal').units).toHaveLength(29);
    expect(makeShape('16x16').units).toHaveLength(48);
    for (const v of VARIANTS) for (const u of makeShape(v).units) expect(u).toHaveLength(makeShape(v).n);
  });
  it('jigsaw regions: nine connected regions of nine cells, not the classic boxes', () => {
    for (const seed of ['a', 'b', 'c']) {
      const reg = jigsawRegions(createRng(seed));
      for (let k = 0; k < 9; k++) expect(reg.filter((g) => g === k)).toHaveLength(9);
      expect(reg).not.toEqual(makeShape('diagonal').region);
      // Connectivity is checked inside jigsawRegions; spot-check one region by flood fill.
      const cells = reg.flatMap((g, i) => (g === 4 ? [i] : []));
      const seen = new Set([cells[0]]);
      for (let changed = true; changed; ) {
        changed = false;
        for (const x of cells) if (!seen.has(x) && [...seen].some((y) => Math.abs(x - y!) === 9 || (Math.abs(x - y!) === 1 && Math.floor(x / 9) === Math.floor(y! / 9)))) seen.add(x), (changed = true);
      }
      expect(seen.size).toBe(9);
    }
  });
});

describe('sudoku variant puzzles', () => {
  for (const v of VARIANTS)
    for (const level of VARIANT_LEVELS)
      it(`${v} ${level}: valid solution, unique, solvable by singles, medium needs hidden singles`, () => {
        const t = performance.now();
        const p = generateVariant(v, level, 'test');
        const ms = performance.now() - t;
        const shape = makeShape(v, p.region);
        for (const u of shape.units) expect(new Set(u.map((i) => p.solution[i])).size).toBe(shape.n);
        for (let i = 0; i < p.givens.length; i++) if (p.givens[i]) expect(p.givens[i]).toBe(p.solution[i]);
        const r = solveShape(shape, p.givens, 2, undefined, 2_000_000);
        expect(r.count).toBe(1);
        expect(singlesSolve(shape, p.givens, level === 'easy' ? 1 : 2)).toBe(level === 'easy' ? 1 : 2);
        console.log(v, level, Math.round(ms) + 'ms', p.givens.filter(Boolean).length + ' clues');
        expect(ms).toBeLessThan(10_000);
      });
  it('is deterministic', () => {
    expect(generateVariant('jigsaw', 'easy', 'x')).toEqual(generateVariant('jigsaw', 'easy', 'x'));
  });
});
