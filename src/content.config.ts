import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { LAYOUTS } from './engines/mahjong/layouts';
import { LEVEL_IDS } from './engines/minesweeper/game';
import { DIFFICULTIES } from './engines/sudoku/generator';

const layoutIds = LAYOUTS.map((l) => l.id) as [string, ...string[]];

/**
 * One Markdown file per Mahjong layout: the SEO copy lives here so it can be
 * edited without touching components. The schema enforces the on-page SEO
 * rules (title and description lengths, a real FAQ) at build time.
 */
const layouts = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/layouts' }),
  schema: z.object({
    engineId: z.enum(layoutIds),
    title: z.string().min(10).max(48),
    h1: z.string().min(10).max(70),
    description: z.string().min(110).max(160),
    summary: z.string().min(20).max(140),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    order: z.number().int(),
    keywords: z.array(z.string()).min(2),
    updated: z.coerce.date(),
    faq: z.array(z.object({ q: z.string().min(8), a: z.string().min(30) })).min(3),
  }),
});

/** One Markdown file per solitaire variant page (/solitaire/[variant]/). */
const solitaire = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/solitaire' }),
  schema: z.object({
    engine: z.enum(['klondike', 'spider', 'freecell']),
    order: z.number().int(),
    title: z.string().min(10).max(48),
    h1: z.string().min(10).max(70),
    description: z.string().min(110).max(160),
    summary: z.string().min(20).max(140),
    /** Klondike only. */
    defaultDraw: z.union([z.literal(1), z.literal(3)]).optional(),
    /** Spider only. */
    defaultSuits: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
    keywords: z.array(z.string()).min(2),
    updated: z.coerce.date(),
    howTo: z.array(z.object({ name: z.string().min(3), text: z.string().min(20) })).min(3),
    faq: z.array(z.object({ q: z.string().min(8), a: z.string().min(30) })).min(3),
  }),
});

/** Shared fields of a per-level game page (Sudoku difficulty, Minesweeper level). */
const levelPage = <T extends readonly [string, ...string[]]>(levels: T) =>
  z.object({
    level: z.enum(levels),
    order: z.number().int(),
    /** Short label for toggles and breadcrumbs, e.g. "Expert". */
    name: z.string().min(3).max(14),
    title: z.string().min(10).max(48),
    h1: z.string().min(10).max(70),
    description: z.string().min(110).max(160),
    summary: z.string().min(20).max(140),
    keywords: z.array(z.string()).min(2),
    updated: z.coerce.date(),
    howTo: z.array(z.object({ name: z.string().min(3), text: z.string().min(20) })).min(3),
    faq: z.array(z.object({ q: z.string().min(8), a: z.string().min(30) })).min(3),
  });

/** One Markdown file per Sudoku difficulty (/sudoku/[difficulty]/). */
const sudoku = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/sudoku' }),
  schema: levelPage(DIFFICULTIES),
});

/** One Markdown file per Minesweeper level (/minesweeper/[difficulty]/). */
const minesweeper = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/minesweeper' }),
  schema: levelPage(LEVEL_IDS),
});

/** One Markdown file per 4-player rule set (/mahjong/american/, /mahjong/hong-kong/, /mahjong/chinese/). */
const tableMahjong = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/mahjong-table' }),
  schema: levelPage(['american', 'hong-kong', 'chinese'] as const),
});

/** Word Guess pages, one per word length (/word-guess/ is 5 letters). */
const word = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/word' }),
  schema: levelPage(['4-letters', '5-letters', '6-letters'] as const),
});

/** Arcade games (/arcade/[game]/). */
const arcade = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/arcade' }),
  schema: levelPage(['color-memory', 'paddle-ball', 'maze-chomper', 'alien-invaders', 'space-rocks', 'river-hopper', 'flappy-wing', 'ocean-grow', 'snake', 'brick-breaker', 'bubble-shooter'] as const),
});

/** Puzzle games (/puzzles/[game]/). */
const puzzles = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/puzzles' }),
  schema: levelPage(['number-merge', 'memory-match', 'nonogram', 'word-search', 'mini-crossword'] as const),
});

/** Board games (/board/[game]/). */
const board = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/board' }),
  schema: levelPage(['chess', 'checkers', 'dominoes', 'four-in-a-row'] as const),
});

export const collections = { layouts, solitaire, sudoku, minesweeper, tableMahjong, word, arcade, puzzles, board };
