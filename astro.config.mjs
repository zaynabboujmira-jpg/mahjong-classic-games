// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Set SITE_URL in the Cloudflare Pages build environment (e.g. https://www.yourdomain.com).
const site = process.env.SITE_URL ?? 'https://example.com';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  integrations: [
    preact({ compat: false }),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      serialize(item) {
        const url = new URL(item.url);
        const path = url.pathname;
        if (path === '/') {
          item.priority = 1.0;
          item.changefreq = 'daily';
        } else if (path.startsWith('/mahjong/') || path.startsWith('/games/')) {
          item.priority = 0.9;
          item.changefreq = 'weekly';
        } else if (path.startsWith('/guides/')) {
          item.priority = 0.6;
          item.changefreq = 'monthly';
        } else if (['/privacy/', '/about/', '/contact/'].includes(path)) {
          item.priority = 0.3;
          item.changefreq = 'yearly';
        }
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
