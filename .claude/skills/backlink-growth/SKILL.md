---
name: backlink-growth
description: White-hat backlink work for freeplayclassic.com. Use when the user runs /backlink-growth or asks to find link opportunities (directories, game portals, GitHub awesome-* lists, pages with dead Flash games), draft outreach pitches, or log and review backlink progress. Reads and updates docs/backlink-launch-pack.md and docs/backlink-tracker.md.
---

# Backlink growth for Free Play Classic

Grow links to https://freeplayclassic.com the slow, safe way: real listings, useful resources and polite one-to-one outreach. Never buy links, swap links in bulk, post the same text in many places, or hide links.

## Files

- `docs/backlink-launch-pack.md`: what we pitch (linkable pages, the 25 target types, pitch templates). Read it first, every time.
- `docs/backlink-tracker.md`: the log. One row per target. Read it before suggesting anything, so you never repeat a target or a pitch.
- Linkable pages to offer: the strategy guides (`/blog/`), the American Mahjong guide and printable scorecard (`/mahjong/american-mahjong-guide/`), the "Embed this game" box on every game page, `/daily/`, and the game hubs. Check `src/content/blog/` and `src/data/catalog.ts` for the current list rather than trusting memory.

## Pick a mode

If the user did not say, ask which one with a single question: **research**, **pitch**, **log** or **report**.

### research

1. Ask for (or pick from the launch pack) one category: indie/startup directories, web game portals, GitHub curated lists, broken-Flash outreach, or educator/club resource pages.
2. Search the web for 5 to 10 candidates in that category. Useful queries:
   - Directories: `"submit your" free web app directory`, `alternatives to <a well-known game site>`.
   - Portals: `submit html5 game` plus `itch.io`, `game jolt`, `indiedb`.
   - GitHub: `awesome <game> list github`, `awesome pwa github`, `astro showcase`. Open the list's README and CONTRIBUTING: many accept only open-source projects. Skip those unless the user wants to open-source an engine.
   - Broken Flash: `"<game> online" "flash player"`, `"adobe flash" "<game>" free games for seniors`, `intitle:"free games" "requires flash"`. Confirm the link is actually dead (open it, or check the Wayback Machine) before calling it broken.
3. For each candidate record: URL, owner/contact page (public pages only), whether links are followed, submission rules, cost, and the best page of ours to offer. Drop anything paid, any link exchange, any site that sells "guest posts", and any page unrelated to games, puzzles, education or seniors' activities.
4. Remove anything already in the tracker (same domain counts as a duplicate).
5. Show the shortlist as a table and ask which to add. On a yes, append them to the tracker with status `Researched`.

### pitch

1. Take one tracker row the user names (or the oldest `Researched` row).
2. Read the target page and write a short, specific note: one personal line about their page, one line on what we offer and why it fits their readers, the URL, and a thank-you. Under 120 words. No flattery templates, no "I noticed you link to…" boilerplate.
3. Make each pitch different. Compare it with the pitch snippets already in the tracker; reword anything that repeats.
4. For broken-Flash targets, name the exact dead link and offer the closest live game page of ours as a replacement.
5. Show the draft. **Never send email, submit forms, open accounts or post anywhere yourself.** The user sends it from their own inbox or account.
6. When the user says it is sent, set the row to `Pitched` with today's date and a 10-word snippet of the pitch.

### log

Update rows the user reports on: `Replied`, `Live` (record the exact linking URL and anchor text), `Declined` or `No reply` (after 3 weeks; one polite follow-up is allowed, never more).

### report

Summarise the tracker: counts by status and category, live links with anchors, follow-ups due (pitched more than 14 days ago, no reply), and the next three targets worth doing. Suggest checking live links monthly.

## Rules

- Privacy: never put the user's name, email or other personal details in searches, URLs or forms. Use contact pages, not scraped personal emails.
- Honesty: describe the site accurately (34 free games, no sign-up). The American Mahjong guide is an independent reference, never "the official card". Arcade games are original games in classic genres; never imply they are the trademarked originals.
- Respect each site's rules on self-promotion. In communities (Reddit, forums), only suggest posting where resource posts are allowed, and suggest the user takes part in the community first.
- Keep `docs/backlink-tracker.md` as the single source of truth; dates as YYYY-MM-DD.
