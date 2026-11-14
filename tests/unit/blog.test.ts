import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { blogSchema, readingMinutes, wordCount } from '../../src/data/blog';
import { CATALOG } from '../../src/data/catalog';
import { embedCode } from '../../src/lib/embed';

const DIR = 'src/content/blog';
const posts = readdirSync(DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const raw = readFileSync(join(DIR, f), 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
    if (!m) throw new Error(`${f} has no front matter`);
    return { slug: f.replace(/\.md$/, ''), front: parse(m[1]!), body: m[2]! };
  });

const EXPECTED: Record<string, string> = {
  'how-to-win-mahjong-solitaire': 'mahjong-solitaire',
  'american-vs-hong-kong-mahjong-rules': 'mahjong-4p',
  'spider-solitaire-4-suits-strategy': 'spider',
  'freecell-winning-tactics': 'freecell',
  'sudoku-advanced-solving-techniques': 'sudoku',
  'minesweeper-patterns-and-probability': 'minesweeper',
  'word-guess-best-starting-words-strategy': 'word-guess',
  'chess-opening-principles-for-beginners': 'chess',
  'checkers-forced-jumps-and-endgame-tactics': 'checkers',
  'nonogram-picross-logic-guide': 'nonogram',
  'number-merge-2048-corner-strategy': 'number-merge',
  'four-in-a-row-winning-strategy': 'four-in-a-row',
  // Second batch (2026-11-14): common rules and how-to questions (docs/blog-topic-research.md).
  'klondike-solitaire-odds-of-winning': 'klondike',
  'how-to-play-backgammon-beginners': 'backgammon',
  'mahjong-scoring-faan-explained': 'mahjong-4p',
  'mahjong-tiles-meaning-guide': 'mahjong-solitaire',
  'hearts-rules-and-shooting-the-moon': 'hearts',
  'spades-bidding-nil-and-bags-explained': 'spades',
  'chess-special-moves-castling-en-passant': 'chess',
  'how-to-play-dominoes-draw-and-block': 'dominoes',
  'pyramid-solitaire-rules-and-strategy': 'pyramid',
  'tic-tac-toe-how-to-never-lose': 'tic-tac-toe',
};

describe('strategy guides (/blog/)', () => {
  it('has the 22 planned guides, each mapped to its game', () => {
    expect(posts.map((p) => p.slug).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const p of posts) expect(p.front.relatedGameId, p.slug).toBe(EXPECTED[p.slug]);
  });

  it('every relatedGameId is a real catalog game', () => {
    const ids = new Set(CATALOG.map((g) => g.id));
    for (const p of posts) expect(ids.has(p.front.relatedGameId), p.slug).toBe(true);
  });

  it('front matter passes the collection schema', () => {
    for (const p of posts) {
      const r = blogSchema.safeParse(p.front);
      expect(r.success, `${p.slug}: ${r.success ? '' : JSON.stringify(r.error.issues)}`).toBe(true);
    }
  });

  it('bodies are 800 to 1,200 words and readingTime matches', () => {
    for (const p of posts) {
      const n = wordCount(p.body);
      expect(n, p.slug).toBeGreaterThanOrEqual(800);
      expect(n, p.slug).toBeLessThanOrEqual(1200);
      expect(p.front.readingTime, p.slug).toBe(readingMinutes(p.body));
    }
  });

  it('bodies use H2 sections (for the table of contents) and no H1', () => {
    for (const p of posts) {
      expect(p.body.match(/^## /gm)?.length ?? 0, p.slug).toBeGreaterThanOrEqual(4);
      expect(/^# /m.test(p.body), p.slug).toBe(false);
    }
  });

  it('internal links point at real site paths', () => {
    const known = [/^\/mahjong\/american-mahjong-guide\/$/, /^\/solitaire\/freecell\/deal\/\d+\/$/];
    for (const p of posts)
      for (const [, href] of p.body.matchAll(/\]\((\/[^)]*)\)/g))
        expect(known.some((re) => re.test(href!)), `${p.slug}: ${href}`).toBe(true);
  });

  it('titles and descriptions are unique', () => {
    expect(new Set(posts.map((p) => p.front.title)).size).toBe(posts.length);
    expect(new Set(posts.map((p) => p.front.description)).size).toBe(posts.length);
  });

  it('the American rules guide links the printable scorecard guide', () => {
    const p = posts.find((x) => x.slug === 'american-vs-hong-kong-mahjong-rules')!;
    expect(p.body).toContain('/mahjong/american-mahjong-guide/');
    expect(p.front.play.href).toBe('/mahjong/american/');
  });
});

describe('embed snippet', () => {
  const code = embedCode('Spider & "Friends"', 'https://freeplayclassic.com/solitaire/spider/', 'https://freeplayclassic.com/');
  it('frames the canonical page and credits it with a plain link', () => {
    expect(code).toContain('<iframe src="https://freeplayclassic.com/solitaire/spider/"');
    expect(code).toContain('<a href="https://freeplayclassic.com/solitaire/spider/">');
    expect(code).toContain('loading="lazy"');
    expect(code).not.toContain('<script');
  });
  it('escapes the game name inside attributes', () => {
    expect(code).toContain('title="Spider &amp; &quot;Friends&quot; – Free Play Classic"');
  });
});
