import { CELLS, CellName, PEERS, UNITS, bit, cellName, type Grid } from './grid';
import { TECHNIQUE_NAMES, nextPlacement, unitName } from './logic';

/** One undoable action: every cell it touched, with its previous value and notes. */
type Change = { cell: number; value: number; notes: number }[];

export type HintResult =
  | { kind: 'wrong'; cell: number; message: string }
  | { kind: 'place'; cell: number; digit: number; message: string }
  | { kind: 'none'; message: string };

/**
 * A Sudoku in play: the givens, the player's digits and pencil marks, and
 * an undo history. The solution is known (the puzzle has exactly one), which
 * is what powers mistake checking and hints.
 */
export class SudokuGame {
  readonly givens: readonly number[];
  readonly solution: readonly number[];
  readonly values: number[];
  /** Pencil marks as 9-bit masks. */
  readonly notes: number[];
  private history: Change[] = [];
  moves = 0;
  mistakes = 0;
  hintsUsed = 0;

  constructor(givens: readonly number[], solution: readonly number[]) {
    this.givens = givens.slice();
    this.solution = solution.slice();
    this.values = givens.slice();
    this.notes = new Array<number>(CELLS).fill(0);
  }

  isGiven = (i: number) => this.givens[i] !== 0;
  get canUndo() {
    return this.history.length > 0;
  }
  get isWon(): boolean {
    for (let i = 0; i < CELLS; i++) if (this.values[i] !== this.solution[i]) return false;
    return true;
  }
  /** A digit the player entered that differs from the solution. */
  isWrong = (i: number) => this.values[i] !== 0 && this.values[i] !== this.solution[i];

  /** Cells whose digit repeats in a row, column or box (shown even with mistake checking off). */
  conflicts(): Set<number> {
    const out = new Set<number>();
    for (const u of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const at = u.filter((i) => this.values[i] === d);
        if (at.length > 1) at.forEach((i) => out.add(i));
      }
    }
    return out;
  }

  /** How many of each digit are still to place (index 1-9), counting correct and incorrect entries. */
  remaining(): number[] {
    const left = new Array<number>(10).fill(9);
    left[0] = 0;
    for (const v of this.values) if (v) left[v]!--;
    return left;
  }

  private commit(change: Change) {
    if (!change.length) return;
    this.history.push(change);
    this.moves++;
  }

  private snapshot(cells: Iterable<number>): Change {
    return [...cells].map((cell) => ({ cell, value: this.values[cell]!, notes: this.notes[cell]! }));
  }

  /**
   * Enters a digit (entering the same digit again clears it). Pencil marks of
   * that digit are removed from the cell's row, column and box. Returns false
   * for givens.
   */
  setValue(cell: number, digit: number): boolean {
    if (this.isGiven(cell)) return false;
    if (this.values[cell] === digit) return this.erase(cell);
    const touched = [cell, ...PEERS[cell]!.filter((p) => this.notes[p]! & bit(digit))];
    const change = this.snapshot(touched);
    this.values[cell] = digit;
    this.notes[cell] = 0;
    for (const p of touched.slice(1)) this.notes[p]! &= ~bit(digit);
    if (digit !== this.solution[cell]) this.mistakes++;
    this.commit(change);
    return true;
  }

  toggleNote(cell: number, digit: number): boolean {
    if (this.isGiven(cell) || this.values[cell]) return false;
    const change = this.snapshot([cell]);
    this.notes[cell]! ^= bit(digit);
    this.commit(change);
    return true;
  }

  erase(cell: number): boolean {
    if (this.isGiven(cell) || (!this.values[cell] && !this.notes[cell])) return false;
    const change = this.snapshot([cell]);
    this.values[cell] = 0;
    this.notes[cell] = 0;
    this.commit(change);
    return true;
  }

  /** Fills every empty cell's pencil marks with the digits not yet ruled out by its peers. */
  fillNotes(): boolean {
    const empty = [];
    for (let i = 0; i < CELLS; i++) if (!this.values[i]) empty.push(i);
    if (!empty.length) return false;
    const change = this.snapshot(empty);
    for (const i of empty) {
      let used = 0;
      for (const p of PEERS[i]!) if (this.values[p]) used |= bit(this.values[p]!);
      this.notes[i] = 0x1ff & ~used;
    }
    this.commit(change);
    return true;
  }

  undo(): boolean {
    const change = this.history.pop();
    if (!change) return false;
    for (const { cell, value, notes } of change) {
      this.values[cell] = value;
      this.notes[cell] = notes;
    }
    this.moves++;
    return true;
  }

  /**
   * The next step: first any wrong digit, then the easiest cell that logic
   * can fill from here, with the technique that finds it.
   */
  hint(): HintResult {
    for (let i = 0; i < CELLS; i++) {
      if (this.isWrong(i)) return { kind: 'wrong', cell: i, message: `The ${this.values[i]} at ${cellName(i)} is not right.` };
    }
    const next = nextPlacement(this.values);
    if (next) {
      const where = next.unit !== undefined && next.technique === 'hidden-single' ? ` It is the only place for a ${next.digit} in ${unitName(next.unit)}.` : '';
      const how =
        next.technique === 'naked-single'
          ? ` It is the only digit that fits there.`
          : next.technique === 'hidden-single'
            ? where
            : ` Look for a ${TECHNIQUE_NAMES[next.technique]} first.`;
      return { kind: 'place', cell: next.cell, digit: next.digit, message: `${CellName(next.cell)} is ${next.digit}.${how}` };
    }
    // Every puzzle here is solvable by logic from the start, so this only
    // happens if the grid is full or the logic set is exhausted.
    const empty = this.values.findIndex((v) => v === 0);
    if (empty < 0) return { kind: 'none', message: 'The grid is full.' };
    return { kind: 'place', cell: empty, digit: this.solution[empty]!, message: `${CellName(empty)} is ${this.solution[empty]}.` };
  }

  /** Plays a hint: fixes a wrong digit by clearing it, or places the hinted digit. */
  applyHint(h: HintResult): boolean {
    if (h.kind === 'none') return false;
    this.hintsUsed++;
    return h.kind === 'wrong' ? this.erase(h.cell) : this.setValue(h.cell, h.digit);
  }

  /** Plain snapshot for saving progress. */
  serialize() {
    return { values: this.values.slice(), notes: this.notes.slice(), moves: this.moves, mistakes: this.mistakes, hintsUsed: this.hintsUsed };
  }

  restore(s: { values: Grid; notes: number[]; moves: number; mistakes: number; hintsUsed: number }): boolean {
    if (s.values.length !== CELLS || s.notes.length !== CELLS) return false;
    for (let i = 0; i < CELLS; i++) if (this.givens[i] && s.values[i] !== this.givens[i]) return false;
    s.values.forEach((v, i) => (this.values[i] = v));
    s.notes.forEach((v, i) => (this.notes[i] = v));
    this.moves = s.moves;
    this.mistakes = s.mistakes;
    this.hintsUsed = s.hintsUsed;
    this.history = [];
    return true;
  }
}
