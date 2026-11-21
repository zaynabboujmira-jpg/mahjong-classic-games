import { SudokuGame, type HintResult } from './game';
import { ALL, CELLS, CellName, PEERS, UNITS, bit, cellName, digitsOf } from './grid';
import { unitName } from './logic';
import { cageErrors, cageIndex, cageMask, type Cage } from './killer';

/**
 * A Killer Sudoku in play: the Sudoku game (digits, pencil marks, undo,
 * saving) plus cages. Pencil marks and hints take the cage sums into account.
 */
export class KillerGame extends SudokuGame {
  readonly cages: readonly Cage[];
  readonly owner: readonly number[];

  constructor(cages: readonly Cage[], givens: readonly number[], solution: readonly number[]) {
    super(givens, solution);
    this.cages = cages;
    this.owner = cageIndex(cages);
  }

  /** Digits still possible in an empty cell: not in its row, column or box, and able to complete its cage. */
  candidates(i: number): number {
    let used = 0;
    for (const p of PEERS[i]!) if (this.values[p]) used |= bit(this.values[p]!);
    return ALL & ~used & cageMask(this.cages[this.owner[i]!]!, this.values, i);
  }

  /** Sudoku conflicts plus broken cages (repeated digits, wrong totals). */
  override conflicts(): Set<number> {
    const out = super.conflicts();
    for (const i of cageErrors(this.cages, this.values)) out.add(i);
    return out;
  }

  override fillNotes(): boolean {
    const empty: number[] = [];
    for (let i = 0; i < CELLS; i++) if (!this.values[i]) empty.push(i);
    if (!empty.length) return false;
    const change = this.snapshot(empty);
    for (const i of empty) this.notes[i] = this.candidates(i);
    this.commit(change);
    return true;
  }

  /** First any wrong digit, then a cell with one candidate, a digit with one place, or (failing those) a revealed cell. */
  override hint(): HintResult {
    for (let i = 0; i < CELLS; i++) if (this.isWrong(i)) return { kind: 'wrong', cell: i, message: `The ${this.values[i]} at ${cellName(i)} is not right.` };
    const empty = Array.from({ length: CELLS }, (_, i) => i).filter((i) => !this.values[i]);
    if (!empty.length) return { kind: 'none', message: 'The grid is full.' };
    const cand = new Map(empty.map((i) => [i, this.candidates(i)]));
    for (const i of empty) {
      const ds = digitsOf(cand.get(i)!);
      if (ds.length === 1 && ds[0] === this.solution[i]) {
        const cage = this.cages[this.owner[i]!]!;
        return { kind: 'place', cell: i, digit: ds[0]!, message: `${CellName(i)} is ${ds[0]}: it is the only digit that fits its row, column, box and its cage of ${cage.cells.length} adding up to ${cage.sum}.` };
      }
    }
    for (let u = 0; u < UNITS.length; u++) {
      for (let d = 1; d <= 9; d++) {
        const at = UNITS[u]!.filter((i) => !this.values[i] && cand.get(i)! & bit(d));
        if (at.length === 1 && this.solution[at[0]!] === d && !UNITS[u]!.some((i) => this.values[i] === d)) {
          return { kind: 'place', cell: at[0]!, digit: d, message: `${CellName(at[0]!)} is ${d}: it is the only place for a ${d} in ${unitName(u)} once the cage sums are counted.` };
        }
      }
    }
    // No single step: reveal a cell in the smallest unfinished cage.
    const pick = empty.reduce((a, b) => (this.cages[this.owner[b]!]!.cells.length < this.cages[this.owner[a]!]!.cells.length ? b : a));
    const cage = this.cages[this.owner[pick]!]!;
    return { kind: 'place', cell: pick, digit: this.solution[pick]!, message: `${CellName(pick)} is ${this.solution[pick]}. Look at its cage of ${cage.cells.length} adding up to ${cage.sum}.` };
  }
}
