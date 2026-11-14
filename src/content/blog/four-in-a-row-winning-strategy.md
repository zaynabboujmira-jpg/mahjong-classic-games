---
title: "Four in a Row Winning Strategy: Centre, Threats and Zugzwang"
description: "Win more Four in a Row games: play the centre column, build double threats, know odd and even rows, and stop your opponent's traps before they form."
pubDate: 2026-11-14
category: Strategy
relatedGameId: four-in-a-row
readingTime: 4
keywords: [four in a row strategy, connect four strategy, how to win four in a row, four in a row tips, odd even threat]
takeaways:
  - "The centre column is part of more possible lines of four than any other column, so the first player should start there and both players should fight for it."
  - "A single threat can be blocked; two threats at once (a double threat) usually wins, so build positions where one disc creates two lines."
  - "Never play directly under a square your opponent needs: filling the cell below their threat lets them complete four."
  - "On a 7×6 board, the first player generally wants threats on odd rows and the second player on even rows, which decides many endgames."
  - "With perfect play the first player wins by starting in the centre, but human games are decided by threats that go unnoticed."
faqs:
  - q: Who wins Four in a Row with perfect play?
    a: On the standard 7-column, 6-row board, the first player can always win by starting in the centre column and playing perfectly. Starting anywhere else lets the second player draw or win.
  - q: What is the best first move?
    a: The centre column. It belongs to the most possible lines of four, and every other opening gives the second player an easier game.
  - q: What is a double threat?
    a: A position where you have two different ways to complete four in a row. Your opponent can block only one, so you win with the other.
  - q: What do odd and even threats mean?
    a: A threat is a square that would complete four for you. Counting rows from the bottom, the first player usually gets to fill odd-row squares late in the game and the second player even-row squares, so threats on the right rows tend to win.
---

Four in a Row is easy to learn: drop discs into a 7-column, 6-row grid and line up four across, down or diagonally. It is also a game that rewards planning. Experienced players win by controlling the centre, creating two threats at once and understanding which rows each player is likely to fill at the end. Here is how to do the same.

## 1. Start in the centre

The centre column is part of more possible lines of four than any other column: horizontal lines through the middle, both diagonals and the vertical line all pass through it. If you move first, drop your first disc in the centre. If you move second and the centre is taken, the column next to it or the centre again (on top of your opponent's disc) are the usual replies.

## 2. Value central columns over the edges

A disc on an edge column can join far fewer lines than one in the middle. Early in the game, play in the three middle columns when you can. Edge columns become useful later, when they complete a specific line.

## 3. Always check for immediate threats

Before every move, look for two things:

1. **Can I win right now?** Look for three of your discs in a line with an open, playable fourth square.
2. **Can my opponent win next move?** If so, block that square now.

This takes a second and prevents most losses. The computer on Easy sometimes misses a threat; on Hard it never does.

## 4. Do not play under your opponent's threat

A square is only playable when the cell below it is filled. If your opponent has three in a row waiting for a square that is still floating, do not drop a disc into the cell below it. That would let them complete four on their next move. Good players often build threats on high squares precisely to make certain columns unplayable for you.

## 5. Build double threats

A single threat can always be blocked. Two threats at once usually cannot. Look for moves that create two lines of three with different open squares, or a line of three with open squares at both ends of a horizontal line (an "open three" on the bottom row is a classic win: _ X X X _).

Another strong pattern is two threats stacked in the same column, one directly above the other. When your opponent blocks the lower one, you complete four with the upper one.

## 6. Understand odd and even rows

Number the rows 1 to 6 from the bottom. Late in the game, when columns fill up, play often becomes forced. A useful rule of thumb on the standard board:

- The **first player** benefits from threats on **odd rows** (1, 3, 5).
- The **second player** benefits from threats on **even rows** (2, 4, 6).

The reason is that as the board fills, each player tends to be the one who gets to place a disc in those rows. If you have a threat on the "right" row for you, your opponent may eventually be forced to play underneath it. This idea, called **zugzwang**, decides many close games.

## 7. Block early, not late

Two of your opponent's discs with open space on both sides can become an open three next move. Blocking at two is cheaper than blocking at three, when you may face a double threat. Keep an eye on diagonals; they are the easiest lines to miss.

## 8. Count the columns that are safe to play

Toward the end, list each column and ask: if I play here, does it give my opponent a winning square? Columns that are safe for you but unsafe for your opponent are your reserve moves. When you run out of safe moves, you are forced to help your opponent, so try to keep more safe columns than they have.

## Three patterns worth memorising

- **The 7-trap.** Three discs arranged like the number 7 (a horizontal pair with a diagonal running down from one end) create two threats on neighbouring rows. It is one of the most common winning shapes in real games.
- **The bottom-row open three.** Two discs side by side on the bottom row with both neighbouring squares empty must be blocked at once. If you wait until it is three, your opponent wins.
- **The stacked threat.** Two of your threats directly above each other in one column. Your opponent cannot block the lower square without giving you the upper one.

Look for these shapes in your own position, and also in your opponent's: spotting one early is far easier than escaping it late.

## A simple game plan

1. Open in the centre (or contest it as the second player).
2. Play the middle columns early.
3. Before every move: can I win, and must I block?
4. Never fill the cell under an opponent's threat.
5. Look for moves that create two threats at once.
6. Late in the game, aim for threats on your rows: odd for the first player, even for the second.

## Practise against the computer

The game on this site has three computer levels. **Easy** sometimes plays a random move, which is good for practising double threats. **Medium** blocks direct threats, so you will need to plan two moves ahead. **Hard** uses a deeper search and will punish a disc played under its threat. You can also play two players on one device, and undo lets you replay any position that went wrong.
