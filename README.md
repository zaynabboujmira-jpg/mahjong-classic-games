# Mahjong & Classic Games

Fast, accessible Mahjong Solitaire built with Astro, TypeScript, Tailwind CSS v4, Preact islands and HTML5 Canvas, deployed as a static site on Cloudflare Pages. See [docs/01-competitor-analysis-and-niche-strategy.md](docs/01-competitor-analysis-and-niche-strategy.md) for the strategy behind it.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:4321 |
| `npm run check` | `astro check` + `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Static build to `dist/` (pages, sitemaps, OG images) |
| `npm run budget` | Fails if any page ships more than 60 KB gzipped JS |
| `npm run verify` | All of the above, as run in CI |

## Deploying to Cloudflare Pages

Build command `npm run build`, output directory `dist`, environment variable `SITE_URL=https://your-domain` (used for canonicals, sitemaps and OpenGraph URLs; defaults to `https://example.com`).

## Structure

```
src/
├── engines/                 Framework-free game logic (unit tested)
│   ├── core/                rng.ts (seeded PRNG), storage.ts (safe localStorage)
│   └── mahjong/
│       ├── types.ts         Slot (x, y in half-tile units, z layer), Face, Topology
│       ├── tiles.ts         144-tile set, match rules (flowers/seasons match in group)
│       ├── board.ts         Topology, free-tile rule, layout validation
│       ├── generator.ts     Solvable deal generator (plays the board out first)
│       ├── game.ts          State machine: select, match, undo, hint, shuffle, win/stuck
│       ├── fit.ts           Tile sizing, portrait rotation, >=36px tiles, no h-overflow
│       ├── layouts/         define.ts DSL + Turtle, Dragon, Pyramid, Fortress, Butterfly, Fish
│       └── render/          canvas.ts (renderer + hit testing), faces.ts (tile art)
├── components/
│   ├── game/                MahjongGame.tsx (Preact island), GameShell.astro
│   ├── seo/                 Seo.astro (meta/OG/Twitter/canonical/JSON-LD), Breadcrumbs.astro
│   └── content/             Faq.astro, HowToPlay.astro, LayoutCard.astro
├── content/layouts/*.md     SEO copy per layout (validated by src/content.config.ts)
├── data/                    site.ts, games.ts (catalogue), mahjong.ts (how-to + FAQ copy)
├── lib/                     seo/ (meta, JSON-LD builders), routes.ts (sitemaps), og.ts, layout-preview.ts
├── layouts/BaseLayout.astro
└── pages/
    ├── index.astro          Plays Turtle immediately
    ├── mahjong/             index.astro (gallery), [layout].astro (one page per layout)
    ├── games/index.astro    All games (planned ones listed, no pages yet)
    ├── og/[key].png.ts      Build-time OpenGraph PNGs
    ├── sitemap-index.xml.ts, sitemap-[section].xml.ts, robots.txt.ts, llms.txt.ts
    └── about, privacy, 404, [icon].png.ts
```

### Adding a layout

1. Add a `defineLayout(...)` to `src/engines/mahjong/layouts/index.ts` and list it in `LAYOUTS`.
2. Add `src/content/layouts/<id>.md` with the frontmatter fields from `src/content.config.ts`.

The tests check every layout for an even tile count, no overlaps, solvable deals across 50 seeds, and >=36px tiles on common phones. The page, sitemap entry, OG image and llms.txt line are generated automatically.
