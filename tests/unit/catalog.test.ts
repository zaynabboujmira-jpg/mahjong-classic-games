import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOG, CATEGORIES } from '../../src/data/catalog';
import { DICTIONARY_SIZES, MINESWEEPER_COMPARE, WORD_COMPARE } from '../../src/data/compare';
import { GAMES } from '../../src/data/games';
import { SITE } from '../../src/data/site';
import { ANSWERS } from '../../src/engines/word/answers';

describe('game catalog', () => {
  it('lists the 22 games in three categories (5 + 7 + 10)', () => {
    expect(CATALOG).toHaveLength(22);
    expect(new Set(CATALOG.map((g) => g.id)).size).toBe(22);
    const count = (id: string) => CATALOG.filter((g) => g.category === id).length;
    expect(CATEGORIES.map((c) => count(c.id))).toEqual([5, 7, 10]);
  });

  it('gives every game a play link, an icon, a hook, badges and complete facts', () => {
    for (const g of CATALOG) {
      expect(g.play).toMatch(/^\/[a-z0-9/-]+\/$/);
      expect(g.hub).toMatch(/^\/[a-z0-9/-]*$/);
      expect(g.icon).toContain('<');
      expect(g.hook.length).toBeGreaterThan(20);
      expect(g.badges.length).toBeGreaterThanOrEqual(2);
      for (const v of Object.values(g.facts)) expect(v.length).toBeGreaterThan(0);
    }
  });

  it('matches the live registry: every catalog play link is a live game page or its first page', () => {
    const live = GAMES.filter((g) => g.status === 'live').map((g) => g.href);
    for (const g of CATALOG) expect(live.includes(g.play) || live.includes(g.hub)).toBe(true);
  });

  it('carries the brand and production domain', () => {
    expect(SITE.name).toBe('Free Play Classic');
    expect(SITE.domain).toBe('freeplayclassic.com');
    expect(SITE.description.length).toBeLessThanOrEqual(160);
  });
});

describe('comparison tables', () => {
  it('states the real dictionary and answer counts for Word Guess', () => {
    for (const n of [4, 5, 6] as const) {
      const words = readFileSync(`public/words/${n}.txt`, 'utf8').trim();
      expect(words.length / n).toBe(DICTIONARY_SIZES[n]);
    }
    const row5 = WORD_COMPARE.rows.find((r) => r.cells[0] === '5 letters')!;
    expect(row5.cells[3]).toBe(String(ANSWERS[5].length));
  });

  it('states the classic Minesweeper sizes', () => {
    expect(MINESWEEPER_COMPARE.rows.map((r) => r.cells.slice(0, 3))).toEqual([
      ['Beginner', '9 × 9', '10'],
      ['Intermediate', '16 × 16', '40'],
      ['Expert', '30 × 16', '99'],
    ]);
  });
});
