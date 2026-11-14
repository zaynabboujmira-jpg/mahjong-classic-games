---
title: "Minesweeper Patterns and Probability: Solve Without Guessing"
description: "Learn the Minesweeper patterns that solve most boards: 1-1, 1-2, 1-2-1, 1-2-2-1, safe chording, and how to pick the safest cell when you have to guess."
pubDate: 2026-11-14
category: Strategy
relatedGameId: minesweeper
readingTime: 4
keywords: [minesweeper patterns, minesweeper strategy, minesweeper 1-2-1 pattern, minesweeper probability, how to win minesweeper expert]
takeaways:
  - "Most Minesweeper boards are solved by a handful of patterns along a straight edge: 1-1, 1-2, 1-2-1 and 1-2-2-1."
  - "Subtracting one number from its neighbour tells you how many mines sit in the cells only one of them touches; this one idea explains every pattern."
  - "Chording (opening all neighbours of a satisfied number) is fast and safe only when every flag around that number is certainly correct."
  - "When you must guess, choose the cell with the lowest chance of a mine, and prefer guesses that reveal useful information, such as corners and cells far from the numbers."
  - "On this site the first click is always safe, so the opening move never loses the game."
faqs:
  - q: Is Minesweeper all luck?
    a: No. Most of every board can be solved with logic. Some positions do force a guess, especially on Expert, but good players guess far less often and choose their guesses better.
  - q: What does the 1-2-1 pattern mean?
    a: Along a straight wall of unopened cells, a 1-2-1 means the mines are under the two 1s and the cell under the 2 is safe. It is one of the most common patterns on every board.
  - q: Should I flag every mine?
    a: Flags are optional for winning; you win by opening every safe cell. Flagging helps you chord quickly and keeps you from clicking a known mine, so most players flag the mines they are sure of.
  - q: What is the best cell to guess at the start?
    a: Your first click is safe on this site. If you later have to guess with no information, a corner is a good choice because it is more likely to open an area, and the mine density there is no higher than anywhere else.
---

Minesweeper looks like luck to people who have not played it much. Good players open huge parts of an Expert board without ever pausing to guess. The difference is a small set of patterns and one simple idea about counting. Learn them and you will solve most boards by logic, then handle the true guesses with probability instead of hope.

## The one idea: subtract neighbours

Every number tells you how many mines touch it. When two numbers sit next to each other, they share some of their unopened neighbours. Subtracting one from the other tells you how many mines are in the cells that only the larger number touches.

All of the patterns below are this subtraction applied to common shapes. If you remember the idea, you can work out patterns you have never seen before.

## Pattern 1: the 1-1 at a wall

A row of 1s runs along an edge of unopened cells. Starting from the end where the row meets a wall (or an opened area), the first 1 touches two unopened cells; the second 1 touches those two plus one more. The mine must be in the shared pair, so **the third cell along is safe**. Open it.

## Pattern 2: the 1-2

A 1 next to a 2 along an edge. The 2 touches one extra cell that the 1 does not. The 1 can provide at most one mine to the shared cells, so the 2 needs one more: **the extra cell next to the 2 is a mine**. Flag it.

## Pattern 3: the 1-2-1

A 1, a 2 and a 1 in a row against unopened cells. The mines are directly under (or beside) **the two 1s**, and the cell facing the 2 is safe. This pattern appears constantly; once you know it, you will see it on almost every board.

## Pattern 4: the 1-2-2-1

Four numbers in a row: 1, 2, 2, 1. The mines are under **the two 2s**, and the cells facing the 1s are safe. It is the 1-2 pattern applied from both ends.

## Pattern 5: corners and the 1 next to an opened area

A 1 that touches only one unopened cell has its mine there. Flag it, then look at its neighbours: every number that touches that mine has one fewer unknown mine, which usually unlocks the next step.

## Reduce the numbers as you go

After flagging a mine, mentally subtract it from every number around it. A 3 next to two flags is really a 1 for its remaining cells. Seeing numbers this way turns complex shapes into the simple patterns above.

## Chording safely

Chording opens all unopened neighbours of a number whose mines are already flagged. On this site you can chord by double-clicking, double-tapping or with a two-finger tap. It is the fastest way to clear a board, but a wrong flag turns a chord into an instant loss. Chord only around flags you are certain of, and never flag on a hunch.

## When you have to guess

Some positions cannot be solved by logic: two cells, one mine, and nothing else to tell them apart. When that happens:

1. **Do the rest of the board first.** Opening other areas may give you the information you need, and if you lose, you lose with less time spent.
2. **Count probabilities.** If a 1 touches three unopened cells, each has roughly a one-in-three chance of a mine. A random cell far from the numbers has a chance equal to the remaining mines divided by the remaining unopened cells. On Expert that is often lower than the cells beside the numbers.
3. **Prefer informative guesses.** A guess that, if safe, will reveal a number that solves the area is worth more than one that opens an isolated cell.
4. **Use the mine counter.** Near the end, the number of mines left can decide a guess. If one mine remains and two candidate shapes need one and two mines, only the first is possible.

## Know the boards

| Level | Size | Mines | Mine density |
| --- | --- | --- | --- |
| Beginner | 9×9 | 10 | about 12% |
| Intermediate | 16×16 | 40 | about 16% |
| Expert | 30×16 | 99 | about 21% |

Higher density means more forced guesses and more value in probability thinking. Practise patterns on Beginner and Intermediate until you spot them instantly, then take them to Expert.

## A routine for every board

1. Click once to open an area; the first click is always safe.
2. Flag obvious mines (a 1 with a single unopened neighbour).
3. Scan every edge for 1-1, 1-2, 1-2-1 and 1-2-2-1.
4. Reduce numbers by the flags around them and look again.
5. Chord around certain flags to clear quickly.
6. Guess only when nothing else works, and guess the safest, most informative cell.

With this routine your times drop and your win rate rises, and those unavoidable guesses become rare moments rather than every few clicks.
