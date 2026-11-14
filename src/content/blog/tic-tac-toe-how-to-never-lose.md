---
title: "How to Never Lose at Tic Tac Toe (and When You Can Win)"
description: "Tic tac toe strategy that never loses: the best first move, how to answer corners and edges as O, how forks win, and why perfect play is always a draw."
pubDate: 2026-11-14
category: Strategy
relatedGameId: tic-tac-toe
readingTime: 4
keywords: [how to never lose tic tac toe, tic tac toe strategy, how to win tic tac toe, best first move tic tac toe, noughts and crosses strategy]
takeaways:
  - "Tic tac toe is a solved game: with perfect play from both sides it always ends in a draw, so the goal is to never lose and to punish mistakes."
  - "Every turn, check in this order: win if you can, block if you must, make a fork (two threats at once), block your opponent's fork, then take the centre, a corner or an edge."
  - "As X, starting in a corner sets the most traps; starting in the centre is also safe and simple."
  - "As O, answer a corner opening with the centre, and a centre opening with a corner; an edge reply to a corner loses against good play."
  - "The computer on this site's Unbeatable level searches every possible game, so a draw against it is the best possible result."
faqs:
  - q: Can you always win at tic tac toe?
    a: No. If both players play perfectly, every game is a draw. You can only win when your opponent makes a mistake, which is common among beginners.
  - q: What is the best first move in tic tac toe?
    a: A corner or the centre. Both are safe. The corner gives your opponent more ways to go wrong, because the only safe reply is the centre.
  - q: What is a fork in tic tac toe?
    a: A move that creates two lines of two at once, each with an empty third square. Your opponent can block only one, so you win with the other.
  - q: Can I beat the Unbeatable computer?
    a: No. It uses a full minimax search, so it never makes a losing move. A draw is the best result, and it is a good test that your own play is perfect.
---

Tic tac toe (noughts and crosses) is usually the first strategy game anyone learns, and it is small enough to be completely solved: with perfect play, every game is a draw. That does not make it pointless. Knowing the right moves means you will never lose, and you will win every time your opponent slips. Here is the complete method.

## The rule that decides every move

On every turn, run through this checklist and play the first item that applies:

1. **Win:** if you have two in a line with the third square empty, take it.
2. **Block:** if your opponent has two in a line with the third square empty, take it.
3. **Fork:** make a move that creates **two** lines of two at once. Your opponent can only block one.
4. **Block a fork:** if your opponent could make a fork next turn, stop it, ideally by making a two-in-a-line of your own that forces them to block.
5. **Centre:** take the centre if it is free.
6. **Opposite corner:** if your opponent holds a corner, take the opposite one.
7. **Corner:** take any free corner.
8. **Edge:** take an edge square.

Following this order perfectly means you never lose. Most beginner losses come from skipping step 2 or step 4.

## Playing as X (first)

### Open in a corner

A corner is the strongest practical opening. The only safe reply for O is the **centre**. Any other reply lets X force a win:

- If O takes an **edge**, X can usually set up a fork within two moves.
- If O takes the **opposite corner** or an **adjacent corner**, X takes another corner and threatens two lines.

### Or open in the centre

The centre is part of four lines (both diagonals, the middle row and the middle column), so it is also a fine opening. O's best reply is a **corner**; an edge reply gives X good fork chances.

### The classic corner trap

X plays a corner. If O replies on an edge next to it, X takes the centre, threatening the diagonal. O must block, and X then takes a corner that creates two threats at once. O cannot stop both.

## Playing as O (second)

As O, your goal is a draw unless X makes a mistake.

| X opens in... | Your best reply | Why |
| --- | --- | --- |
| A corner | The centre | Every other reply loses to good play |
| The centre | A corner | An edge reply gives X easy forks |
| An edge | The centre (or a corner next to the edge, or the opposite edge) | The centre is simplest and safe |

### The opposite-corners trap

A common position: X has two opposite corners and O holds the centre. Here O must play an **edge**, not a corner. Taking a corner lets X fork using the two remaining corners. Playing an edge forces X to block, and the game heads to a draw.

## Why forks are everything

Since a single threat can always be blocked, the only way to win against a careful player is to create **two threats in one move**. Corners are valuable precisely because each one sits on three lines (a row, a column and a diagonal), which gives the most fork chances. Edges sit on only two lines, which is why they are the weakest squares.

## Quick reference

| Situation | Move |
| --- | --- |
| You have two in a line | Complete it |
| They have two in a line | Block it |
| You can make two threats at once | Do it (fork) |
| They could fork next turn | Force them to block a threat of yours |
| Centre is free | Take it |
| They hold a corner | Take the opposite corner |
| Nothing else | Corner, then edge |

## Teaching it to children

Tic tac toe is a great first lesson in thinking ahead. Ask two questions before every move: "Can I win?" and "Can they win next turn?" Once those become habits, introduce forks, and let them try the corner trap against you. A child who can see a fork coming has learned the same skill that wins at Four in a Row, checkers and chess.

## Practise against the computer

The tic tac toe game on this site has three levels:

- **Easy** always takes a win but plays a random move most of the time: practise setting forks and the corner trap.
- **Medium** plays perfectly most of the time but slips now and then, so you must spot the one chance it gives you.
- **Unbeatable** searches every possible game with a full minimax search, so it never loses. Drawing against it consistently proves your defence is perfect.

When 3×3 feels solved, try **Five in a Row** on the 15×15 board, where you need five marks in a line. The same ideas apply on a bigger scale: block early, build threats in two directions, and look for a move that creates two open lines at once.
