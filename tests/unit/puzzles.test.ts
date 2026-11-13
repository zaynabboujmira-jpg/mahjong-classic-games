import { describe, expect, it } from 'vitest';
import { MergeGame, TARGET } from '../../src/engines/puzzles/merge';
import { BOARDS, BOARD_IDS, MatchGame, SYMBOL_COUNT, better } from '../../src/engines/puzzles/match';
import { CROSSED, FILLED, NONO_SIZES, NonogramGame, clueOf, generate, lineSolve, solveLine } from '../../src/engines/puzzles/nonogram';
import { COLS, FourRow, LINES, ROWS, bestMove, evaluate } from '../../src/engines/puzzles/fourrow';

describe('Number Merge', () => {
  it('starts with two tiles of 2 or 4', () => {
    for (const size of [3, 4, 5] as const) {
      const g = new MergeGame(size, 'a');
      expect(g.tiles).toHaveLength(2);
      expect(g.tiles.every((t) => t.value === 2 || t.value === 4)).toBe(true);
      expect(g.grid()).toHaveLength(size);
    }
  });

  it('is deterministic for a seed', () => {
    const a = new MergeGame(4, 'seed');
    const b = new MergeGame(4, 'seed');
    for (const d of ['left', 'up', 'right', 'down', 'left'] as const) {
      a.move(d);
      b.move(d);
    }
    expect(a.grid()).toEqual(b.grid());
  });

  it('slides and merges each pair once', () => {
    const g = new MergeGame(4, 'x');
    g.load([
      [2, 2, 2, 2],
      [4, 0, 4, 8],
      [2, 2, 4, 0],
      [0, 0, 0, 2],
    ]);
    const res = g.move('left');
    expect(res.moved).toBe(true);
    expect(res.merges).toBe(4);
    expect(res.gained).toBe(4 + 4 + 8 + 4);
    const grid = g.grid();
    expect(grid[0]!.slice(0, 2)).toEqual([4, 4]);
    expect(grid[1]!.slice(0, 2)).toEqual([8, 8]);
    expect(grid[2]!.slice(0, 2)).toEqual([4, 4]);
    expect(grid[3]![0]).toBe(2);
    expect(g.score).toBe(20);
    // One new tile appeared.
    expect(g.tiles.filter((t) => t.isNew)).toHaveLength(1);
  });

  it('merges towards the move direction (three in a row)', () => {
    const g = new MergeGame(4, 'x');
    g.load([
      [2, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    g.move('right');
    expect(g.grid()[0]!.slice(2)).toEqual([2, 4]);
  });

  it('ignores a move that changes nothing', () => {
    const g = new MergeGame(4, 'x');
    g.load([
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(g.move('up').moved).toBe(false);
    expect(g.move('left').moved).toBe(false);
    expect(g.tiles).toHaveLength(4);
    expect(g.canUndo).toBe(false);
  });

  it('undo restores the board, score and the same new tile', () => {
    const g = new MergeGame(4, 'undo');
    const start = g.grid();
    g.move('left');
    const after = g.grid();
    const score = g.score;
    expect(g.undo()).toBe(true);
    expect(g.grid()).toEqual(start);
    expect(g.undo()).toBe(false);
    g.move('left');
    expect(g.grid()).toEqual(after);
    expect(g.score).toBe(score);
  });

  it('detects the target tile and the end of the game', () => {
    const g = new MergeGame(4, 'x');
    g.load([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    g.move('left');
    expect(g.won).toBe(true);
    expect(TARGET[4]).toBe(2048);
    g.load([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    expect(g.over).toBe(true);
    g.load([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 4],
    ]);
    expect(g.over).toBe(false);
  });

  it('a random game always ends with a full, stuck board', () => {
    const g = new MergeGame(3, 'long');
    const dirs = ['up', 'left', 'down', 'right'] as const;
    let i = 0;
    while (!g.over && i < 5000) g.move(dirs[i++ % 4]!);
    expect(g.over).toBe(true);
    expect(g.tiles).toHaveLength(9);
    expect(new Set(g.tiles.map((t) => t.id)).size).toBe(9);
  });
});

describe('Memory Match', () => {
  it('deals each symbol exactly twice on every board', () => {
    for (const id of BOARD_IDS) {
      const g = new MatchGame(id, 's');
      const { cols, rows } = BOARDS[id];
      expect(g.cards).toHaveLength(cols * rows);
      const counts = new Map<number, number>();
      for (const c of g.cards) counts.set(c.symbol, (counts.get(c.symbol) ?? 0) + 1);
      expect([...counts.values()].every((n) => n === 2)).toBe(true);
      expect(Math.max(...counts.keys())).toBeLessThan(SYMBOL_COUNT);
    }
  });

  it('keeps matched pairs up and turns misses back', () => {
    const g = new MatchGame('small', 'm');
    const a = 0;
    const twin = g.cards.findIndex((c, i) => i !== a && c.symbol === g.cards[a]!.symbol);
    const other = g.cards.findIndex((c) => c.symbol !== g.cards[a]!.symbol);
    expect(g.flip(a)).toBe('first');
    expect(g.flip(a)).toBe('ignored');
    expect(g.flip(other)).toBe('miss');
    expect(g.moves).toBe(1);
    expect(g.pendingMiss).toEqual([a, other]);
    // The next flip turns the miss back first.
    expect(g.flip(a)).toBe('first');
    expect(g.cards[other]!.up).toBe(false);
    expect(g.flip(twin)).toBe('match');
    expect(g.cards[a]!.matched && g.cards[twin]!.matched).toBe(true);
    expect(g.found).toBe(1);
    expect(g.moves).toBe(2);
  });

  it('wins after finding every pair, with a perfect-memory move count', () => {
    const g = new MatchGame('large', 'w');
    const seen = new Map<number, number>();
    g.cards.forEach((c, i) => {
      const j = seen.get(c.symbol);
      if (j === undefined) seen.set(c.symbol, i);
    });
    let last = '';
    for (const [sym, i] of seen) {
      const j = g.cards.findIndex((c, k) => k !== i && c.symbol === sym);
      g.flip(i);
      last = g.flip(j);
    }
    expect(last).toBe('won');
    expect(g.won).toBe(true);
    expect(g.moves).toBe(15);
  });

  it('ranks results by moves, then time', () => {
    expect(better({ moves: 10, ms: 9000 }, null)).toBe(true);
    expect(better({ moves: 9, ms: 99000 }, { moves: 10, ms: 1000 })).toBe(true);
    expect(better({ moves: 10, ms: 5000 }, { moves: 10, ms: 6000 })).toBe(true);
    expect(better({ moves: 11, ms: 1000 }, { moves: 10, ms: 6000 })).toBe(false);
  });
});

describe('Nonogram', () => {
  it('computes clues', () => {
    expect(clueOf([true, true, false, true, false])).toEqual([2, 1]);
    expect(clueOf([false, false])).toEqual([0]);
    expect(clueOf([true, true, true])).toEqual([3]);
  });

  it('settles the overlap of a single line', () => {
    // A run of 4 in 5 cells: the middle three are certain.
    expect(solveLine([4], [-1, -1, -1, -1, -1])).toEqual([-1, 1, 1, 1, -1]);
    expect(solveLine([5], [-1, -1, -1, -1, -1])).toEqual([1, 1, 1, 1, 1]);
    expect(solveLine([0], [-1, -1, -1])).toEqual([0, 0, 0]);
    expect(solveLine([1, 1], [-1, -1, -1])).toEqual([1, 0, 1]);
    expect(solveLine([2], [1, 1, 1])).toBeNull();
  });

  it('generates deterministic, uniquely solvable puzzles for every size', () => {
    for (const size of NONO_SIZES) {
      for (const seed of ['1', '2', '3', 'daily5']) {
        const p = generate(size, seed);
        expect(generate(size, seed).solution).toEqual(p.solution);
        expect(p.rows).toHaveLength(size);
        expect(p.cols).toHaveLength(size);
        // Line logic alone recovers exactly the picture, so it is the only solution.
        expect(lineSolve(p.rows, p.cols)).toEqual(p.solution);
        expect(p.rows.every((r) => r.reduce((a, b) => a + b, 0) + r.length - 1 <= size)).toBe(true);
      }
    }
    expect(generate(10, 'a').solution).not.toEqual(generate(10, 'b').solution);
  });

  it('tracks mistakes, finished lines and the solved state', () => {
    const g = new NonogramGame(5, '7');
    const sol = g.puzzle.solution;
    expect(g.solved).toBe(false);
    // Fill a wrong cell and cross a right one.
    const wrong = sol.flat().findIndex((v) => !v);
    const right = sol.flat().findIndex((v) => v);
    g.set(Math.floor(wrong / 5), wrong % 5, FILLED);
    g.set(Math.floor(right / 5), right % 5, CROSSED);
    expect(g.mistakes()).toHaveLength(2);
    // Now play the solution; crosses on empty cells are allowed.
    sol.forEach((row, r) => row.forEach((v, c) => g.set(r, c, v ? FILLED : CROSSED)));
    expect(g.mistakes()).toEqual([]);
    expect(g.solved).toBe(true);
    expect([0, 1, 2, 3, 4].every((i) => g.rowDone(i) && g.colDone(i))).toBe(true);
  });
});

describe('Four in a Row', () => {
  it('has 69 winning lines on a 7×6 board', () => {
    expect(LINES).toHaveLength(69);
  });

  it('drops discs to the lowest free cell and alternates players', () => {
    const g = new FourRow();
    expect(g.drop(3)).toBe(0);
    expect(g.drop(3)).toBe(1);
    expect(g.board[0]![3]).toBe(1);
    expect(g.board[1]![3]).toBe(2);
    expect(g.turn).toBe(1);
    for (let i = 0; i < 4; i++) g.drop(0);
    expect(g.canDrop(0)).toBe(true);
    g.drop(0);
    g.drop(0);
    expect(g.canDrop(0)).toBe(false);
    expect(g.drop(0)).toBe(-1);
  });

  it('detects horizontal, vertical and diagonal wins', () => {
    const h = new FourRow();
    for (const c of [0, 0, 1, 1, 2, 2, 3]) h.drop(c);
    expect(h.winner).toBe(1);
    expect(h.line).toHaveLength(4);
    expect(h.canDrop(4)).toBe(false);

    const v = new FourRow();
    for (const c of [0, 1, 0, 1, 0, 1, 2, 1]) v.drop(c);
    expect(v.winner).toBe(2);

    const d = new FourRow();
    for (const c of [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]) d.drop(c);
    expect(d.winner).toBe(1);
  });

  it('calls a full board with no line a draw', () => {
    const g = new FourRow();
    // Columns filled in pairs so no four line up.
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
    for (const c of order) g.drop(c);
    expect(g.moves).toHaveLength(ROWS * COLS);
    expect(g.winner).toBe(0);
    expect(g.draw).toBe(true);
  });

  it('undo takes back the last disc', () => {
    const g = new FourRow();
    for (const c of [0, 0, 1, 1, 2, 2, 3]) g.drop(c);
    expect(g.winner).toBe(1);
    g.undo();
    expect(g.winner).toBe(0);
    expect(g.turn).toBe(1);
    expect(g.board[0]![3]).toBe(0);
  });

  it('every level takes an immediate win and Medium/Hard block one', () => {
    const win = new FourRow();
    for (const c of [0, 6, 1, 6, 2, 5]) win.drop(c);
    for (const level of ['easy', 'medium', 'hard'] as const) expect(bestMove(win, level)).toBe(3);

    const block = new FourRow();
    for (const c of [0, 3, 6, 3, 6, 3]) block.drop(c);
    expect(block.turn).toBe(1);
    expect(bestMove(block, 'medium')).toBe(3);
    expect(bestMove(block, 'hard')).toBe(3);
  });

  it('Hard opens in the centre, answers quickly and beats Easy', () => {
    const t = performance.now();
    expect(bestMove(new FourRow(), 'hard')).toBe(3);
    expect(performance.now() - t).toBeLessThan(1500);
    let hardWins = 0;
    for (let game = 0; game < 3; game++) {
      const g = new FourRow();
      g.drop(game); // vary the opening
      while (!g.over) g.drop(bestMove(g, g.turn === 1 ? 'easy' : 'hard'));
      if (g.winner === 2) hardWins++;
    }
    expect(hardWins).toBe(3);
    const vsMedium = new FourRow();
    while (!vsMedium.over) vsMedium.drop(bestMove(vsMedium, vsMedium.turn === 1 ? 'hard' : 'medium'));
    expect(vsMedium.winner).toBe(1);
  });

  it('Hard never takes long over a move', () => {
    const g = new FourRow();
    let worst = 0;
    while (!g.over) {
      const t = performance.now();
      const m = bestMove(g, 'hard');
      worst = Math.max(worst, performance.now() - t);
      g.drop(m);
    }
    expect(worst).toBeLessThan(1500);
  });

  it('evaluation prefers the side with more threats', () => {
    const g = new FourRow();
    for (const c of [3, 0, 3, 6]) g.drop(c);
    expect(evaluate(g, 1)).toBeGreaterThan(evaluate(g, 2));
  });
});
