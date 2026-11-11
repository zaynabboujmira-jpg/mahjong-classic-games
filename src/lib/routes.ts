import { getCollection } from 'astro:content';

export type SitemapSection = 'pages' | 'mahjong' | 'solitaire';
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
  const newestVariant = variants.reduce<Date | undefined>((d, v) => (!d || v.data.updated > d ? v.data.updated : d), undefined);
  const newest = layouts.reduce<Date | undefined>(
    (d, l) => (!d || l.data.updated > d ? l.data.updated : d),
    undefined,
  );
  return [
    { path: '/', section: 'pages', priority: 1.0, ...(newest ? { lastmod: newest } : {}) },
    { path: '/games/', section: 'pages', priority: 0.6 },
    { path: '/about/', section: 'pages', priority: 0.3 },
    { path: '/privacy/', section: 'pages', priority: 0.2 },
    { path: '/mahjong/', section: 'mahjong', priority: 0.9, ...(newest ? { lastmod: newest } : {}) },
    ...layouts.map((l) => ({
      path: `/mahjong/${l.data.engineId}/`,
      section: 'mahjong' as const,
      priority: 0.8,
      lastmod: l.data.updated,
    })),
    { path: '/solitaire/', section: 'solitaire', priority: 0.8, ...(newestVariant ? { lastmod: newestVariant } : {}) },
    ...variants.map((v) => ({
      path: `/solitaire/${v.id}/`,
      section: 'solitaire' as const,
      priority: 0.9,
      lastmod: v.data.updated,
    })),
  ];
}

export const SITEMAP_SECTIONS: readonly SitemapSection[] = ['pages', 'mahjong', 'solitaire'];

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
