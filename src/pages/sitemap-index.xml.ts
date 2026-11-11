import type { APIRoute } from 'astro';
import { SITEMAP_SECTIONS, sitemapEntries } from '../lib/routes';

/** Index of the per-section sitemaps (/sitemap-pages.xml, /sitemap-mahjong.xml, ...). */
export const GET: APIRoute = async ({ site }) => {
  const entries = await sitemapEntries();
  const items = SITEMAP_SECTIONS.map((section) => {
    const dates = entries.filter((e) => e.section === section && e.lastmod).map((e) => e.lastmod!.getTime());
    const lastmod = dates.length ? `<lastmod>${new Date(Math.max(...dates)).toISOString().slice(0, 10)}</lastmod>` : '';
    return `<sitemap><loc>${new URL(`/sitemap-${section}.xml`, site).href}</loc>${lastmod}</sitemap>`;
  }).join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
