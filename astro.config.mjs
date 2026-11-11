// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

/** Public origin for canonicals, sitemaps and OpenGraph. Set SITE_URL in Cloudflare Pages. */
const site = process.env.SITE_URL ?? 'https://example.com';

export default defineConfig({
  site,
  trailingSlash: 'always',
  output: 'static',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  integrations: [preact()],
  vite: { plugins: [tailwindcss()] },
});
