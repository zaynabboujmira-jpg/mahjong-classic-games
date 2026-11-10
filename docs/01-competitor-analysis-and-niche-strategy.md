# Step 1 Blueprint: Competitor Analysis & Niche Strategy

**Project:** Mahjong & Casual Web Games platform (Astro + TypeScript + Tailwind + HTML5 Canvas on Cloudflare Pages)
**Date:** 2026-11-10
**Primary benchmark:** https://mahjon.gg/ (live audit performed on desktop 1024px and mobile 375px viewports)

> Data provenance. Everything in Section 1 was observed directly from mahjon.gg's HTML, response headers, loaded resources and rendered UI on 2026-11-10. Keyword volumes in Sections 2 and 3 are **indicative ranges** from public SEO tooling knowledge; the connected OpenSEO account has 2 credits remaining, so they could not be re-validated in this session. Re-run `research_keywords` / `get_ranked_keywords` against the seed lists in Appendix A once credits are topped up.

---

## 0. Executive Summary

mahjon.gg is a minimalist, single-layout Mahjong Solitaire page built around 2012 by the solitr.com developer (Sinopia Olive Ltd, London). It wins on simplicity and raw load speed, but it is essentially frozen: one Turtle layout, no timer, no scores, no dark mode, no accessibility, no content, no structured data, no sitemap, and a cookie wall plus AdSense. Its organic position (Ahrefs lists it at roughly DR 46 with an estimated traffic value around $172K/yr) is held by domain age and a clean UX, not by SEO work.

The opportunity is a **"mahjon.gg done right" platform**: equal or faster load, dozens of named layouts each with its own indexable page, senior-friendly accessibility, a timer/speedrun layer, a zero-distraction mode, and a hub of five complementary classics that share one engine, one design system and one SEO framework. Programmatic `/games/[slug]` and `/mahjong/[layout]` routes turn the long tail of "mahjong turtle", "mahjong dragon", "mahjong titans" and similar queries into dedicated landing pages, something mahjon.gg cannot do with one URL.

---

## 1. mahjon.gg: Strengths & Weaknesses Analysis

### 1.1 Observed facts (live audit)

| Area | Observation |
|---|---|
| HTML document | 7.1 KB (2.1 KB gzipped). Title: `Mahjong`. Meta description: "Play Mahjong for free. No download or registration needed." (55 chars). No `<html lang>`. No H1/H2. ~170 words of body text (About / Legal / Credits modal). |
| Structured data | None. No JSON-LD, no OpenGraph, no Twitter Card, no canonical, no robots meta. |
| Crawl infrastructure | `robots.txt` is empty. `sitemap.xml` returns 404. Single indexable URL plus `/legal`. |
| Rendering | DOM-based: 576 absolutely-positioned `<div class="tile">` elements (two per visible tile), SVG tile art as CSS backgrounds. No `<canvas>`. |
| Payload | CSS 425 KB decoded (tile art inlined in the stylesheet). JS 228 KB (Ember-era `application.js` + a `shim.min` polyfill fallback). Total transfer ~179 KB compressed. |
| Delivery | Fastly CDN (`X-Served-By: cache-...`, `X-Cache: HIT`), HTTP/3 advertised, HSTS. `Cache-Control: max-age=600`. `Last-Modified: 16 Jan 2023` on the HTML. |
| Lab timings (cold, this session) | TTFB ~400 ms, DOMContentLoaded ~630 ms, load ~1.15 s, LCP ~1.7 s. |
| Monetization | Google AdSense (`adsbygoogle.js`) gated behind an opt-in cookie-consent banner (`cookieconsent` lib, "Decline" / "Allow cookies"). No ads actually rendered until consent. |
| Analytics | Universal Analytics `UA-26841383-3` (dead product since July 2023) plus a GA4 tag `G-MWT1MS3NC4`. Custom "nobounce" and "beacon" events every 25 minutes to inflate engagement. |
| Game features | New Game, Hint, Undo, Shuffle (with shuffle counter). One layout (classic Turtle). No timer, no score, no best-time, no streaks, no daily puzzle, no seed sharing, no layout picker, no tile-set picker, no sound toggle, no settings. |
| Cross-promotion | Top tab bar linking out to sister domains: solitr.com (Klondike), solitr.com/spider-solitaire-two-suits, sudoku.game. Each game is a separate domain, so no shared authority. |
| Accessibility | Tiles are plain `<div>`s with no `role`, no `aria-label`, no `tabindex`; only 7 focusable elements on the page. No keyboard play. No reduced-motion handling. No high-contrast or large-tile option. `prefers-color-scheme: dark` is ignored (`color-scheme: normal`). |
| Mobile (375 x 812) | Board renders at roughly 55% of viewport width with a large empty band above it (vertical centering bug). Tiles are ~28 px wide, below the 44 px touch target guideline. The four game tabs collapse to icons only. |
| Ownership | "About" modal: Jo Liss / Sinopia Olive Limited, 11 Raven Wharf, London. Same stack and owner as solitr.com and sudoku.game. |

### 1.2 Strengths (what we must match or beat)

1. **Instant playability.** No landing page, no "Play" button: the game is the page. Zero clicks to first move.
2. **Lean first load.** ~180 KB over the wire, HTML served from Fastly edge cache, LCP well under 2.5 s on desktop.
3. **Clean, ad-free first impression.** Ads only load after consent; many EU/UK users never see one.
4. **Simple, readable tile art.** High-contrast vector tiles on a light felt background; the Chinese character tiles are legible.
5. **Domain authority from age.** Live since ~2012, cross-linked from solitr.com and sudoku.game which are themselves strong.
6. **Trust signals.** Real company name and address, privacy policy, opt-in consent.

### 1.3 Weaknesses & vulnerabilities (ranked by exploitability)

| # | Vulnerability | Evidence | How we exploit it |
|---|---|---|---|
| 1 | **Single layout, single URL** | Only the Turtle layout; no `/layouts/*` pages | Ship 30+ named layouts, each a crawlable page (`/mahjong/dragon`, `/mahjong/pyramid`, ...). Capture every "mahjong [layout]" query. |
| 2 | **Zero technical SEO** | No sitemap, empty robots, no canonical, no OG, no JSON-LD, no H1, no `lang` | Full OpenSEO stack (Section 4). We will out-rank on every rich-result and social-share surface. |
| 3 | **No content layer** | ~170 words, all in a modal | Rules, strategy guides, layout encyclopedia, FAQ with `FAQPage` schema, "how to play" with `HowTo`. |
| 4 | **No engagement loop** | No timer, score, best time, streak, daily puzzle, seed | Timer + speedrun mode, daily seeded puzzle with shareable result, local best-times, streaks. Raises return visits and session length (which also lifts ad RPM). |
| 5 | **Mobile layout bug & tiny touch targets** | Board at ~55% width, ~28 px tiles, dead space above | Canvas renderer with viewport-fit scaling, portrait-optimised layouts, 44 px+ hit areas, pinch-zoom. |
| 6 | **Accessibility is absent** | No ARIA, no keyboard, no large-tile / high-contrast, dark mode ignored | Senior-friendly mode (large tiles, high contrast, slower animations), keyboard navigation, screen-reader tile announcements, `prefers-reduced-motion`, dark theme. |
| 7 | **Stale stack** | Last-Modified Jan 2023, dead UA tag, Ember-era bundle, `document.write` polyfill | Astro islands, zero-JS shell, modern analytics (Cloudflare Web Analytics or self-hosted), 100/100 Lighthouse target. |
| 8 | **Fragmented portfolio** | Sister games on separate domains | One domain, one nav, shared layout/engine, internal links concentrate authority. |
| 9 | **Cookie wall before play on EU traffic** | Opt-in banner over the board | Consent-free default (no tracking cookies; ads optional or contextual only) so there is nothing to consent to. |
| 10 | **No localisation** | English only, no `hreflang` | Phase 2: `/de/`, `/fr/`, `/es/`, `/pt-br/` with translated layout pages (strong demand for "mahjong kostenlos", "mahjong gratuit", "mahjong gratis"). |

### 1.4 Scorecard (1-10, seo-geo-aeo rubric)

| Dimension | Score | Note |
|---|---|---|
| SEO (technical + content) | 3 | Ranks on brand/age alone; no on-page fundamentals. |
| GEO (AI-engine citability) | 2 | Nothing for an AI engine to cite: no facts, no entity schema, no author. |
| AEO (snippets / PAA) | 1 | No question headings, no FAQ, no how-to. |
| UX / performance | 7 | Fast and simple; loses points on mobile and accessibility. |
| Engagement / retention | 2 | No reason to return beyond habit. |

---

## 2. Niche Gap Identification

### 2.1 Market context

- Casual browser gaming is dominated by evergreen "search-and-play" genres: Solitaire, Mahjong, Sudoku, Minesweeper, Crossword/Word. These are **habit queries**: people type the game name into Google daily, which is why one-page sites like mahjon.gg and solitr.com survive on age alone.
- The incumbents fall into two camps: (a) ad-heavy portals (Arkadium, 247games, Agame, Mahjongg.com, MSN) with intrusive interstitials and slow loads, and (b) single-developer minimalist pages (mahjon.gg, freemahjong.org, mahjong.ooo) with no content or SEO depth. **Nobody owns "fast + beautiful + deep + accessible".**
- Demographic skew for Mahjong Solitaire and Solitaire is 45+ and majority women; this group under-served on accessibility, and is also the highest-RPM display audience.

### 2.2 Gap matrix

| Gap | Demand signal (indicative, US + global) | Competition | Why we win | Priority |
|---|---|---|---|---|
| **Named layout pages** ("mahjong turtle", "mahjong dragon", "mahjong pyramid", "mahjong castle", "mahjong titans", "mahjong dimensions", "mahjong connect") | Each 10K to 300K+/mo; "mahjong titans" and "mahjong dimensions" are brand-name layouts people still search by name | Mostly portals with one URL per game, few per layout | Programmatic `/mahjong/[layout]` with unique art, difficulty, tile count, best-time board, and 300+ words of unique copy | P0 |
| **Senior / accessible mode** ("large tile mahjong", "easy mahjong for seniors", "big solitaire cards") | Long-tail but zero-competition and extremely high intent | Nearly none implement it properly | Toggle for large tiles, high contrast, reduced motion, screen-reader support; separate landing page per game (`/mahjong/large-tiles`) | P0 |
| **Zero-ad / zero-distraction mode** | Rising "no ads" modifiers on every game query ("solitaire no ads", "mahjong without ads") | Portals cannot offer it; minimalist sites have no mode system | Contextual ads only on hub/content pages, never on the board; optional one-click "Focus Mode" that hides chrome | P0 |
| **Timer / speedrun / daily challenge** ("mahjong daily challenge", "mahjong timer", "solitaire daily") | Daily-puzzle searches grew sharply after Wordle; "daily challenge" is a retention mechanic Microsoft Solitaire proved | Portals have it but behind heavy UX; minimalist sites do not | Seeded daily board per game, share card (emoji grid + time), local streaks, optional leaderboard later | P1 |
| **Programmatic SEO on modifiers** ("free", "online", "no download", "full screen", "classic", "offline") | Modifiers add 20-40% on top of head terms | Mostly unexploited beyond title tags | Modifier-aware titles/H1s and FAQ answers per game page, not separate thin pages (avoid doorway-page risk) | P1 |
| **Mahjong Solitaire knowledge hub** (rules, strategy, tile meanings, layout history, difficulty ratings) | "how to play mahjong solitaire", "mahjong tiles meaning", "mahjong strategy" each 5K to 50K/mo | Thin, outdated content on portals | Authoritative articles with `Article` + `FAQPage` + `HowTo` schema, internal links to the play page | P1 |
| **Offline / PWA play** ("mahjong offline", "play solitaire offline") | Modest but loyal | Few browser games are installable | Service worker + manifest; "Install" prompt; works on planes | P2 |
| **Localised layout pages** ("mahjong kostenlos", "mahjong gratuit", "mahjong gratis", "маджонг") | DE/FR/ES/PT/RU each comparable to US volume per capita | Weak local competition | i18n routing in Phase 2 once English is proven | P2 |

### 2.3 Positioning statement

> **The fastest, cleanest place to play Mahjong Solitaire and classic puzzle games on any device, with every layout you remember, a daily challenge worth coming back for, and an interface anyone can read.**

---

## 3. Top 5 High-Demand Complementary Games

Selection criteria: (1) head-term search volume, (2) audience overlap with Mahjong Solitaire (45+, puzzle-minded, repeat daily play), (3) implementability on one shared Canvas engine within the first 90 days, (4) programmatic SEO depth (variants and modifiers).

| Rank | Game | Head terms (indicative monthly, US) | Why it pairs with Mahjong | Programmatic depth | Build effort |
|---|---|---|---|---|---|
| 1 | **Klondike Solitaire** | "solitaire" 2M+, "klondike solitaire" 300K+, "solitaire free" 200K+ | Same demographic, same session pattern, same "clear the board" satisfaction. The single largest casual query on the web. | Draw 1 / Draw 3, Vegas scoring, timed, daily | Medium |
| 2 | **Spider Solitaire** | "spider solitaire" 1M+, "spider solitaire 2 suits" 100K+ | Highest second-visit rate among solitaire variants; players alternate Mahjong and Spider as "long-form" games. | 1 / 2 / 4 suits as separate pages | Medium (reuses Klondike engine) |
| 3 | **FreeCell** | "freecell" 600K+, "freecell solitaire" 150K+ | Deterministic, every deal solvable, numbered deals are a cult feature (deal #11982). Numbered-deal pages are a programmatic SEO goldmine. | `/freecell/deal/[n]` for famous deals; difficulty tiers | Low (reuses engine + solver) |
| 4 | **Sudoku** | "sudoku" 2M+, "sudoku easy/medium/hard/expert" 50-200K each, "killer sudoku" 100K+ | Mahjon.gg's own sister site proves the pairing; grid-logic audience with daily habit. | Difficulty pages, daily, killer/variants | Medium (generator + solver) |
| 5 | **Minesweeper** | "minesweeper" 700K+, "minesweeper online" 100K+ | Nostalgia-driven, same "Windows classic" cohort as Mahjong Titans and FreeCell. Very light to build. | Beginner / Intermediate / Expert / custom pages | Low |

**Runner-ups (Phase 2):** Mahjong Connect / Mahjong Dimensions (same tiles, different rules: cheap to add, 150K+ combined), 2048, Pyramid & TriPeaks Solitaire, Crossword / Mini Crossword, Word Search, Jigsaw.

**Cross-promotion mechanics:**
- Persistent "More games" rail under the board (not a popup) with the other four games and the player's unfinished games.
- "You beat today's Mahjong in 4:12. Try today's Spider challenge" interstitial card on win screens only.
- Shared local profile (IndexedDB): streaks, best times and settings (large-tile, dark, reduced motion) carry across games.
- Internal linking: every layout/variant page links to its parent hub, siblings and one cross-genre page.

---

## 4. SEO Architecture Framework (OpenSEO)

### 4.1 Principles

1. **One domain, one authority.** All games live under the same host. No subdomains.
2. **Play is the page.** Every game URL renders the playable board above the fold (server-rendered shell, Canvas hydrates in an Astro island). Content sits below the board, not instead of it.
3. **Programmatic but not thin.** Each generated route has unique structured data, unique copy (300+ words), unique images and unique internal links. Pure modifier duplicates (free/online/no-download) stay on the parent page as FAQs.
4. **Static first.** Cloudflare Pages serves prebuilt HTML; no server round-trip for play. Dynamic bits (daily seed, leaderboards) come from Pages Functions / Workers KV / D1 and hydrate after paint.
5. **Core Web Vitals budget:** LCP < 1.2 s, INP < 100 ms, CLS = 0 on 4G mid-tier mobile. JS on a game page < 60 KB gzipped; CSS < 15 KB; board visible before any JS executes (SSR static tile preview, swapped by Canvas on hydrate).

### 4.2 URL taxonomy

```
/                                 Home hub: featured games, daily challenges
/games/                           All games index
/games/[slug]/                    Game landing + play  (mahjong-solitaire, klondike-solitaire, spider-solitaire, freecell, sudoku, minesweeper)
/mahjong/                         Mahjong hub (layout gallery)
/mahjong/[layout]/                Layout play page (turtle, dragon, pyramid, castle, fortress, cat, butterfly, ...)
/mahjong/large-tiles/             Senior / accessible mode landing
/solitaire/[variant]/             klondike-draw-1, klondike-draw-3, spider-1-suit, spider-2-suits, spider-4-suits
/freecell/deal/[number]/          Famous numbered deals (programmatic, capped and curated)
/sudoku/[difficulty]/             easy, medium, hard, expert, killer
/minesweeper/[difficulty]/        beginner, intermediate, expert
/daily/                           Today's challenges across games
/daily/[slug]/[yyyy-mm-dd]/       Archive (noindex after 30 days, keep canonical to /daily/[slug]/)
/guides/[slug]/                   How-to, rules, strategy, tile meanings
/faq/                             Site-wide FAQ with FAQPage schema
/about/, /privacy/, /contact/     Trust pages
/sitemap-index.xml                Index of per-section sitemaps
/robots.txt, /manifest.webmanifest, /og/[slug].png (generated OG images)
```

### 4.3 Schema (JSON-LD) plan

| Page type | Types | Key properties |
|---|---|---|
| Every page | `WebSite` (with `SearchAction` on home only), `Organization` (`sameAs` to socials), `BreadcrumbList` | name, url, logo, publisher |
| Game / layout / variant page | `VideoGame` (subtype of `Game`, which is what Google reads) + `SoftwareApplication` | `name`, `applicationCategory: "GameApplication"`, `operatingSystem: "Web"`, `offers { price: 0 }`, `genre`, `numberOfPlayers`, `playMode: "SinglePlayer"`, `gamePlatform: "Web browser"`, `aggregateRating` (only once real ratings exist), `image`, `inLanguage` |
| Daily challenge | `VideoGame` + `Event`-like `datePublished` on a `CreativeWork` | seeded date, `isBasedOn` parent game |
| Guide | `Article` or `HowTo` (+ `FAQPage` when a Q&A block is present) | author `Person`, `dateModified`, `speakable` |
| FAQ sections | `FAQPage` | injected from content collection frontmatter |

Schema is generated by one typed helper (`src/lib/seo/schema.ts`) from the game registry so every route is consistent and testable.

### 4.4 Metadata & OpenGraph

- `<title>` pattern: `{Game or Layout} – Play Free Online, No Download | {Brand}` (keep under 60 chars; brand suffix dropped automatically when it would overflow).
- Meta description per route from the registry, 140-155 chars, with a concrete differentiator ("30 layouts", "daily challenge", "large-tile mode").
- `og:*` and `twitter:card=summary_large_image` on all pages; OG images generated at build (Satori + resvg) per game/layout with a real board render.
- `canonical` self-referencing on every page; query strings (`?seed=`, `?layout=`) canonicalise to the clean route.
- `hreflang` scaffolded but only emitted when a locale exists (Phase 2).
- `<html lang="en">`, `theme-color`, `color-scheme: light dark`.

### 4.5 Sitemaps & crawl control

- `@astrojs/sitemap` with a custom `serialize` to set `changefreq`/`priority` per section and to split into `sitemap-games.xml`, `sitemap-mahjong.xml`, `sitemap-guides.xml`, `sitemap-daily.xml`.
- Daily archive pages: included for 30 days, then `noindex,follow`.
- `robots.txt`: allow all, `Sitemap:` pointer, disallow `/api/`, `/og/raw/`.
- IndexNow ping from the Cloudflare Pages deploy hook (OpenSEO `submit_indexnow_urls` or a 10-line Worker) so new layout pages are discovered within hours.

### 4.6 Performance architecture

- Astro static output; islands only for the game (`client:load`) and the "More games" rail (`client:idle`).
- One shared Canvas engine (`@games/engine`) with per-game modules; tile and card sprites as a single WebP/AVIF atlas with SVG fallback; preloaded via `<link rel=preload as=image>`.
- Fonts: system stack by default; one variable font subset for headings, `font-display: swap`.
- Tailwind with `@tailwindcss/vite`, purge at build; no runtime CSS-in-JS.
- Cloudflare: Pages + `_headers` for immutable asset caching, Early Hints, Brotli, HTTP/3, Cache Rules for HTML (`s-maxage=3600, stale-while-revalidate`), Web Analytics (cookieless) instead of GA.
- No third-party script on the critical path. Ads (if any) load `client:visible` below the fold, after first interaction, never over the board.

### 4.7 GEO / AEO layer

- Every game page carries a short definitional paragraph ("Mahjong Solitaire is a single-player tile-matching game…"), a "How to play" ordered list and a 5-question FAQ with `FAQPage` schema; this covers featured snippets and AI-overview citation.
- Guides carry named author (`Person` with `sameAs`), `dateModified`, cited sources and original data (e.g. our own layout difficulty statistics from solve rates), which gives AI engines something unique to cite.
- `llms.txt` at root summarising the site, games and canonical URLs.

### 4.8 Measurement

- OpenSEO project for the domain: rank tracker on the head terms in Appendix A, monthly `get_search_console_performance`, quarterly `run_site_audit`.
- Cloudflare Web Analytics + a self-hosted lightweight event beacon (game_start, game_win, time_to_win, layout, mode) to Workers Analytics Engine.
- Core Web Vitals via `web-vitals` library sampled at 10%.

---

## 5. Proposed Astro Project Structure

```
online-games/
├── .github/
│   └── workflows/
│       ├── ci.yml                     # typecheck, lint, unit tests, Lighthouse CI budget
│       └── deploy.yml                 # Cloudflare Pages deploy + IndexNow ping
├── public/
│   ├── favicon.svg
│   ├── robots.txt
│   ├── manifest.webmanifest
│   ├── sprites/                       # tile/card atlases (webp/avif/svg)
│   └── sounds/
├── src/
│   ├── pages/
│   │   ├── index.astro                # Home hub
│   │   ├── games/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro           # getStaticPaths from game registry
│   │   ├── mahjong/
│   │   │   ├── index.astro            # Layout gallery
│   │   │   ├── large-tiles.astro
│   │   │   └── [layout].astro         # Programmatic layout pages
│   │   ├── solitaire/[variant].astro
│   │   ├── freecell/deal/[number].astro
│   │   ├── sudoku/[difficulty].astro
│   │   ├── minesweeper/[difficulty].astro
│   │   ├── daily/
│   │   │   ├── index.astro
│   │   │   └── [slug]/[date].astro
│   │   ├── guides/
│   │   │   ├── index.astro
│   │   │   └── [...slug].astro        # Content collection
│   │   ├── faq.astro
│   │   ├── about.astro
│   │   ├── privacy.astro
│   │   ├── contact.astro
│   │   ├── og/[slug].png.ts           # Build-time OG image endpoint (Satori)
│   │   ├── llms.txt.ts
│   │   └── 404.astro
│   ├── layouts/
│   │   ├── BaseLayout.astro           # <head>, SEO component, theme, skip links
│   │   ├── GameLayout.astro           # Board-first layout with below-fold content
│   │   └── ArticleLayout.astro
│   ├── components/
│   │   ├── seo/
│   │   │   ├── Seo.astro              # title/meta/canonical/OG/twitter/hreflang
│   │   │   ├── JsonLd.astro
│   │   │   └── Breadcrumbs.astro
│   │   ├── game/
│   │   │   ├── GameShell.astro        # SSR static preview + island mount point
│   │   │   ├── GameIsland.tsx         # client:load island (Preact or Solid)
│   │   │   ├── Toolbar.tsx            # New / Hint / Undo / Shuffle / Timer
│   │   │   ├── WinDialog.tsx          # Result, share card, next-game CTA
│   │   │   ├── SettingsPanel.tsx      # Large tiles, contrast, motion, sound, theme
│   │   │   └── MoreGamesRail.astro    # client:idle
│   │   ├── content/
│   │   │   ├── HowToPlay.astro
│   │   │   ├── Faq.astro              # Emits FAQPage schema
│   │   │   └── LayoutCard.astro
│   │   └── ui/                        # Button, Dialog, Toggle, Icon (Tailwind)
│   ├── games/                         # Pure TypeScript engines, zero DOM deps
│   │   ├── engine/
│   │   │   ├── canvas/                # Renderer, sprite atlas, input (pointer/keyboard), a11y announcer
│   │   │   ├── rng.ts                 # Seeded PRNG (daily challenges, shareable seeds)
│   │   │   ├── timer.ts
│   │   │   ├── storage.ts             # IndexedDB profile: settings, bests, streaks
│   │   │   └── types.ts
│   │   ├── mahjong/
│   │   │   ├── rules.ts
│   │   │   ├── generator.ts           # Guaranteed-solvable deal generation
│   │   │   ├── solver.ts              # Hints + difficulty rating
│   │   │   ├── layouts/               # One .ts per layout (turtle.ts, dragon.ts, ...) + index
│   │   │   └── render.ts
│   │   ├── solitaire/                 # Shared card engine
│   │   │   ├── cards.ts
│   │   │   ├── klondike.ts
│   │   │   ├── spider.ts
│   │   │   └── freecell.ts
│   │   ├── sudoku/
│   │   │   ├── generator.ts
│   │   │   └── solver.ts
│   │   └── minesweeper/
│   │       └── board.ts
│   ├── content/                       # Astro content collections (Markdown/MDX)
│   │   ├── config.ts                  # Zod schemas
│   │   ├── games/                     # One .md per game: copy, FAQ, metadata
│   │   ├── layouts/                   # One .md per Mahjong layout
│   │   ├── variants/                  # Solitaire/Sudoku/Minesweeper variants
│   │   └── guides/
│   ├── data/
│   │   ├── games.registry.ts          # Single source of truth: slug, name, engine, schema fields, keywords
│   │   └── nav.ts
│   ├── lib/
│   │   ├── seo/
│   │   │   ├── schema.ts              # Typed JSON-LD builders (VideoGame, SoftwareApplication, FAQPage, HowTo, BreadcrumbList)
│   │   │   ├── meta.ts                # Title/description templates with length guards
│   │   │   └── sitemap.ts             # serialize hooks per section
│   │   ├── daily.ts                   # Date → seed
│   │   └── analytics.ts               # Cookieless beacon
│   ├── styles/
│   │   ├── global.css                 # Tailwind layers, tokens, dark + high-contrast themes
│   │   └── tokens.css
│   └── env.d.ts
├── functions/                         # Cloudflare Pages Functions
│   ├── api/
│   │   ├── daily/[slug].ts            # Today's seed + stats (KV)
│   │   └── score.ts                   # Optional leaderboard (D1)
│   └── _middleware.ts                 # Security headers
├── scripts/
│   ├── generate-og.ts
│   ├── indexnow.ts
│   └── lighthouse-budget.json
├── tests/
│   ├── unit/                          # Engines, generators, schema builders
│   └── e2e/                           # Playwright: play-through, a11y (axe), CWV smoke
├── _headers                           # Cloudflare cache/security headers
├── _redirects
├── astro.config.mjs                   # site, sitemap, cloudflare adapter, prefetch
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── wrangler.toml
```

### Key architectural decisions

- **Engines are DOM-free TypeScript** under `src/games/`, unit-tested in isolation; the Canvas renderer is the only thing that touches the browser. This keeps the islands tiny and the logic portable (same code powers daily seeds in a Worker).
- **`games.registry.ts` is the single source of truth** for routes, nav, sitemap, schema and OG images. Adding a layout is one `.ts` file plus one `.md` file.
- **Content collections hold the SEO copy**, so writers can edit FAQ/how-to text without touching components; Zod schemas enforce required fields (title length, description length, at least 3 FAQs).
- **Islands framework:** Preact (3 KB) or Solid for the game UI chrome; the board itself is plain Canvas with no framework in the render loop.

---

## 6. Success Metrics (first 6 months)

| Metric | Target |
|---|---|
| Lighthouse (mobile) on game pages | Performance 95+, Accessibility 100, SEO 100 |
| Field LCP / INP / CLS (p75) | < 1.5 s / < 150 ms / 0 |
| Indexed URLs | 150+ (6 games, 30+ layouts, 15 variants, 25 guides, daily hub) |
| Top-20 rankings | 10 of the Appendix A head/long-tail terms |
| Return-visitor share | > 35% (daily challenge + streaks) |
| Median session length on Mahjong | > 8 min |

---

## 7. Next Step (Step 2 proposal)

1. Scaffold the Astro project to the structure above with the SEO layer, registry, and one working game (Mahjong Solitaire, Turtle layout) on Canvas.
2. Define the first 12 layouts and their content pages.
3. Set up the Cloudflare Pages pipeline with Lighthouse CI budgets.
4. Once OpenSEO credits are available, validate Appendix A and create the rank tracker.

---

## Appendix A: Keyword seed lists for OpenSEO validation

**Mahjong head & layout terms:** mahjong, mahjong solitaire, free mahjong, mahjong games, mahjongg, mahjong titans, mahjong dimensions, mahjong connect, mahjong turtle, mahjong dragon, mahjong pyramid, mahjong castle, mahjong fortress, mahjong online free no download, mahjong full screen, mahjong daily challenge, large tile mahjong, mahjong for seniors, how to play mahjong solitaire, mahjong tiles meaning, mahjong strategy.

**Complementary games:** solitaire, klondike solitaire, solitaire free, solitaire no ads, spider solitaire, spider solitaire 2 suits, spider solitaire 4 suits, freecell, freecell solitaire, freecell deal 11982, sudoku, sudoku easy, sudoku hard, sudoku expert, killer sudoku, daily sudoku, minesweeper, minesweeper online, minesweeper expert, play minesweeper free.

**Modifiers to test on each head term:** free, online, no download, full screen, classic, offline, no ads, for seniors, daily.

## Appendix B: Competitor shortlist for Step 2 deep-dives

mahjongg.com, 247mahjong.com, arkadium.com/games/mahjongg-solitaire, themahjong.com, mahjong-game.com, freemahjong.org, mahjong.ooo, solitr.com, solitaired.com, sudoku.com, minesweeper.online.
