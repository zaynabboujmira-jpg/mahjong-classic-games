// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

/** Public origin for canonicals, sitemaps and OpenGraph. SITE_URL overrides it (e.g. for a staging build). */
const site = process.env.SITE_URL ?? 'https://freeplayclassic.com';

export default defineConfig({
  site,
  trailingSlash: 'always',
  output: 'static',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  integrations: [preact()],
  vite: { plugins: [tailwindcss()] },
});
