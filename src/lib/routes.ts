import { getCollection } from 'astro:content';
import { FAMOUS_DEALS } from '../data/freecell';

export type SitemapSection = 'pages' | 'mahjong' | 'solitaire' | 'sudoku' | 'minesweeper' | 'word' | 'arcade' | 'puzzles';
export interface SitemapEntry {
  path: string;
  section: SitemapSection;
  lastmod?: Date;
  priority: number;
}

/** Every indexable URL, grouped into the split sitemaps. noindex pages are left out. */
export async function sitemapEntries(): Promise<SitemapEntry[]> {
  const layouts = (await getCollection('layouts')).sort((a, b) => a.data.order - b.data.order);
  const variants = await getCollection('solitaire');
  const sudoku = (await getCollection('sudoku')).sort((a, b) => a.data.order - b.data.order);
  const mines = (await getCollection('minesweeper')).sort((a, b) => a.data.order - b.data.order);
  const table = (await getCollection('tableMahjong')).sort((a, b) => a.data.order - b.data.order);
  const word = (await getCollection('word')).sort((a, b) => a.data.order - b.data.order);
  const arcade = (await getCollection('arcade')).sort((a, b) => a.data.order - b.data.order);
  const puzzles = (await getCollection('puzzles')).sort((a, b) => a.data.order - b.data.order);
  const newestOf = (entries: { data: { updated: Date } }[]) =>
    entries.reduce<Date | undefined>((d, e) => (!d || e.data.updated > d ? e.data.updated : d), undefined);
  const newestVariant = variants.reduce<Date | undefined>((d, v) => (!d || v.data.updated > d ? v.data.updated : d), undefined);
  const newest = layouts.reduce<Date | undefined>(
    (d, l) => (!d || l.data.updated > d ? l.data.updated : d),
    undefined,
  );
  return [
    { path: '/', section: 'pages', priority: 1.0, ...(newest ? { lastmod: newest } : {}) },
    { path: '/games/', section: 'pages', priority: 0.6 },
    { path: '/daily/', section: 'pages', priority: 0.8 },
    { path: '/stats/', section: 'pages', priority: 0.4 },
    { path: '/about/', section: 'pages', priority: 0.3 },
    { path: '/privacy/', section: 'pages', priority: 0.2 },
    { path: '/terms/', section: 'pages', priority: 0.2 },
    { path: '/mahjong/', section: 'mahjong', priority: 0.9, ...(newest ? { lastmod: newest } : {}) },
    ...layouts.map((l) => ({
      path: `/mahjong/${l.data.engineId}/`,
      section: 'mahjong' as const,
      priority: 0.8,
      lastmod: l.data.updated,
    })),
    ...table.map((t) => ({ path: `/mahjong/${t.data.level}/`, section: 'mahjong' as const, priority: 0.9, lastmod: t.data.updated })),
    { path: '/solitaire/', section: 'solitaire', priority: 0.8, ...(newestVariant ? { lastmod: newestVariant } : {}) },
    ...variants.map((v) => ({
      path: `/solitaire/${v.id}/`,
      section: 'solitaire' as const,
      priority: 0.9,
      lastmod: v.data.updated,
    })),
    ...FAMOUS_DEALS.map((d) => ({ path: `/solitaire/freecell/deal/${d.deal}/`, section: 'solitaire' as const, priority: 0.5 })),
    ...levelEntries('/sudoku/', 'sudoku', sudoku, newestOf(sudoku)),
    ...levelEntries('/minesweeper/', 'minesweeper', mines, newestOf(mines)),
    // Word Guess: the 5-letter game is the hub URL itself.
    ...word.map((e) => ({
      path: e.data.level === '5-letters' ? '/word-guess/' : `/word-guess/${e.data.level}/`,
      section: 'word' as const,
      priority: e.data.level === '5-letters' ? 0.9 : 0.8,
      lastmod: e.data.updated,
    })),
    ...levelEntries('/arcade/', 'arcade', arcade, newestOf(arcade)),
    { path: '/puzzles/', section: 'puzzles', priority: 0.8, ...(newestOf(puzzles) ? { lastmod: newestOf(puzzles)! } : {}) },
    ...puzzles.map((e) => ({
      path: e.data.level === 'four-in-a-row' ? '/board/four-in-a-row/' : `/puzzles/${e.data.level}/`,
      section: 'puzzles' as const,
      priority: 0.9,
      lastmod: e.data.updated,
    })),
  ];
}

/** A game hub plus one page per level. */
function levelEntries(
  base: string,
  section: SitemapSection,
  entries: { data: { level: string; updated: Date } }[],
  newest: Date | undefined,
): SitemapEntry[] {
  return [
    { path: base, section, priority: 0.8, ...(newest ? { lastmod: newest } : {}) },
    ...entries.map((e) => ({ path: `${base}${e.data.level}/`, section, priority: 0.9, lastmod: e.data.updated })),
  ];
}

export const SITEMAP_SECTIONS: readonly SitemapSection[] = ['pages', 'mahjong', 'solitaire', 'sudoku', 'minesweeper', 'word', 'arcade', 'puzzles'];

export function sitemapXml(entries: readonly SitemapEntry[], site: URL): string {
  const urls = entries
    .map((e) => {
      const loc = new URL(e.path, site).href;
      const lastmod = e.lastmod ? `<lastmod>${e.lastmod.toISOString().slice(0, 10)}</lastmod>` : '';
      return `<url><loc>${loc}</loc>${lastmod}<priority>${e.priority.toFixed(1)}</priority></url>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}
