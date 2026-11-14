---
title: "Nonogram (Picross) Logic Guide: Solve Without Guessing"
description: "Solve nonograms with pure logic: the overlap rule, edge forcing, crossing out gaps, joining and splitting runs, and a routine that works on 5×5 to 15×15 grids."
pubDate: 2026-11-14
category: Strategy
relatedGameId: nonogram
readingTime: 4
keywords: [nonogram strategy, how to solve nonograms, picross tips, griddlers logic, nonogram overlap method]
takeaways:
  - "Every clue lists the runs of filled cells in a row or column, in order, with at least one empty cell between runs."
  - "The overlap rule is the most useful technique: push a run as far left as it can go and as far right as it can go; cells covered both times must be filled."
  - "Mark cells you know are empty with a cross; empty cells are as useful as filled ones because they split the line into smaller sections."
  - "A filled cell near an edge forces the run it belongs to, so look at the first and last few cells of every line after each change."
  - "Alternate between rows and columns: a deduction in one direction almost always unlocks the crossing lines."
faqs:
  - q: Is a nonogram the same as Picross or Griddlers?
    a: Yes. Nonogram, Picross, Griddlers, Hanjie and Paint by Numbers are names for the same kind of picture logic puzzle.
  - q: Do I ever need to guess?
    a: Not on this site. Every puzzle is generated from its number and checked to have one solution that can be reached without guessing.
  - q: Where should I start on a new puzzle?
    a: With the lines whose clues add up to most of the line length, including the gaps between runs. A row of 10 with the clue 8 or 4 4 can be partly filled at once using the overlap rule.
  - q: What does a 0 clue mean?
    a: The whole line is empty. Cross out every cell in it, which often helps the crossing lines straight away.
---

A nonogram is a grid with numbers along the top and left side. Each number is the length of a run of filled cells in that row or column, in order, with at least one empty cell between runs. Fill the right cells and a picture appears. Nonograms look like guesswork at first, but every puzzle on this site can be solved by logic alone. These techniques are all you need, from a 5×5 warm-up to a 15×15 picture.

## Read the clues

A row clue of **3 1 2** in a 10-cell row means: a run of three filled cells, then at least one empty cell, then a single filled cell, then at least one empty cell, then a run of two. The runs appear in that order from left to right. Column clues read from top to bottom.

The minimum space a clue needs is the sum of the runs plus one gap between each pair: 3 + 1 + 2 + 2 gaps = 8 cells. In a 10-cell row there are 2 cells of slack.

## Technique 1: the overlap rule

This is the workhorse. Place every run as far left as possible, then as far right as possible. Any cell that is covered by the **same run** in both placements must be filled.

Example: a row of 10 with the clue **7**. Pushed left, the run covers cells 1 to 7. Pushed right, it covers 4 to 10. Cells 4 to 7 are covered both times, so fill them.

A quick shortcut: if a run is longer than the slack, it overlaps by (run length − slack) cells. In the 3 1 2 example the slack is 2, so the 3 overlaps by one cell (cell 3), while the 1 and the 2 do not overlap.

## Technique 2: lines that are full

When the minimum space equals the line length, there is no slack: the clue **4 5** in a 10-cell row fills cells 1 to 4, leaves cell 5 empty and fills cells 6 to 10. Spot these lines first.

## Technique 3: cross out what must be empty

Use the cross (mark) tool to note empty cells. Crosses matter because they split a line into sections. A run of four cannot fit into a section of three empty cells, so that section must be crossed out entirely. Once a line has all its runs placed, cross out every remaining cell.

## Technique 4: edge forcing

A filled cell close to the edge forces its run. If the first run in a row is 4 and cell 2 is filled, that cell must belong to the first run (nothing can come before it). The run therefore covers cell 2 and reaches at least cell 4, so cells 2 to 4 are filled. In the same way, if cell 1 is filled, the whole first run starts there: fill cells 1 to 4 and cross out cell 5.

## Technique 5: joining and splitting runs

When two filled cells sit close together, ask whether they can belong to the same run. If the longest run in the line is 3 and you have filled cells at positions 4 and 7, they must be in different runs, so at least one cell between them is empty. If the clue has only one run long enough to cover both, they must be in the same run, and every cell between them is filled.

## Technique 6: completed runs get borders

When a run is complete and you know which clue number it is, cross out the cell on each side. This often triggers new deductions in the crossing lines.

## Technique 7: work in both directions

Every new filled cell or cross is a fresh clue for the line that crosses it. After each change in a row, look at the columns it touches, and the other way round. Most puzzles are solved by bouncing between rows and columns, not by finishing one line at a time.

## A routine for any size

1. Cross out every line with a clue of 0.
2. Fill any line whose clue uses the full length.
3. Apply the overlap rule to every line with little slack.
4. Check the edges of every line for forced runs.
5. Cross out sections too small for any remaining run.
6. After each change, recheck the crossing lines.
7. Repeat until the picture appears.

## Sizes and practice

| Size | What to practise |
| --- | --- |
| 5×5 | Reading clues and the overlap rule |
| 10×10 | Edge forcing and crossing out small gaps |
| 15×15 | Joining and splitting runs, and switching between rows and columns |

The Check button highlights mistakes, which is useful while learning, and the mark mode (or right-click) lets you cross out cells without filling them. Start with a few 5×5 puzzles to make the overlap rule automatic, then move up. Each puzzle has a number, so you can replay or share a favourite picture.
