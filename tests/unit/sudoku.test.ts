import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engines/core/rng';
import { SudokuGame } from '../../src/engines/sudoku/game';
import { DIFFICULTIES, TIERS, generate, type Difficulty } from '../../src/engines/sudoku/generator';
import { CELLS, PEERS, UNITS, bit, candidatesAt, gridToString, isConsistent, parseGrid } from '../../src/engines/sudoku/grid';
import { LogicBoard, grade, nextPlacement } from '../../src/engines/sudoku/logic';
import { countSolutions, randomFullGrid, solve } from '../../src/engines/sudoku/solver';

// A classic published puzzle with a known unique solution.
const PUZZLE = parseGrid('53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79');
const SOLUTION = parseGrid('534678912672195348198342567859761423426853791713924856961537284287419635345286179');

describe('grid geometry', () => {
  it('has 27 units of 9 and 20 peers per cell', () => {
    expect(UNITS).toHaveLength(27);
    for (const u of UNITS) expect(new Set(u).size).toBe(9);
    for (let i = 0; i < CELLS; i++) {
      expect(PEERS[i]).toHaveLength(20);
      expect(PEERS[i]).not.toContain(i);
    }
  });

  it('parses and prints grids', () => {
    expect(gridToString(PUZZLE)).toBe('53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79');
    expect(() => parseGrid('123')).toThrow();
  });
});

describe('solver', () => {
  it('solves a known puzzle to its known solution', () => {
    expect(solve(PUZZLE)).toEqual(SOLUTION);
    expect(countSolutions(PUZZLE)).toBe(1);
  });

  it('detects multiple and zero solutions', () => {
    expect(countSolutions(new Array(81).fill(0))).toBe(2);
    const broken = PUZZLE.slice();
    broken[2] = 5; // a second 5 in row 1
    expect(countSolutions(broken)).toBe(0);
  });

  it('fills random complete grids that are valid and differ by seed', () => {
    const a = randomFullGrid(createRng('a'));
    const b = randomFullGrid(createRng('b'));
    for (const g of [a, b]) {
      expect(g.every((v) => v >= 1 && v <= 9)).toBe(true);
      expect(isConsistent(g)).toBe(true);
    }
    expect(a).not.toEqual(b);
  });
});

describe('logic grader', () => {
  it('solves the known puzzle with singles only', () => {
    const g = grade(PUZZLE);
    expect(g.solved).toBe(true);
    expect(g.level).toBeLessThanOrEqual(2);
  });

  it('never places a digit that contradicts the solution', () => {
    const board = new LogicBoard(PUZZLE);
    while (!board.solved) {
      const s = board.step();
      expect(s).not.toBeNull();
      if (s!.place) expect(s!.place.digit).toBe(SOLUTION[s!.place.cell]);
    }
    expect(board.values).toEqual(SOLUTION);
  });

  it('keeps every candidate that the solution needs while eliminating', () => {
    const p = generate('expert', 'elim');
    const board = new LogicBoard(p.givens);
    for (let guard = 0; guard < 400 && !board.solved; guard++) {
      expect(board.step()).not.toBeNull();
      for (let i = 0; i < CELLS; i++) if (!board.values[i]) expect(board.cands[i]! & bit(p.solution[i]!)).toBeTruthy();
    }
    expect(board.values).toEqual(p.solution);
  });

  it('reports a puzzle it cannot finish as level 5', () => {
    expect(grade(new Array(81).fill(0)).level).toBe(5);
  });
});

const SEEDS: Record<Difficulty, number> = { easy: 12, medium: 12, hard: 8, expert: 5 };

describe.each(DIFFICULTIES)('%s puzzles', (difficulty) => {
  const tier = TIERS[difficulty];
  const puzzles = Array.from({ length: SEEDS[difficulty] }, (_, k) => generate(difficulty, `t${k}`));

  it('have exactly one solution, consistent with the givens', () => {
    for (const p of puzzles) {
      expect(countSolutions(p.givens)).toBe(1);
      expect(solve(p.givens)).toEqual(p.solution);
      expect(isConsistent(p.solution)).toBe(true);
      p.givens.forEach((v, i) => v && expect(v).toBe(p.solution[i]));
    }
  });

  it('need exactly the techniques of their tier: no more, no less', () => {
    for (const p of puzzles) {
      expect(p.level).toBe(tier.minLevel);
      expect(grade(p.givens, tier.maxLevel).solved).toBe(true);
      if (tier.minLevel > 1) expect(grade(p.givens, tier.minLevel - 1).solved).toBe(false);
    }
  });

  it('are reproducible from their seed', () => {
    expect(generate(difficulty, 't0')).toEqual(puzzles[0]);
    expect(generate(difficulty, 'other').givens).not.toEqual(puzzles[0]!.givens);
  });

  it('give hints that always match the solution and solve the whole puzzle', () => {
    const p = puzzles[0]!;
    const game = new SudokuGame(p.givens, p.solution);
    for (let n = 0; n < 81 && !game.isWon; n++) {
      const h = game.hint();
      expect(h.kind).toBe('place');
      if (h.kind === 'place') expect(h.digit).toBe(p.solution[h.cell]);
      game.applyHint(h);
    }
    expect(game.isWon).toBe(true);
  });
});

describe('game', () => {
  const fresh = () => new SudokuGame(PUZZLE, SOLUTION);
  const empty = PUZZLE.findIndex((v) => v === 0); // row 1, column 3

  it('refuses to change givens', () => {
    const g = fresh();
    expect(g.setValue(0, 1)).toBe(false);
    expect(g.toggleNote(0, 1)).toBe(false);
    expect(g.erase(0)).toBe(false);
    expect(g.values[0]).toBe(5);
  });

  it('enters, toggles off and erases digits', () => {
    const g = fresh();
    expect(g.setValue(empty, 4)).toBe(true);
    expect(g.values[empty]).toBe(4);
    g.setValue(empty, 4);
    expect(g.values[empty]).toBe(0);
    g.setValue(empty, 2);
    g.erase(empty);
    expect(g.values[empty]).toBe(0);
  });

  it('counts mistakes against the solution and flags conflicts', () => {
    const g = fresh();
    g.setValue(empty, 4); // correct (solution is 4)
    expect(g.mistakes).toBe(0);
    expect(g.isWrong(empty)).toBe(false);
    g.setValue(empty, 5); // wrong, and clashes with the 5 in row 1
    expect(g.mistakes).toBe(1);
    expect(g.isWrong(empty)).toBe(true);
    expect([...g.conflicts()].sort((a, b) => a - b)).toEqual([0, empty]);
  });

  it('keeps notes and clears a placed digit from peer notes', () => {
    const g = fresh();
    const peer = PEERS[empty]!.find((p) => PUZZLE[p] === 0)!;
    g.toggleNote(peer, 4);
    g.toggleNote(peer, 6);
    expect(g.notes[peer]).toBe(bit(4) | bit(6));
    g.setValue(empty, 4);
    expect(g.notes[peer]).toBe(bit(6));
    g.undo();
    expect(g.values[empty]).toBe(0);
    expect(g.notes[peer]).toBe(bit(4) | bit(6));
  });

  it('does not allow notes on a filled cell', () => {
    const g = fresh();
    g.setValue(empty, 4);
    expect(g.toggleNote(empty, 1)).toBe(false);
  });

  it('fills notes with exactly the open candidates, always including the answer', () => {
    const g = fresh();
    g.fillNotes();
    for (let i = 0; i < CELLS; i++) {
      if (PUZZLE[i]) continue;
      expect(g.notes[i]).toBe(candidatesAt(PUZZLE, i));
      expect(g.notes[i]! & bit(SOLUTION[i]!)).toBeTruthy();
    }
    g.undo();
    expect(g.notes.every((n) => n === 0)).toBe(true);
  });

  it('undoes every kind of action in order', () => {
    const g = fresh();
    g.setValue(empty, 4);
    g.toggleNote(2 + 9, 1);
    g.erase(empty);
    expect(g.undo()).toBe(true);
    expect(g.values[empty]).toBe(4);
    expect(g.undo()).toBe(true);
    expect(g.undo()).toBe(true);
    expect(g.values).toEqual(PUZZLE);
    expect(g.undo()).toBe(false);
  });

  it('points hints at a wrong digit first, and fixing it clears the digit', () => {
    const g = fresh();
    g.setValue(empty, 9);
    const h = g.hint();
    expect(h).toMatchObject({ kind: 'wrong', cell: empty });
    g.applyHint(h);
    expect(g.values[empty]).toBe(0);
    expect(g.hintsUsed).toBe(1);
  });

  it('wins when the grid matches the solution', () => {
    const g = fresh();
    for (let i = 0; i < CELLS; i++) if (!PUZZLE[i]) g.setValue(i, SOLUTION[i]!);
    expect(g.isWon).toBe(true);
    expect(g.mistakes).toBe(0);
  });

  it('serializes and restores progress, rejecting tampered givens', () => {
    const g = fresh();
    g.setValue(empty, 4);
    g.toggleNote(11, 3);
    const saved = g.serialize();
    const h = fresh();
    expect(h.restore(saved)).toBe(true);
    expect(h.values).toEqual(g.values);
    expect(h.notes).toEqual(g.notes);
    expect(h.moves).toBe(g.moves);
    const bad = { ...saved, values: saved.values.map((v, i) => (i === 0 ? 1 : v)) };
    expect(fresh().restore(bad)).toBe(false);
  });

  it('explains hints by technique', () => {
    const p = generate('hard', 'explain');
    const placement = nextPlacement(p.givens);
    expect(placement).not.toBeNull();
    expect(placement!.digit).toBe(p.solution[placement!.cell]);
    const msg = new SudokuGame(p.givens, p.solution).hint();
    expect(msg.kind === 'place' && /Row \d, column \d is \d\./.test(msg.message)).toBe(true);
  });
});
