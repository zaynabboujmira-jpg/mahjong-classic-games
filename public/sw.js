/*
 * Free Play Classic service worker: makes all 16 games playable offline.
 *
 * - On install it caches every page, script, stylesheet and word list listed
 *   in /precache.json (written at build time by scripts/sw-precache.mjs).
 * - Hashed assets (/_astro/) and word lists are served cache-first.
 * - Pages are served from the cache at once and refreshed in the background
 *   (stale-while-revalidate); query strings such as ?seed= are ignored for
 *   the lookup, so shared and daily deals open offline too.
 * The build stamps VERSION, so every deploy gets a fresh cache.
 */
const VERSION = '__PRECACHE_VERSION__';
const CACHE = `fpc-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch('/precache.json', { cache: 'no-store' });
      const { urls } = await res.json();
      // Small batches; one failed file must not abort the whole install.
      for (let i = 0; i < urls.length; i += 8) {
        await Promise.all(urls.slice(i, i + 8).map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => undefined)));
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('fpc-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname === '/sw.js' || url.pathname === '/precache.json') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(url.pathname, { ignoreVary: true });
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(url.pathname, res.clone());
            return res;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        return (await network) || (await cache.match('/', { ignoreVary: true })) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Hashed assets and word lists never change under one URL, so query strings
      // (Astro's ?astro-retry=) and Vary headers (module scripts send Origin)
      // must not cause a miss.
      const immutable = url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/words/');
      const cached = await cache.match(immutable ? url.pathname : req, { ignoreVary: true });
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok && immutable) cache.put(url.pathname, res.clone());
      return res;
    })().catch(() => new Response('', { status: 504 })),
  );
});
