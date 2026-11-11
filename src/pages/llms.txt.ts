import type { APIRoute } from 'astro';
import { GAMES } from '../data/games';
import { SITE } from '../data/site';
import { layoutPages } from '../lib/mahjong-pages';

/** Plain-text site summary for AI answer engines (llmstxt.org convention). */
export const GET: APIRoute = async ({ site }) => {
  const abs = (p: string) => new URL(p, site).href;
  const pages = await layoutPages();
  const body = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description}`,
    '',
    'Every Mahjong Solitaire deal is generated with a guaranteed solution. Identical tiles match; any two flowers match, and any two seasons match. A tile is free when nothing is on top of it and its left or right side is open.',
    '',
    '## Mahjong layouts',
    ...pages.map(
      (p) =>
        `- [${p.entry.data.title}](${abs(`/mahjong/${p.id}/`)}): ${p.tiles} tiles, ${p.layers} layers, ${p.entry.data.difficulty.toLowerCase()}. ${p.entry.data.summary}`,
    ),
    '',
    '## Games',
    ...GAMES.map((g) => `- ${g.name}${g.href ? ` (${abs(g.href)})` : ' (coming soon)'}: ${g.blurb}`),
    '',
    '## Optional',
    `- [About](${abs('/about/')})`,
    `- [Privacy](${abs('/privacy/')})`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
