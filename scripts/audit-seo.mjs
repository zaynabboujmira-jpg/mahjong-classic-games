// SEO gate for the built site (dist/). Fails the build when any page breaks:
//  - exactly one <h1>, and headings never skip a level (h2 -> h4)
//  - a canonical URL and a meta description
//  - pages with a playable game: VideoGame + SoftwareApplication + HowTo + FAQPage + BreadcrumbList JSON-LD
//  - the homepage and hubs: CollectionPage + ItemList JSON-LD
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
const HUBS = ['/', '/games/', '/mahjong/', '/solitaire/', '/sudoku/', '/minesweeper/', '/arcade/', '/puzzles/', '/board/'];
const GAME_TYPES = ['VideoGame', 'SoftwareApplication', 'HowTo', 'FAQPage', 'BreadcrumbList'];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const problems = [];
let checked = 0;
for (const file of walk(DIST).filter((f) => f.endsWith('.html'))) {
  const rel = relative(DIST, file).split(sep).join('/');
  if (rel === '404.html') continue;
  const path = '/' + rel.replace(/index\.html$/, '');
  const html = readFileSync(file, 'utf8');
  checked++;
  const fail = (msg) => problems.push(`${path}: ${msg}`);

  // Headings in document order (skip <noscript> and <template> content).
  const body = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  const levels = [...body.matchAll(/<h([1-6])[\s>]/gi)].map((m) => Number(m[1]));
  const h1s = levels.filter((l) => l === 1).length;
  if (h1s !== 1) fail(`${h1s} <h1> elements (expected 1)`);
  if (levels[0] !== 1) fail(`first heading is h${levels[0]}, not h1`);
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) fail(`heading jumps from h${levels[i - 1]} to h${levels[i]}`);

  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
  if (!canonical) fail('no canonical URL');
  else if (!canonical.endsWith(path)) fail(`canonical ${canonical} does not match the page`);
  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) fail('missing or very short meta description');

  const types = new Set();
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      fail('JSON-LD does not parse');
      continue;
    }
    for (const node of data['@graph'] ?? [data]) for (const t of [node['@type']].flat()) types.add(t);
  }
  const hasGame = /<astro-island[^>]+component-url="[^"]*Game/.test(html);
  if (hasGame) for (const t of GAME_TYPES) if (!types.has(t)) fail(`game page without ${t} JSON-LD`);
  if (HUBS.includes(path)) for (const t of ['CollectionPage', 'ItemList']) if (!types.has(t)) fail(`hub without ${t} JSON-LD`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\nSEO audit: ${problems.length} problem(s) across ${checked} pages.`);
  process.exit(1);
}
console.log(`SEO audit: ${checked} pages OK (headings, canonicals, descriptions, JSON-LD).`);
