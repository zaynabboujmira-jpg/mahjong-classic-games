// Fails the build if any page ships more than BUDGET_KB of gzipped JavaScript.
// For each built HTML page it collects every script and island URL, follows
// their static and dynamic imports, and sums the gzipped size of the set.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, posix } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const BUDGET_KB = 60;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const gzCache = new Map();
const gz = (file) => {
  if (!gzCache.has(file)) gzCache.set(file, gzipSync(readFileSync(file)).length);
  return gzCache.get(file);
};

const toFile = (url) => join(DIST, url.replace(/^\//, ''));

function collect(url, seen) {
  if (seen.has(url)) return;
  seen.add(url);
  const code = readFileSync(toFile(url), 'utf8');
  const dir = posix.dirname(url);
  for (const m of code.matchAll(/(?:import|from)\s*\(?\s*["'](\.{1,2}\/[^"']+\.js)["']/g)) {
    collect(posix.normalize(posix.join(dir, m[1])), seen);
  }
}

const pages = walk(DIST).filter((f) => f.endsWith('.html'));
let worst = 0;
let failed = false;
const rows = [];
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const seen = new Set();
  for (const m of html.matchAll(/(?:src|component-url|renderer-url|before-hydration-url)="(\/_astro\/[^"]+\.js)"/g)) collect(m[1], seen);
  // Inline module scripts count too.
  const inline = [...html.matchAll(/<script(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .join('');
  const bytes = [...seen].reduce((sum, u) => sum + gz(toFile(u)), 0) + (inline ? gzipSync(inline).length : 0);
  const kb = bytes / 1024;
  worst = Math.max(worst, kb);
  if (kb > BUDGET_KB) failed = true;
  rows.push([relative(DIST, page).replaceAll('\\', '/'), kb]);
}

rows.sort((a, b) => b[1] - a[1]);
for (const [page, kb] of rows) console.log(`${kb.toFixed(1).padStart(6)} KB  ${page}`);
console.log(`\nLargest page: ${worst.toFixed(1)} KB gzipped JS (budget ${BUDGET_KB} KB)`);
if (failed) {
  console.error('JS budget exceeded');
  process.exit(1);
}
