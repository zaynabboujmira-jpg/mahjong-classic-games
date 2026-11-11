import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { LAYOUTS } from './engines/mahjong/layouts';

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

export const collections = { layouts, solitaire };
