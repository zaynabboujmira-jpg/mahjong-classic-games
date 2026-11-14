---
title: "Advanced Sudoku Techniques: Pairs, X-Wing and Swordfish"
description: "Solve hard and expert Sudoku without guessing: pencil marks, hidden singles, naked and hidden pairs, pointing pairs, X-Wing, XY-Wing and Swordfish explained."
pubDate: 2026-11-14
category: Strategy
relatedGameId: sudoku
readingTime: 4
keywords: [advanced sudoku techniques, sudoku x-wing, sudoku swordfish, xy-wing sudoku, how to solve hard sudoku]
takeaways:
  - "A well-made Sudoku never needs guessing: every hard puzzle on this site can be solved by logic, and the techniques below are the toolkit."
  - "Pencil marks (candidates) are essential beyond medium level; most advanced techniques work by removing candidates, not by placing digits directly."
  - "Naked and hidden pairs let two cells claim two digits, so those digits can be removed from the rest of the row, column or box."
  - "An X-Wing uses one digit in two rows (or columns) that is limited to the same two columns; the digit can be removed from the rest of those columns."
  - "Swordfish is an X-Wing on three rows and three columns, and an XY-Wing uses three two-candidate cells to remove one digit."
faqs:
  - q: Do I ever need to guess in Sudoku?
    a: Not in a properly made puzzle. Every Sudoku on this site has exactly one solution reachable with logic alone. If you feel you must guess, there is a technique you have not spotted yet.
  - q: Which technique should I learn after hidden singles?
    a: Naked pairs and pointing pairs (locked candidates). They appear in almost every hard puzzle and are much easier to spot than X-Wings.
  - q: What is the difference between an X-Wing and a Swordfish?
    a: An X-Wing uses two rows and two columns; a Swordfish uses three of each. The logic is the same, but a Swordfish is harder to see because the digit does not have to appear in every one of the nine crossing cells.
  - q: Should I use auto notes?
    a: Auto notes save time and remove copying mistakes, which lets you focus on the logic. Writing notes by hand is good practice, so try both and see which you enjoy.
---

Easy Sudoku can be solved by looking for the one empty cell that fits. Hard and expert puzzles cannot. At some point every cell has two or three possible digits, and progress comes from removing possibilities instead of placing numbers. This guide walks through the techniques in the order you will need them, from the basics to Swordfish. Each one is pure logic; none of them is a guess.

## Start with pencil marks

Write every possible digit (candidate) in each empty cell. Do it completely, once, and keep the marks up to date as you place digits. Every technique from naked pairs onwards works by deleting candidates, so a missing candidate can lead you to a wrong conclusion. The auto notes button fills them in for you without mistakes.

## Singles: the foundation

- **Naked single:** a cell with only one candidate left. Place it.
- **Hidden single:** a digit that can go in only one cell of a row, column or box, even if that cell has other candidates. Place it there.

Scan for hidden singles digit by digit: pick a 1, check every box, row and column, then move to 2. Medium puzzles are mostly hidden singles.

## Naked pairs (and triples)

If two cells in the same row, column or box both have exactly the same two candidates, for example {4, 7}, those two digits must go in those two cells. Remove 4 and 7 from every other cell in that unit.

The same works for three cells sharing three candidates (a naked triple), even if not every cell holds all three, such as {2, 5}, {5, 9} and {2, 9}.

## Hidden pairs

If two digits can appear in only the same two cells of a unit, those cells must hold those digits. Remove all other candidates from those two cells. Hidden pairs are harder to see than naked pairs because the cells look crowded, so look at digits, not cells.

## Pointing pairs and box/line reduction

These two are called **locked candidates**:

- **Pointing:** inside a box, a digit appears only in one row (or column). It must be in that row within the box, so remove it from the rest of that row outside the box.
- **Box/line reduction (claiming):** in a row, a digit appears only inside one box. Remove it from the other cells of that box.

Hard puzzles on this site use pairs and locked candidates heavily. Learn to check every box for pointing digits after each placement.

## X-Wing

Pick one digit. Find two rows where that digit can go in exactly two cells, and those cells are in the **same two columns**. The four cells form a rectangle. In each row the digit takes one of its two spots, and the two rows must use different columns. So the digit fills both columns within those rows, and you can remove it from every other cell in those two columns.

The same works with columns and rows swapped. An X-Wing is easiest to find by scanning one digit at a time and looking for rows with exactly two candidates.

## Swordfish

A Swordfish extends the X-Wing to three rows and three columns. Find three rows where the digit has only two or three candidates, and all of those candidates fall within the same three columns. The digit must appear once in each of those rows and therefore once in each of those columns, so remove it from the other cells of those three columns.

Swordfish patterns are rare, but expert puzzles sometimes need one. If you are stuck on an expert grid and have checked pairs and X-Wings, look for a Swordfish.

## XY-Wing

Find a cell with two candidates, say {A, B}: the **pivot**. Look for two other two-candidate cells it can see (same row, column or box): one with {A, C} and one with {B, C}. These are the **pincers**.

Whatever the pivot becomes, one of the pincers must be C. If the pivot is A, the {A, C} pincer is C; if the pivot is B, the {B, C} pincer is C. So any cell that sees **both** pincers cannot be C. Remove it there.

## A routine for hard puzzles

1. Fill in all candidates.
2. Place every naked and hidden single you can find.
3. Check each box for pointing pairs, then each row and column for box/line reductions.
4. Look for naked pairs and triples, then hidden pairs.
5. Scan digit by digit for X-Wings, then Swordfish.
6. Look for XY-Wings among the two-candidate cells.
7. After any removal, go back to step 2. New singles usually appear.

## Which level needs what

| Level | Hardest technique you will need |
| --- | --- |
| Easy | Naked singles |
| Medium | Hidden singles |
| Hard | Pairs and locked candidates |
| Expert | X-Wing, XY-Wing and Swordfish |

Puzzles on this site are graded by the hardest technique the solver needs, so each level is a good practice ground for one step of this guide. If an expert puzzle feels impossible, it is not; it is waiting for one of the patterns above.
