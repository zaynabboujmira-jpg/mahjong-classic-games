import type { APIRoute } from 'astro';
import { GAMES } from '../data/games';
import { SITE } from '../data/site';
import { getCollection } from 'astro:content';
import { LEVELS } from '../engines/minesweeper/game';
import { layoutPages } from '../lib/mahjong-pages';

/** Plain-text site summary for AI answer engines (llmstxt.org convention). */
export const GET: APIRoute = async ({ site }) => {
  const abs = (p: string) => new URL(p, site).href;
  const pages = await layoutPages();
  const sudoku = (await getCollection('sudoku')).sort((a, b) => a.data.order - b.data.order);
  const mines = (await getCollection('minesweeper')).sort((a, b) => a.data.order - b.data.order);
  const table = (await getCollection('tableMahjong')).sort((a, b) => a.data.order - b.data.order);
  const word = (await getCollection('word')).sort((a, b) => a.data.order - b.data.order);
  const arcade = (await getCollection('arcade')).sort((a, b) => a.data.order - b.data.order);
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
    '## 4-player Mahjong against bots',
    "Four-player Mahjong against three computer players, in the browser. The American table uses this site's own hand card; the official National Mah Jongg League card is not reproduced.",
    ...table.map((e) => `- [${e.data.title}](${abs(`/mahjong/${e.data.level}/`)}): ${e.data.summary}`),
    '',
    '## Sudoku',
    'Every Sudoku puzzle has exactly one solution and is solved by a logic engine before it is shown, so it never needs guessing. The level is set by the hardest technique required.',
    ...sudoku.map((e) => `- [${e.data.title}](${abs(`/sudoku/${e.data.level}/`)}): ${e.data.summary}`),
    '',
    '## Minesweeper',
    'The first click is always safe: mines are placed afterwards, never on the clicked cell or its eight neighbours.',
    ...mines.map((e) => {
      const l = LEVELS[e.data.level];
      return `- [${e.data.title}](${abs(`/minesweeper/${e.data.level}/`)}): ${l.width}×${l.height}, ${l.mines} mines. ${e.data.summary}`;
    }),
    '',
    '## Word Guess',
    'A daily word for everyone (same word on the same calendar day, new at local midnight) plus unlimited play, in 4, 5 or 6 letters. Six guesses; green = right spot, orange = elsewhere in the word, grey = not in the word.',
    ...word.map((e) => `- [${e.data.title}](${abs(e.data.level === '5-letters' ? '/word-guess/' : `/word-guess/${e.data.level}/`)}): ${e.data.summary}`),
    '',
    '## Arcade',
    ...arcade.map((e) => `- [${e.data.title}](${abs(`/arcade/${e.data.level}/`)}): ${e.data.summary}`),
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
