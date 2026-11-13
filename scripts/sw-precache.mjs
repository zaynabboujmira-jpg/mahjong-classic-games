// After `astro build`: lists everything the games need offline in
// dist/precache.json and stamps dist/sw.js with a version hash, so each
// deploy installs a fresh cache. Social images, sitemaps and llms files are
// left out: they are not needed to play.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const hash = createHash('sha256');
const urls = [];
for (const file of walk(DIST).sort()) {
  const rel = relative(DIST, file).split(sep).join('/');
  let url = null;
  if (rel.endsWith('.html')) {
    if (rel === '404.html') continue;
    url = '/' + rel.replace(/index\.html$/, '');
  } else if (rel.startsWith('_astro/') || rel.startsWith('words/')) url = '/' + rel;
  else if (['favicon.svg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'].includes(rel)) url = '/' + rel;
  if (!url) continue;
  urls.push(url);
  hash.update(url).update(readFileSync(file));
}
hash.update(readFileSync(join(DIST, 'sw.js')));
const version = hash.digest('hex').slice(0, 12);
writeFileSync(join(DIST, 'precache.json'), JSON.stringify({ version, urls }));
const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
if (!sw.includes('__PRECACHE_VERSION__')) throw new Error('dist/sw.js has no version placeholder');
writeFileSync(join(DIST, 'sw.js'), sw.replace('__PRECACHE_VERSION__', version));
const bytes = urls.reduce((n, u) => n + statSync(join(DIST, u.endsWith('/') ? `${u}index.html` : u)).size, 0);
console.log(`Service worker: precaching ${urls.length} files (${Math.round(bytes / 1024)} KB uncompressed), version ${version}.`);
