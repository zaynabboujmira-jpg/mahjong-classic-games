# Blog topic research

How the guide topics in `src/content/blog/` were chosen, so they can be re-checked against real search data later.

## Batch 3 (2026-11-21): 4 beginner guides from Semrush data

Chosen from the Semrush US broad-match exports of 2026-11-20 (13 seed games), ranked by volume against keyword difficulty (KD). The cluster volume is the summed monthly volume of the close variants one guide can rank for. Full analysis: `seo-action-plan.md` (private, git-ignored).

| Guide | Primary keyword (US vol / KD) | Cluster vol (median KD) |
| --- | --- | --- |
| `how-to-set-up-a-chess-board` | chess board setup (60,500 / 19) | 186,000 (21.5) |
| `chess-strategies-for-beginners` | chess strategies for beginners (74,000 / 15) | 161,000 (25) |
| `how-to-play-mahjong-beginners` | how to play mahjong (40,500 / 28) | 146,000 (24) |
| `how-to-play-sudoku-beginners` | how to play sudoku (40,500 / 27) | 97,000 (41) |

The same release added `/sudoku/printable/` for the printable cluster ("sudoku printable" 22,200 / KD 30; "free printable sudoku games" 3,600 / KD 17).

## Batch 2 (2026-11-14): 10 rules and how-to questions

**Method.** The plan was to rank People Also Ask and informational questions by search volume with OpenSEO. The OpenSEO account had 2 credits, and the keyword-metrics call was refused for lack of credits, so **no search volumes were collected**. Instead, with the owner's agreement, each candidate question was checked with a standard web search to confirm that Google surfaces it widely (many dedicated pages from rules sites, encyclopedias and card-game portals), and that none of the first 12 guides already answers it. Treat the order below as editorial judgement, not as a volume ranking.

| # | Question people ask | Guide | Game |
| --- | --- | --- | --- |
| 1 | What are the odds of winning solitaire? Is every game winnable? | `klondike-solitaire-odds-of-winning` | klondike |
| 2 | How do you play backgammon? | `how-to-play-backgammon-beginners` | backgammon |
| 3 | How does Mahjong scoring work? | `mahjong-scoring-faan-explained` | mahjong-4p (Hong Kong table) |
| 4 | What do the Mahjong tiles mean? | `mahjong-tiles-meaning-guide` | mahjong-solitaire |
| 5 | How do you play Hearts / what is shooting the moon? | `hearts-rules-and-shooting-the-moon` | hearts |
| 6 | How does bidding work in Spades (Nil, bags)? | `spades-bidding-nil-and-bags-explained` | spades |
| 7 | What is en passant? How does castling work? | `chess-special-moves-castling-en-passant` | chess |
| 8 | How do you play dominoes (Draw and Block)? | `how-to-play-dominoes-draw-and-block` | dominoes |
| 9 | How do you play Pyramid Solitaire? | `pyramid-solitaire-rules-and-strategy` | pyramid |
| 10 | How do you never lose at tic tac toe? | `tic-tac-toe-how-to-never-lose` | tic-tac-toe |

Every rule stated in these guides was checked against this site's engines (`src/engines/`), so the articles describe how our games actually play (for example: Hearts passing cycle and classic moon scoring, Spades Nil ±100 and the 10-bag penalty, Hong Kong 3-faan minimum and our faan-to-points table, Pyramid's two recycles in Classic mode).

## To do once OpenSEO has credits

1. Run `get_keyword_metrics` on the 22 guide target keywords (the `keywords` front-matter lists) to get volume and difficulty.
2. Run `research_keywords` on seeds such as `mahjong rules`, `solitaire`, `backgammon`, `spades card game` and `sudoku techniques` to find the next batch of questions.
3. Re-order or re-title guides where a close variant has clearly more volume.

## Batch 1 (2026-11-14): 12 strategy guides

Topics were specified by the site owner (one guide per core game); see the commit "Add strategy guides blog, embed-this-game box and backlink toolkit".
