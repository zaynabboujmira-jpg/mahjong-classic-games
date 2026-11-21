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
  // Third batch (2026-11-21): beginner rules and setup guides (seo-action-plan Batch 2 #1-4).
  'how-to-set-up-a-chess-board': 'chess',
  'chess-strategies-for-beginners': 'chess',
  'how-to-play-mahjong-beginners': 'mahjong-4p',
  'how-to-play-sudoku-beginners': 'sudoku',
  // Fourth batch (2026-11-21): seo-action-plan Batch 2 #5-8 and the Cribbage guide (Batch 3 #1).
  'chess-pieces-names-and-moves': 'chess',
  'how-to-set-up-backgammon-board': 'backgammon',
  'how-to-play-checkers-rules': 'checkers',
  'how-to-play-spades-rules': 'spades',
  'how-to-play-cribbage-rules-and-scoring': 'cribbage',
  // Fifth batch (2026-11-21): seo-action-plan Batch 2 #9-13 and the Killer Sudoku guide (Batch 3 #3).
  'how-many-cards-in-a-deck': 'hearts',
  'mahjong-with-2-or-3-players': 'mahjong-4p',
  'who-invented-chess-history': 'chess',
  'chess-vs-checkers': 'checkers',
  'backgammon-strategy-for-beginners': 'backgammon',
  'killer-sudoku-rules-and-tips': 'killer-sudoku',
};

describe('strategy guides (/blog/)', () => {
  it('has the 37 planned guides, each mapped to its game', () => {
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
    // Every game page, guide and level page; the post-build SEO audit also checks each link resolves.
    const pages = new Set([...CATALOG.flatMap((g) => [g.play, g.hub]), ...posts.map((p) => `/blog/${p.slug}/`), '/daily/', '/sudoku/printable/']);
    const known = [
      /^\/mahjong\/(american-mahjong-guide|turtle|dragon|pyramid|fortress|butterfly|fish|american|hong-kong|chinese)\/$/,
      /^\/sudoku\/(easy|medium|hard|expert)\/$/,
      /^\/minesweeper\/(beginner|intermediate|expert)\/$/,
      /^\/solitaire\/freecell\/deal\/\d+\/$/,
    ];
    for (const p of posts)
      for (const [, href] of p.body.matchAll(/\]\((\/[^)]*)\)/g))
        expect(pages.has(href!) || known.some((re) => re.test(href!)), `${p.slug}: ${href}`).toBe(true);
  });

  it('new beginner guides link to the games they teach', () => {
    const links = (slug: string) => [...posts.find((p) => p.slug === slug)!.body.matchAll(/\]\((\/[^)]*)\)/g)].map((m) => m[1]);
    expect(links('how-to-set-up-a-chess-board')).toContain('/board/chess/');
    expect(links('chess-strategies-for-beginners')).toContain('/board/chess/');
    expect(links('how-to-play-mahjong-beginners')).toContain('/mahjong/chinese/');
    expect(links('how-to-play-sudoku-beginners')).toContain('/sudoku/easy/');
    expect(links('chess-pieces-names-and-moves')).toContain('/board/chess/');
    expect(links('how-to-set-up-backgammon-board')).toContain('/board/backgammon/');
    expect(links('how-to-play-checkers-rules')).toContain('/board/checkers/');
    expect(links('how-to-play-spades-rules')).toContain('/cards/spades/');
    expect(links('how-to-play-cribbage-rules-and-scoring')).toContain('/cards/cribbage/');
    expect(links('how-many-cards-in-a-deck')).toEqual(expect.arrayContaining(['/cards/hearts/', '/cards/spades/', '/solitaire/klondike/']));
    expect(links('mahjong-with-2-or-3-players')).toContain('/mahjong/hong-kong/');
    expect(links('who-invented-chess-history')).toContain('/board/chess/');
    expect(links('chess-vs-checkers')).toEqual(expect.arrayContaining(['/board/chess/', '/board/checkers/']));
    expect(links('backgammon-strategy-for-beginners')).toContain('/board/backgammon/');
    expect(links('killer-sudoku-rules-and-tips')).toContain('/sudoku/killer/');
  });

  it('rules guides and deep-dives on the same game link to each other and do not share keywords', () => {
    const post = (slug: string) => posts.find((p) => p.slug === slug)!;
    for (const [a, b] of <[string, string][]>[
      ['how-to-play-spades-rules', 'spades-bidding-nil-and-bags-explained'],
      ['how-to-set-up-backgammon-board', 'how-to-play-backgammon-beginners'],
      ['how-to-play-checkers-rules', 'checkers-forced-jumps-and-endgame-tactics'],
      ['chess-pieces-names-and-moves', 'how-to-set-up-a-chess-board'],
      ['backgammon-strategy-for-beginners', 'how-to-play-backgammon-beginners'],
      ['mahjong-with-2-or-3-players', 'how-to-play-mahjong-beginners'],
      ['killer-sudoku-rules-and-tips', 'how-to-play-sudoku-beginners'],
      ['who-invented-chess-history', 'chess-pieces-names-and-moves'],
      ['chess-vs-checkers', 'how-to-play-checkers-rules'],
    ]) {
      expect(post(a).body, a).toContain(`/blog/${b}/`);
      expect(post(b).body, b).toContain(`/blog/${a}/`);
      const shared = (post(a).front.keywords as string[]).filter((k) => (post(b).front.keywords as string[]).includes(k));
      expect(shared, `${a} / ${b}`).toEqual([]);
    }
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
