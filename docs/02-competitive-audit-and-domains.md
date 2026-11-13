# Competitive audit: the "free*.org" game network, and domain selection

Audit date: 2026-11-13. Phase 1 of the growth plan.

## Sources and their limits

| Source | What it gave | Limit |
|---|---|---|
| Your 39 screenshots (SimilarWeb + Semrush SEOquake panels) | Monthly visits, traffic mix, Semrush organic traffic, traffic value, backlinks, referring domains, on-page counts for 19 sites | Third-party estimates, captured 2026-11-13 |
| Live fetch of the HTML and headers | Tech stack, scripts, headings, word counts, schema | Homepages only |
| Registry RDAP (PIR for .org, Verisign for .com) + rdap.org + DNS | Registration dates, registrars, nameservers; domain availability | RDAP does not show premium or aftermarket prices |
| In-browser lab measurements | Requests, transfer size, third-party hosts, load time, layout shift | Desktop, unthrottled, one run; not field data |
| **OpenSEO** | **Not used**: the account has 2 credits and a domain overview costs 100-300 | Keyword volumes below remain unvalidated |
| PageSpeed Insights API | **Not used**: the anonymous daily quota was exhausted | No Lighthouse scores or CrUX field data |

There is no `site-analyzer` skill installed in this environment, so the on-page checks were run directly from the terminal and the browser instead.

## 1. Who the competitor is

All sites are run by one operator:

- **Shared infrastructure:** every site loads its game shell from `turbo.freevideogames.org`, uses the same AdSense publisher account, and runs Google Tag Manager plus Plausible.
- **Same DNS and servers:** all sit on DNS Made Easy nameservers (`ns10`-`ns15`) behind nginx.
- **Header bidding:** the large sites add Freestar header bidding (`a.pub.network`).
- **Cross-linking:** every page carries a sidebar linking about 21 sibling domains. That is the network's internal linking, and the source of its strong "referral" share.

| Site | Visits / month | Search share | Semrush organic | Traffic value | Backlinks | Ref. domains | H1 | Words |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| freemahjong.org | **1.3M** | 39.8% | 116K | $77.2K | 3.91K | 4.45K | 0 | 33 |
| freepacman.org | 491K | 45.1% | 172K | $121K | 6.42K | 11K | 0 | 81 |
| freetennis.org | 147K | 35.5% | 8.2K | $3.94K | 1.94K | 2.01K | 0 | 30 |
| freeminesweeper.org | 88.9K | 32.1% | 10.9K | $5.46K | 2.41K | 3.25K | 1 | 142 |
| freeinvaders.org | 79.2K | 52.8% | 11.2K | $7.12K | 4.8K | 5.3K | 0 | 30 |
| freekong.org | 75.1K | 43.7% | 14.7K | $10.8K | 2.54K | 2.76K | 0 | 44 |
| theempiregame.com | 73.7K | 47.8% | 2.39K | $1.85K | 3.22K | 3.29K | 0 | 40 |
| freewordle.org | 59.5K | 32.3% | 1.71K | $813 | 525 | 563 | 0 | 38 |
| freepong.org | 55.8K | 42.8% | 3.02K | $2.68K | 1.03K | 1.14K | 0 | 134 |
| freeasteroids.org | 52.4K | 38.5% | 6.64K | $4.28K | 2.76K | 3.44K | 0 | 34 |
| happyhopper.org | 50.6K | 38.3% | 3.72K | $1.52K | 5.96K | 6.69K | 0 | 33 |
| freeflappybird.org | 33.3K | 30.3% | 2.94K | $1.18K | 901 | 980 | 0 | 31 |
| freegalaga.com | 32.5K | 44.4% | 3.93K | $2.44K | 1.49K | 1.65K | 0 | 44 |
| freefishy.org | 27.4K | 32.7% | 2.85K | $228 | 417 | 453 | 0 | 33 |
| freeqbert.org | 18.4K | 37.6% | 3.71K | $1.08K | 1.38K | 1.5K | 0 | 33 |
| freesimon.org | 18.1K | 42.3% | 3.39K | $228 | 2.13K | 4.7K | 0 | 30 |
| freesonic.org | 14.9K | 32.4% | 2.64K | $955 | 1.74K | 2.19K | 0 | 35 |
| freejetpac.org | 9.1K | 31.2% | 70 | $1.93K | 431 | 463 | 0 | 34 |
| freesolitaire.org | 6.8K | 33.0% | 48 | $1 | 1.65K | 2.07K | 0 | 30 |

**Network total ≈ 2.7M visits per month**, about half of it on freemahjong.org.

### Revenue estimate (an assumption, not a measurement)

At a typical casual-games display RPM of $4-10 per 1,000 pageviews and about 1.3 pageviews per visit, the network earns roughly **$15K-35K a month**, of which freemahjong.org is roughly $7K-17K. Treat this as an order of magnitude only: neither the RPM nor the pages per visit can be measured from outside.

## 2. Deep dive: the three requested domains

| | freemahjong.org | freepacman.org | freeminesweeper.org |
|---|---|---|---|
| Registered (RDAP) | 2006-03-16, GoDaddy | 2005-12-30, Gandi | 2010-01-09, GoDaddy |
| Expires | 2028-03-16 | 2027-12-30 | 2027-01-09 |
| Server / DNS | nginx / DNS Made Easy | nginx 1.14.2 / DNS Made Easy | nginx / DNS Made Easy |
| Game tech | Phaser (HTML5), ~201 KB gzipped first-party JS; links a separate "Flash Version" | custom JS bundle, ~21 KB gzipped | 372 `<img>` tiles in a classic Windows-style grid; tiny JS |
| Requests on load | 194 | 154 | 63 |
| Third-party hosts | **82** | 36 | 9 |
| Transfer on load | ~897 KB (~770 KB is ad tech) | ~1.06 MB (~506 KB ad tech) | ~308 KB |
| Load event (lab) | 5.1 s | 2.0 s | 2.0 s |
| Layout shift (lab, first 6 s) | 0 | 0 | 0 |
| Title | "Free Mahjong" | "Pacman - Play Game Instantly!" | "MineSweeper - Play the classic game here!" |
| Headings | none | none | 1 H1, 4 H2 |
| Words on page | ~45 | ~87 | ~170 |
| JSON-LD | none | none | none |
| Touch play | yes | no (keyboard) | mouse-style grid |

### Where your brief needs a correction

- **"Flash/Ruffle ports":** none of the three runs Ruffle or a .swf. freemahjong.org is HTML5 (Phaser) and only *links* to a Flash version. Keyboard-only ports are real across the network, though: every starred game carries "Requires keyboard".
- **"Zero H1-H3 and ~30 words":** true for most of the network, but freeminesweeper.org has an H1, four H2s and about 170 words. It is their best-optimised page.
- **"Our JS is under 21 KB":** the largest page is now **26.7 KB** gzipped (the 4-player Mahjong table). That is still under half of our 60 KB budget and a fraction of their first-party JS, before counting their ads.

## 3. Competitive advantage matrix

| Factor | Their network | Us | Who wins |
|---|---|---|---|
| Domain age and links | 15-20-year-old domains, 0.5K-11K referring domains each | new domain, 0 links | **Them**, by a lot |
| Brand / direct traffic | 40-60% direct (bookmarks, returning players) | none yet | **Them** |
| Topical depth per page | 30-170 words, no headings (except Minesweeper) | 600-1,200 words, H1-H3, how-to, FAQ, guides | **Us** |
| Structured data | none | VideoGame + SoftwareApplication, HowTo, FAQPage, BreadcrumbList on every game | **Us** |
| Programmatic coverage | one page per game | 6 Mahjong layouts, 3 four-player rule sets, 3 solitaires plus 11 FreeCell deal pages, 4 Sudoku and 3 Minesweeper levels | **Us** |
| Page weight | 300 KB-1 MB, up to 82 third-party hosts | ~27 KB JS max, no third parties yet | **Us** (ads will narrow this) |
| Mobile and keyboard | many games keyboard-only | touch, mouse and keyboard on every game, screen-reader announcements | **Us** |
| Game depth | single mode | layouts, difficulty tiers, rule presets, hints, undo, saved progress | **Us** |
| Cross-game discovery | sidebar on every page linking the whole network | header menu and the hubs; quick switch added in Phase 3 | parity after Phase 3 |
| Trademark exposure | many unlicensed ports of protected games (Pac-Man, Donkey Kong, Sonic, Frogger and others) | generic game types with original names and art | **Us** (lower takedown risk) |

**What this means:** we will not out-link a 2006 domain quickly. The winnable fronts are the **long tail** (layout, level, rule-set, deal and how-to queries they have no page for), **AI and answer engines** (our FAQ, HowTo and llms.txt give them something to quote), and **mobile players** their keyboard ports turn away. Head terms like "mahjong" need backlinks over time: game directories, puzzle communities and teacher resource lists, where a fast, ad-light, accessible site is easy to recommend.

## 4. Domain selection

Every name below was verified on **2026-11-13** in three ways:

- **Registry RDAP 404:** the `.org` registry (PIR) or `.com` registry (Verisign) has no record of it.
- **rdap.org 404:** the independent rdap.org lookup agrees.
- **DNS NXDOMAIN:** a lookup through Google's resolver (8.8.8.8) finds no such domain.

As a control, `freemahjong.org` returned data on all three. Availability can change at any moment, and RDAP does not reveal premium pricing, so confirm the price at checkout.

| # | Domain | Length | Why |
|---|---|---:|---|
| 1 | **playclassic.org** | 11 | Verb plus category: matches "play classic …" queries for every game we have. Short, brandable, and the .org mirrors the trust signal the competitor relies on. (playclassic.com is taken.) |
| 2 | **freeclassicgames.org** | 16 | Exact match for the head term "free classic games" and the same "free…" pattern their whole network uses. Less brandable, and exact-match domains carry little ranking weight on their own today. |
| 3 | **classicpuzzles.org** | 14 | Fits Mahjong, Sudoku, Minesweeper, word and memory games; a weaker fit for card and arcade games. |
| 4 | nofussgames.org | 11 | A brand promise that answers their own tagline ("No fuss. 100% free"). |
| 5 | nofussclassics.com | 14 | The best **.com** we found; brandable. |
| 6 | classicgamehub.org | 14 | Describes the hub model. |
| 7 | allclassicgames.com | 15 | Keyword-rich .com; reads as a catalogue. |
| 8 | tilesandcards.com | 14 | Brandable .com for the Mahjong and solitaire core. |
| 9 | cozyclassics.org | 12 | Warm, memorable; suits the relaxed, ad-light positioning. |
| 10 | puzzlenook.org | 12 | Short and brandable; puzzle-led. |

Also available but weaker: classicgameroom.org, puzzleparlor/tileparlor.org, mahjongandmore.org, classicpuzzlehub.com/.org, freeplayclassics.com/.org, nofussplay.com/.org, calmclassics.org, zenclassics.org.

### Top three, with the reasoning

1. **playclassic.org**, the recommendation. It is the shortest name that works for *every* game we will ever add, reads naturally in links ("play classic Mahjong at playclassic.org"), and puts the intent word "play" first. That earns clicks from results pages and links from directories.
2. **freeclassicgames.org**, the keyword play. It is the best exact match for a broad head term and sits alongside the competitor's naming. Choose it if you value keyword relevance over brand; pair it with a short brand name in the title.
3. **classicpuzzles.org**, the niche play. It is the strongest topical fit for the puzzle-heavy catalogue (Mahjong, Sudoku, Minesweeper, word and memory games) and weaker for arcade and cards.

Whichever you pick, register the matching .com too if it is free (nofussclassics.com is, playclassic.com is not), set `SITE_URL` in Cloudflare Pages, and keep one canonical domain. Do not split games across many exact-match domains the way the competitor does: one domain concentrates every link we earn.

## 5. Phase 2 note: game names and trademarks

"Wordle" (The New York Times), "Simon" (Hasbro) and "Pong" (Atari) are trademarks, and each game's name and distinctive look belong to its owner. Phase 2 therefore builds the same *kinds* of games under generic names with original designs:

| Asked for | Built as | Route |
|---|---|---|
| Wordle | **Word Guess**: daily and unlimited, 4, 5 or 6 letters | `/word-guess/` |
| Simon Says | **Color Memory**: a 4-colour sound-and-light sequence game | `/arcade/color-memory/` |
| Pong | **Paddle Ball**: one player against the computer or two players | `/arcade/paddle-ball/` |

The pages describe what each game is ("a five-letter word guessing game", "a memory sequence game", "a classic paddle and ball game") without borrowing the protected names.

## 6. Next steps when OpenSEO has credits

- Get a domain overview and ranked keywords for freemahjong.org and freeminesweeper.org (about 400-600 credits).
- Get keyword metrics for the seeds in docs/01 Appendix A, plus "word guess game", "daily word game", "memory game colors", "paddle ball game", "free classic games" and "play classic games".
