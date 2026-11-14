import { z } from 'astro/zod';
import { CATALOG } from './catalog';

/**
 * Front matter of a strategy guide (src/content/blog/*.md), kept free of
 * astro:content so unit tests can validate the posts with it too. Each post
 * points at a catalog game (relatedGameId), which drives its "Play … free"
 * card and its OG art.
 */
const gameIds = CATALOG.map((g) => g.id) as [string, ...string[]];

export const blogSchema = z
  .object({
    title: z.string().min(20).max(60),
    description: z.string().min(110).max(160),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(['Strategy', 'Rules', 'Tips']),
    relatedGameId: z.enum(gameIds),
    /** The page to play when it is not the catalog game's default (e.g. the American rule set). */
    play: z.object({ name: z.string().min(3), href: z.string().regex(/^\/[a-z0-9/-]+\/$/) }).optional(),
    /** Minutes at READING_WPM; tests check it against the body. */
    readingTime: z.number().int().min(3).max(10),
    keywords: z.array(z.string()).min(3),
    /** The "Key takeaways" box: short, quotable sentences. */
    takeaways: z.array(z.string().min(30).max(240)).min(3).max(6),
    faqs: z.array(z.object({ q: z.string().min(8), a: z.string().min(30) })).min(3),
  })
  .refine((d) => !d.updatedDate || d.updatedDate >= d.pubDate, { message: 'updatedDate is before pubDate' });

export const READING_WPM = 220;

/** Words in a Markdown body (for wordCount and reading time). */
export const wordCount = (markdown: string) =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;

export const readingMinutes = (markdown: string) => Math.max(1, Math.round(wordCount(markdown) / READING_WPM));
