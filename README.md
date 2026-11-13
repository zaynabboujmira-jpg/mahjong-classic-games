# Mahjong & Classic Games

Fast, accessible Mahjong Solitaire, 4-player Mahjong against bots, solitaire card games, Sudoku and Minesweeper built with Astro, TypeScript, Tailwind CSS v4, Preact islands and HTML5 Canvas, deployed as a static site on Cloudflare Pages. See [docs/01-competitor-analysis-and-niche-strategy.md](docs/01-competitor-analysis-and-niche-strategy.md) for the strategy behind it.

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
│   ├── mahjong-table/       4-player Mahjong vs 3 bots
│   │   ├── tiles.ts         Tile kinds (shared numbering with the solitaire art), walls, melds
│   │   ├── classic.ts       Winning shapes, shanten, Hong Kong / Chinese faan scoring
│   │   ├── american.ts      This site's own American-style card (not the NMJL card), jokers, matching
│   │   ├── game.ts          Turn engine: draw, discard, claims by priority, kongs, flowers, Charleston, joker swaps, settlement
│   │   ├── ai.ts            Bots: efficiency + faan plans (classic), card-distance play (American)
│   │   └── render.ts        Canvas table: hand, opponents, rivers, latest discard
│   ├── solitaire/
│       ├── cards.ts         Shared 52-card model
│       ├── table.ts         PileRef, Hint, SolitaireEngine interface, TableSpec (per-game layout)
│       ├── klondike.ts      Draw 1/3, unlimited passes, undo, bestTarget, hint, auto-finish
│       ├── spider.ts        1/2/4 suits, 10 columns, deal rule, auto-clear of K-A runs, loop-free hints
│       ├── freecell.ts      Microsoft deal numbers, supermove limit, safe auto-play, solver-backed hints
│       ├── layout.ts        Generic table layout from a TableSpec, fan compression, hit/drop testing
│       └── render.ts        Canvas renderer (cached faces/back, selection, hint, drag)
│   ├── sudoku/
│   │   ├── grid.ts          Units, peers, candidate masks
│   │   ├── solver.ts        Bitmask backtracking: solution counting, random full grids
│   │   ├── logic.ts         Human-technique solver: grades puzzles and explains hints
│   │   ├── generator.ts     Seeded generator, 4 tiers set by the hardest technique needed
│   │   ├── game.ts          Digits, notes, undo, mistakes, hints, save/restore
│   │   ├── worker.ts        Generates off the main thread (source.ts caches and prefetches)
│   │   └── render.ts        Canvas grid renderer
│   └── minesweeper/
│       ├── game.ts          Levels, safe first click (mines placed after it), flood fill, flags, chord
│       └── render.ts        Canvas renderer, portrait rotation, minimum cell size
├── components/
│   ├── game/                MahjongGame.tsx, CardTable.tsx (shared solitaire UI),
│   │                        KlondikeGame/SpiderGame/FreeCellGame.tsx (thin islands), GameShell.astro,
│   │                        SudokuGame.tsx, MinesweeperGame.tsx, TableMahjongGame.tsx
│   ├── seo/                 Seo.astro (meta/OG/Twitter/canonical/JSON-LD), Breadcrumbs.astro
│   └── content/             Faq.astro, HowToPlay.astro, LayoutCard.astro, LevelPage.astro (per-level game page), TableMahjongPage.astro
├── content/layouts/*.md     SEO copy per layout (validated by src/content.config.ts)
├── content/solitaire/*.md   SEO copy, how-to steps and FAQ per solitaire variant
├── content/sudoku/*.md      One page per difficulty (easy, medium, hard, expert)
├── content/minesweeper/*.md One page per level (beginner, intermediate, expert)
├── content/mahjong-table/*.md One page per 4-player rule set (american, hong-kong, chinese)
├── data/                    site.ts, games.ts (catalogue), mahjong.ts (how-to + FAQ copy)
├── lib/                     seo/ (meta, JSON-LD builders), routes.ts (sitemaps), og.ts, layout-preview.ts
├── layouts/BaseLayout.astro
└── pages/
    ├── index.astro          Plays Turtle immediately
    ├── mahjong/             index.astro (gallery), [layout].astro (one page per layout),
    │                        american/hong-kong/chinese.astro (4-player tables)
    ├── solitaire/           index.astro (hub), [variant].astro (klondike, spider, freecell),
    │                        freecell/deal/[deal].astro (curated numbered deals, see src/data/freecell.ts)
    ├── sudoku/              index.astro (hub), [difficulty].astro
    ├── minesweeper/         index.astro (hub), [difficulty].astro
    ├── games/index.astro    All games from src/data/games.ts
    ├── og/[key].png.ts      Build-time OpenGraph PNGs
    ├── sitemap-index.xml.ts, sitemap-[section].xml.ts, robots.txt.ts, llms.txt.ts
    └── about, privacy, 404, [icon].png.ts
```

### Adding a layout

1. Add a `defineLayout(...)` to `src/engines/mahjong/layouts/index.ts` and list it in `LAYOUTS`.
2. Add `src/content/layouts/<id>.md` with the frontmatter fields from `src/content.config.ts`.

The tests check every layout for an even tile count, no overlaps, solvable deals across 50 seeds, and >=36px tiles on common phones. The page, sitemap entry, OG image and llms.txt line are generated automatically.
