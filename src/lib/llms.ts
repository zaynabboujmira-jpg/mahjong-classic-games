import { getCollection } from 'astro:content';
import { CATALOG, CATEGORIES, type CatalogGame } from '../data/catalog';
import { FAMOUS_DEALS } from '../data/freecell';
import { HOW_TO_STEPS } from '../data/mahjong';
import { FEATURES, FREE_LINE, SITE } from '../data/site';
import { layoutPages } from './mahjong-pages';

/**
 * Builds llms.txt (a structured index) and llms-full.txt (every page's facts,
 * how-to steps and FAQ) from the same content collections and catalog the
 * pages use, so answer engines get exactly what the pages say.
 */
interface SubPage {
  title: string;
  path: string;
  summary: string;
  howTo?: readonly { name: string; text: string }[];
  faq?: readonly { q: string; a: string }[];
}

async function subPages(): Promise<Record<string, SubPage[]>> {
  const byOrder = <T extends { data: { order: number } }>(xs: T[]) => xs.sort((a, b) => a.data.order - b.data.order);
  const layouts = await layoutPages();
  const solitaire = byOrder(await getCollection('solitaire'));
  const sudoku = byOrder(await getCollection('sudoku'));
  const mines = byOrder(await getCollection('minesweeper'));
  const word = byOrder(await getCollection('word'));
  const table = byOrder(await getCollection('tableMahjong'));
  const arcade = byOrder(await getCollection('arcade'));
  const puzzles = byOrder(await getCollection('puzzles'));
  const board = byOrder(await getCollection('board'));
  const cards = byOrder(await getCollection('cards'));
  const fromLevel = (base: string, e: { data: { level: string; title: string; summary: string; howTo: SubPage['howTo']; faq: SubPage['faq'] } }, path?: string): SubPage => ({
    title: e.data.title,
    path: path ?? `${base}${e.data.level}/`,
    summary: e.data.summary,
    ...(e.data.howTo ? { howTo: e.data.howTo } : {}),
    ...(e.data.faq ? { faq: e.data.faq } : {}),
  });
  const soli = (id: string) => solitaire.filter((s) => s.id === id).map((s) => ({ title: s.data.title, path: `/solitaire/${s.id}/`, summary: s.data.summary, howTo: s.data.howTo, faq: s.data.faq }));
  const out: Record<string, SubPage[]> = {
    'mahjong-solitaire': layouts.map((l) => ({
      title: l.entry.data.title,
      path: `/mahjong/${l.id}/`,
      summary: `${l.tiles} tiles, ${l.layers} layers, ${l.entry.data.difficulty.toLowerCase()}. ${l.entry.data.summary}`,
      howTo: HOW_TO_STEPS,
      faq: [...l.faq],
    })),
    'mahjong-4p': table.map((e) => fromLevel('/mahjong/', e)),
    klondike: soli('klondike'),
    spider: soli('spider'),
    freecell: [
      ...soli('freecell'),
      ...FAMOUS_DEALS.map((d) => ({ title: `FreeCell deal #${d.deal}`, path: `/solitaire/freecell/deal/${d.deal}/`, summary: d.note })),
    ],
    sudoku: sudoku.map((e) => fromLevel('/sudoku/', e)),
    minesweeper: mines.map((e) => fromLevel('/minesweeper/', e)),
    'word-guess': word.map((e) => fromLevel('/word-guess/', e, e.data.level === '5-letters' ? '/word-guess/' : undefined)),
  };
  for (const e of arcade) out[e.data.level] = [fromLevel('/arcade/', e)];
  for (const e of puzzles) out[e.data.level] = [fromLevel('/puzzles/', e)];
  for (const e of board) out[e.data.level] = [fromLevel('/board/', e)];
  for (const e of cards) out[e.data.level] = [fromLevel('/cards/', e)];
  out.pyramid = soli('pyramid');
  return out;
}

const factLines = (g: CatalogGame) => [
  `- What it is: ${g.facts.type}`,
  `- Goal: ${g.facts.goal}`,
  `- Modes: ${g.facts.modes}`,
  `- Controls: ${g.facts.controls}`,
  `- Players: ${g.facts.players}`,
  `- Price: ${FREE_LINE}; runs in any modern browser on phones, tablets and computers`,
];

export async function llmsTxt(site: URL): Promise<string> {
  const abs = (p: string) => new URL(p, site).href;
  const pages = await subPages();
  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.name} (${abs('/')}) is a free${FEATURES.ads ? '' : ', ad-free'} website with 34 classic games that play instantly in the browser on phones, tablets and computers. No download and no account${FEATURES.consent ? '' : ', no tracking cookies'}; scores stay on the player's device.`,
    '',
    'Facts worth knowing: every Mahjong Solitaire deal is generated with a solution; every Sudoku has exactly one solution reachable by logic alone; the first Minesweeper click is always safe; the arcade and word games are original games in classic genres (not the trademarked originals); the American Mahjong table uses this site\'s own hand card, not the National Mah Jongg League card.',
    '',
    `Full details for every page (rules, how-to steps and FAQs): ${abs('/llms-full.txt')}`,
    '',
  ];
  for (const c of CATEGORIES) {
    lines.push(`## ${c.name}`, '', c.blurb, '');
    for (const g of CATALOG.filter((x) => x.category === c.id)) {
      lines.push(`### [${g.name}](${abs(g.play)})`, '', g.hook, ...factLines(g));
      const subs = pages[g.id] ?? [];
      if (subs.length > 1) {
        lines.push('- Pages:');
        for (const s of subs) lines.push(`  - [${s.title}](${abs(s.path)}): ${s.summary}`);
      }
      lines.push('');
    }
  }
  lines.push(
    '## Daily challenges and stats',
    '',
    `- [Daily challenges](${abs('/daily/')}): the same four puzzles for everyone each day (Word Guess, medium Sudoku, Klondike draw-1 and the Turtle Mahjong layout), a daily streak and a spoiler-free result to share. New puzzles at local midnight.`,
    `- [Your stats & achievements](${abs('/stats/')}): wins and best results across all 34 games, the daily streak and ten achievements, read from the player's own browser with a reset option.`,
    '',
  );
  lines.push('## Site', '', `- [All games](${abs('/games/')})`, `- [About](${abs('/about/')})`, `- [Privacy](${abs('/privacy/')})`, `- [Terms of use](${abs('/terms/')})`, '');
  return lines.join('\n');
}

export async function llmsFullTxt(site: URL): Promise<string> {
  const abs = (p: string) => new URL(p, site).href;
  const pages = await subPages();
  const lines = [
    `# ${SITE.name}: full game reference`,
    '',
    `> Rules, modes, controls, how-to steps and FAQs for all 34 games on ${abs('/')}. Every answer below also appears on the linked page.`,
    '',
    '## Daily challenges',
    '',
    `URL: ${abs('/daily/')}`,
    '',
    'Four seeded puzzles shared by every player each day: the daily Word Guess, a medium Sudoku, a Klondike draw-1 deal and a Turtle layout Mahjong Solitaire board. Winning at least one keeps the daily streak alive; the result can be shared without spoilers. Everything is stored in the browser.',
    '',
    `Stats and achievements: ${abs('/stats/')} lists wins and best results across all 34 games plus ten achievements.`,
    '',
  ];
  for (const g of CATALOG) {
    lines.push(`## ${g.name}`, '', `URL: ${abs(g.play)}`, '', g.hook, ...factLines(g), '');
    for (const s of pages[g.id] ?? []) {
      lines.push(`### ${s.title}`, '', `URL: ${abs(s.path)}`, '', s.summary, '');
      if (s.howTo?.length) {
        lines.push('How to play:');
        s.howTo.forEach((h, i) => lines.push(`${i + 1}. ${h.name}: ${h.text}`));
        lines.push('');
      }
      if (s.faq?.length) {
        lines.push('FAQ:');
        for (const f of s.faq) lines.push(`- Q: ${f.q}`, `  A: ${f.a}`);
        lines.push('');
      }
    }
  }
  return lines.join('\n');
}
