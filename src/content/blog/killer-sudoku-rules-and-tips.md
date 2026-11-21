---
title: "Killer Sudoku Rules and Tips: Cages, Sums and the 45 Rule"
description: "How to play Killer Sudoku: the cage rules, the sum combinations worth memorising, the 45 rule with innies and outies, and a routine for your first puzzle."
pubDate: 2026-11-21
category: Rules
relatedGameId: killer-sudoku
play:
  name: Killer Sudoku
  href: /sudoku/killer/
readingTime: 4
keywords: [killer sudoku, how to play killer sudoku, killer sudoku rules, killer sudoku tips, killer sudoku 45 rule, killer sudoku combinations]
takeaways:
  - "Killer Sudoku keeps the normal rules: every row, column and 3×3 box holds the digits 1 to 9 exactly once."
  - "The grid is divided into cages with dashed outlines. The digits in a cage add up to the small number in its corner and never repeat inside it."
  - "Some sums can be made only one way, such as 3 in two cells (1 and 2) or 24 in three cells (7, 8 and 9). Find those cages first."
  - "Every row, column and box adds up to 45. Subtracting the cages inside a box reveals the total of the cells that stick out."
faqs:
  - q: "Can digits repeat in a Killer Sudoku cage?"
    a: "No. Each digit appears at most once in a cage, even when the cage crosses from one box into another. A cage of two cells adding up to 4 must be 1 and 3, never 2 and 2."
  - q: "Does Killer Sudoku have starting numbers?"
    a: "Classic Killer Sudoku has none: the cage sums are the only clues. Easier puzzles, including the Easy level on this site, add some starting digits to give you a foothold."
  - q: "Is Killer Sudoku harder than normal Sudoku?"
    a: "It usually takes longer, because you have to add up cages before the normal Sudoku techniques start working. Once a few digits are placed, it plays much like an ordinary Sudoku."
  - q: "What does an innie mean?"
    a: "A cell inside a box (or row or column) that belongs to a cage poking out of it. When all the other cages in the box are complete, the 45 rule tells you what the innie must be."
---

Killer Sudoku looks empty at first: a grid with few or no digits, just dashed shapes with small numbers in their corners. Those shapes are where all the clues are. This guide explains the rules, the sums worth knowing by heart and the 45 rule, the one technique that unlocks almost every puzzle.

## The rules

Killer Sudoku has two sets of rules, and both apply at once.

**The Sudoku rules.** Fill the 9×9 grid so that every row, every column and every 3×3 box contains the digits 1 to 9 exactly once.

**The cage rules.** The grid is divided into **cages**, groups of connected cells drawn with a dashed outline. The small number in the top-left corner of each cage is its **sum**:

- the digits in a cage must add up to its sum, and
- no digit may repeat inside a cage.

Every cell belongs to exactly one cage. A cage can sit inside a single box or cross from one box into another; the no-repeat rule applies either way. A good Killer Sudoku has exactly one solution.

## Cages with only one answer

Some sums can be made only one way. Memorise these, because they are where most puzzles begin:

| Cells | Sum | Digits |
| --- | --- | --- |
| 2 | 3 | 1, 2 |
| 2 | 4 | 1, 3 |
| 2 | 16 | 7, 9 |
| 2 | 17 | 8, 9 |
| 3 | 6 | 1, 2, 3 |
| 3 | 7 | 1, 2, 4 |
| 3 | 23 | 6, 8, 9 |
| 3 | 24 | 7, 8, 9 |
| 4 | 10 | 1, 2, 3, 4 |
| 4 | 11 | 1, 2, 3, 5 |
| 4 | 29 | 5, 7, 8, 9 |
| 4 | 30 | 6, 7, 8, 9 |

A two-cell cage adding up to 17 does not tell you which cell is 8 and which is 9, but it does tell you that no other cell in that row, column or box can hold an 8 or a 9 if the cage lies wholly inside it. That alone can place digits elsewhere.

Other sums narrow things down without settling them. A two-cell cage of 10 can be 1+9, 2+8, 3+7 or 4+6, but never 5+5, so it never contains a 5.

## The 45 rule

The digits 1 to 9 add up to **45**, so every row, column and box adds up to 45. This is the key to Killer Sudoku.

Look at a box. Some cages fit entirely inside it; others poke out. Add up the cages that fit inside. Whatever is left of 45 is the total of the remaining cells in the box.

- **Innies.** If one cage pokes out of a box and only one of its cells is inside the box, that cell is an innie. If the other cages in the box add up to 38, the innie is 45 − 38 = 7.
- **Outies.** If a cage starts inside the box and has one cell outside it, that cell is an outie. Add up every cage that touches the box, subtract 45, and you have the outie's value.

The same works for rows and columns, and for groups of two or three boxes (90 or 135). When you are stuck, look for a box, row or column almost covered by whole cages.

## Pencil marks for cages

Normal Sudoku notes list the digits a cell can hold given its row, column and box. In Killer Sudoku, the cage limits them further. A three-cell cage adding up to 7 can only use 1, 2 and 4, so its cells never need a 3, 5 or 9 in their notes.

As a cage fills in, recheck it: once a cage of three adding up to 15 has a 9, its other two cells must add up to 6 without a 3, so they are 1 and 5 or 2 and 4.

## A routine for your first puzzle

1. **Find the unique cages** from the table and note their digits.
2. **Apply the 45 rule** to every box that is almost covered by whole cages.
3. **Place singles**: a cell with one possible digit, or a digit with one possible cell in a row, column or box.
4. **Update the cages** you touched, and repeat.

On the Hard level there is often no obvious first move, so the 45 rule comes first. On the Easy level, the starting digits usually give you a few singles straight away.

## Common mistakes

- **Repeating a digit in a cage.** Two 5s in a cage of 10 add up, but break the rule.
- **Forgetting the box rule** when a cage crosses two boxes. Each part of the cage still has to obey its own box.
- **Doing sums in your head.** Write the cage total next to the box total when using the 45 rule. Small slips are the most common reason a Killer Sudoku goes wrong.

## Play Killer Sudoku online

The [Killer Sudoku game on this site](/sudoku/killer/) draws the cages with dashed outlines and sums, and its Fill notes button lists only the digits that can still complete each cage. A repeated digit or a full cage with the wrong total turns red, and a hint explains the next step. Start on Easy, which has small cages and some starting digits, then move to Hard. If you are new to Sudoku itself, [How to Play Sudoku](/blog/how-to-play-sudoku-beginners/) covers the basic techniques, and the [classic Sudoku game](/sudoku/) has four levels without cages.
