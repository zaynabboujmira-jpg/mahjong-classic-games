import type { APIRoute, GetStaticPaths } from 'astro';
import { SITEMAP_SECTIONS, sitemapEntries, sitemapXml, type SitemapSection } from '../lib/routes';

export const getStaticPaths = (() => SITEMAP_SECTIONS.map((section) => ({ params: { section } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params, site }) => {
  const section = params.section as SitemapSection;
  const entries = (await sitemapEntries()).filter((e) => e.section === section);
  return new Response(sitemapXml(entries, site!), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
