---
title: "FreeCell Winning Tactics: Win Nearly Every Deal"
description: "FreeCell tactics that win: free the Aces first, keep free cells empty, value empty columns, count your supermove and plan the whole move before you start."
pubDate: 2026-11-14
category: Strategy
relatedGameId: freecell
readingTime: 4
keywords: [freecell strategy, freecell tips, how to win freecell, freecell supermove, freecell deal 11982]
takeaways:
  - "Almost every FreeCell deal can be won: of the original 32,000 numbered deals, only deal #11982 is known to be unsolvable."
  - "Free cells are a loan, not storage: every card parked in a cell reduces how many cards you can move at once, so empty them quickly."
  - "An empty column is worth more than a free cell, because it doubles the length of run you can move in one go."
  - "You can move a run of (free cells + 1) × 2^(empty columns) cards at once; count it before you start a big move."
  - "Plan from the Aces and Twos backwards: find where they are buried and work out which cards must move to reach them."
faqs:
  - q: Can every FreeCell game be won?
    a: Nearly all of them. Among the 32,000 deals of the original Windows game, only deal #11982 has no solution. Later analysis of much larger sets of deals found only a tiny fraction unsolvable.
  - q: What is a supermove in FreeCell?
    a: A supermove moves a whole run of cards at once. It is a shortcut for moving the cards one by one through free cells and empty columns, so its maximum length depends on how many of each you have.
  - q: Should I put cards on the foundations as soon as possible?
    a: Usually yes for Aces and Twos. Higher cards are sometimes better left on the table for a while, because you may need them as a place to put a lower card of the other colour.
  - q: What does the deal number mean?
    a: Each number fixes exactly which card goes where. Deal #1 on this site is the same layout as deal #1 in classic Windows FreeCell, so you can replay and share specific deals.
---

FreeCell is the solitaire game where luck almost disappears. All 52 cards are face up from the start, and nearly every deal can be won. When you lose, it is because of a move you made, which makes FreeCell the perfect game to get better at. These tactics will take you from winning sometimes to winning almost every time.

## The rules in one minute

Cards are dealt into eight columns. You have four **free cells**, each holding one card, and four **foundations** to build up by suit from Ace to King. In the columns you build down in alternating colours: a red 6 on a black 7. You may move one card at a time, but because the cells and empty columns let you shuffle cards around, you can move whole runs as long as you have enough space.

## 1. Find the Aces and Twos before you move

Spend the first ten seconds of each game looking, not clicking. Where are the four Aces? How many cards cover each? The low cards are your first goal, and the columns that bury them are where your early moves should go. A quick plan beats many quick moves.

## 2. Treat free cells as a loan

Every card you put in a free cell must come back out, and while it sits there it costs you mobility. With four empty cells you can move a run of five cards; with one empty cell, only two. A good habit is to put a card in a cell only when you can already see how it will leave, for example onto a foundation two moves later.

## 3. Value empty columns above everything

An empty column is better than a free cell. It can hold a whole run, not just one card, and it doubles your capacity to move sequences. When you are deciding between two lines of play, prefer the one that empties a column, even if it is a few moves longer.

## 4. Count your supermove

The number of cards you can move as one run is:

**(empty free cells + 1) × 2^(empty columns)**

| Empty cells | Empty columns | Longest run you can move |
| --- | --- | --- |
| 4 | 0 | 5 |
| 2 | 1 | 6 |
| 3 | 1 | 8 |
| 1 | 2 | 8 |
| 4 | 1 | 10 |

When you move a run into an empty column, that column does not count, so the limit is halved. Check the number before you start a long rearrangement. Running out of space halfway is a classic way to lose.

## 5. Build long, clean runs

Long runs in alternating colours, starting from a King, are the safest place for cards. They do not block anything, and they can be moved as a unit when you have space. Avoid placing a card on a run if it means burying a low card you will need soon.

## 6. Do not rush cards to the foundations

Aces and Twos should go up at once. Higher cards are different: a red 5 on the foundation can no longer hold a black 4 that is blocking something. As a rule of thumb, send a card up when both cards of the opposite colour that could sit on it are already up or no longer needed.

## 7. Break up columns that bury low cards

Some columns hold two or three low cards under a pile of high ones. These are the columns that decide the game. Work out the order in which the covering cards can go elsewhere (onto other runs first, free cells last) and dig steadily. One well-planned dig often wins the game on its own.

## 8. Keep one cell free for emergencies

Filling all four cells leaves you with no way to make a single move except onto a run or a foundation. Unless the next move clears several cards, keep at least one cell empty. That spare cell is what lets you recover when a plan goes wrong.

## 9. Learn from famous deals

Numbered deals let you replay the same game until you find the solution. [Deal #11982](/solitaire/freecell/deal/11982/) is famous for being the only unsolvable deal in the original 32,000; trying it shows how a game can be lost before the first move. [Deal #1](/solitaire/freecell/deal/1/) is the classic warm-up, and [deal #617](/solitaire/freecell/deal/617/) and [deal #32000](/solitaire/freecell/deal/32000/) are good next challenges.

## 10. Use hints and undo to study

The hint button on this site comes from a built-in solver, so it shows a move that is part of a real solution when one is found. Use it sparingly: try to find your own plan first, then check it against the hint. Undo lets you test ideas freely. A deal you finish with undo is still a deal that taught you something.

## A simple routine

1. Locate the Aces and Twos.
2. Empty one column as early as possible.
3. Keep at least one free cell open.
4. Count your supermove before every long move.
5. Send low cards to the foundations at once, high cards only when they are no longer needed.

With these habits, losing a FreeCell game becomes rare, and every loss shows you exactly which move to change.
