import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const faq = z.array(z.object({ q: z.string().min(8), a: z.string().min(20) })).min(3);

const games = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/games' }),
  schema: z.object({
    title: z.string().max(60),
    description: z.string().min(120).max(158),
    h1: z.string(),
    intro: z.string().min(80),
    howTo: z.array(z.string()).min(3),
    faq,
    updated: z.coerce.date(),
  }),
});

const layouts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/layouts' }),
  schema: z.object({
    title: z.string().max(60),
    description: z.string().min(120).max(158),
    h1: z.string(),
    intro: z.string().min(80),
    tips: z.array(z.string()).min(2),
    faq,
    updated: z.coerce.date(),
  }),
});

export const collections = { games, layouts };
