# Mahjong & Classic Games

Fast, accessible Mahjong Solitaire (and, soon, Klondike, Spider, FreeCell, Sudoku and Minesweeper) built with Astro, TypeScript, Tailwind and HTML5 Canvas, deployed on Cloudflare Pages.

Blueprint and strategy: [docs/01-competitor-analysis-and-niche-strategy.md](docs/01-competitor-analysis-and-niche-strategy.md).

## Commands

```bash
npm install
npm run dev        # http://localhost:4321
npm test           # engine + SEO unit tests (vitest)
npm run check      # astro type check
npm run build      # static output in dist/
```

Set `SITE_URL` (see `.env.example`) so canonical URLs, sitemap and OpenGraph use the real domain.

## Architecture

| Folder | Purpose |
|---|---|
| `src/engines/` | DOM-free TypeScript game logic. `mahjong/` holds tile definitions, layouts, free-tile rules, the reverse-play solvable generator, the game state machine and the Canvas renderer. |
| `src/components/game/` | Preact island: toolbar, settings, win dialog, keyboard and screen-reader support. |
| `src/components/seo/` | `<Seo>` (title/meta/canonical/OG), `<JsonLd>`, `<Breadcrumbs>`. |
| `src/lib/seo/` | Typed JSON-LD builders and title/description helpers. |
| `src/data/games.registry.ts` | Single source of truth for games, routes and nav. |
| `src/content/` | Markdown content collections (per-game and per-layout copy, how-to, FAQ). |
| `src/pages/` | Routes: `/`, `/games/`, `/games/[slug]/`, `/mahjong/`, `/mahjong/[layout]/`, trust pages, `llms.txt`. |

### Adding a Mahjong layout

1. Create `src/engines/mahjong/layouts/<slug>.ts` with `defineLayout(...)` (half-tile units, 2x2 per tile, even tile count, no floating tiles).
2. Register it in `src/engines/mahjong/layouts/index.ts` with a difficulty and blurb.
3. Add `src/content/layouts/<slug>.md` with title, description, intro, tips and at least three FAQs.
4. `npm test` verifies the layout is well-formed and that deals generate and replay to a win.

The page `/mahjong/<slug>/`, its sitemap entry, breadcrumbs, JSON-LD and gallery card are generated automatically.

## Deploy (Cloudflare Pages)

Build command `npm run build`, output directory `dist`, environment variable `SITE_URL`. `public/_headers` sets caching and security headers. Update `public/robots.txt` with the real sitemap URL.
