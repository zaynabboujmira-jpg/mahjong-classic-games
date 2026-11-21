import type { Shape } from './variants';

type Change = { cell: number; value: number; notes: number }[];
export type VariantHint = { kind: 'wrong' | 'place'; cell: number; digit: number; message: string } | { kind: 'none'; message: string };

const unitLabel = (shape: Shape, u: number) => {
  const n = shape.n;
  if (u < n) return `row ${u + 1}`;
  if (u < 2 * n) return `column ${u - n + 1}`;
  if (u < 3 * n) return shape.variant === 'jigsaw' ? 'its shaded region' : 'its box';
  return 'its diagonal';
};
export const variantCellName = (shape: Shape, c: number) => `row ${Math.floor(c / shape.n) + 1}, column ${(c % shape.n) + 1}`;

/** A variant Sudoku in play: digits, pencil marks, undo, hints and saving, for any shape. */
export class VariantGame {
  readonly values: number[];
  readonly notes: number[];
  private history: Change[] = [];
  moves = 0;
  mistakes = 0;
  hintsUsed = 0;

  constructor(
    readonly shape: Shape,
    readonly givens: readonly number[],
    readonly solution: readonly number[],
  ) {
    this.values = givens.slice();
    this.notes = new Array<number>(givens.length).fill(0);
  }

  get size() {
    return this.values.length;
  }
  isGiven = (c: number) => this.givens[c] !== 0;
  isWrong = (c: number) => this.values[c] !== 0 && this.values[c] !== this.solution[c];
  get canUndo() {
    return this.history.length > 0;
  }
  get isWon() {
    return this.values.every((v, i) => v === this.solution[i]);
  }

  conflicts(): Set<number> {
    const out = new Set<number>();
    for (const u of this.shape.units)
      for (let d = 1; d <= this.shape.n; d++) {
        const at = u.filter((c) => this.values[c] === d);
        if (at.length > 1) at.forEach((c) => out.add(c));
      }
    return out;
  }

  remaining(): number[] {
    const left = new Array<number>(this.shape.n + 1).fill(this.shape.n);
    left[0] = 0;
    for (const v of this.values) if (v) left[v]!--;
    return left;
  }

  private snapshot(cells: Iterable<number>): Change {
    return [...cells].map((cell) => ({ cell, value: this.values[cell]!, notes: this.notes[cell]! }));
  }
  private commit(ch: Change) {
    if (!ch.length) return;
    this.history.push(ch);
    this.moves++;
  }

  setValue(c: number, d: number): boolean {
    if (this.isGiven(c)) return false;
    if (this.values[c] === d) return this.erase(c);
    const b = 1 << (d - 1);
    const touched = [c, ...this.shape.peers[c]!.filter((p) => this.notes[p]! & b)];
    const ch = this.snapshot(touched);
    this.values[c] = d;
    this.notes[c] = 0;
    for (const p of touched.slice(1)) this.notes[p]! &= ~b;
    if (d !== this.solution[c]) this.mistakes++;
    this.commit(ch);
    return true;
  }

  toggleNote(c: number, d: number): boolean {
    if (this.isGiven(c) || this.values[c]) return false;
    const ch = this.snapshot([c]);
    this.notes[c]! ^= 1 << (d - 1);
    this.commit(ch);
    return true;
  }

  erase(c: number): boolean {
    if (this.isGiven(c) || (!this.values[c] && !this.notes[c])) return false;
    const ch = this.snapshot([c]);
    this.values[c] = 0;
    this.notes[c] = 0;
    this.commit(ch);
    return true;
  }

  candidates(c: number): number {
    let used = 0;
    for (const p of this.shape.peers[c]!) if (this.values[p]) used |= 1 << (this.values[p]! - 1);
    return ((1 << this.shape.n) - 1) & ~used;
  }

  fillNotes(): boolean {
    const empty = this.values.flatMap((v, i) => (v ? [] : [i]));
    if (!empty.length) return false;
    const ch = this.snapshot(empty);
    for (const c of empty) this.notes[c] = this.candidates(c);
    this.commit(ch);
    return true;
  }

  undo(): boolean {
    const ch = this.history.pop();
    if (!ch) return false;
    for (const { cell, value, notes } of ch) {
      this.values[cell] = value;
      this.notes[cell] = notes;
    }
    this.moves++;
    return true;
  }

  /** A wrong digit first; then a naked single, then a hidden single; otherwise a revealed cell. */
  hint(): VariantHint {
    const name = (c: number) => variantCellName(this.shape, c);
    const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
    for (let c = 0; c < this.size; c++) if (this.isWrong(c)) return { kind: 'wrong', cell: c, digit: this.values[c]!, message: `The ${this.values[c]} at ${name(c)} is not right.` };
    const empty = this.values.flatMap((v, i) => (v ? [] : [i]));
    if (!empty.length) return { kind: 'none', message: 'The grid is full.' };
    for (const c of empty) {
      const m = this.candidates(c);
      if (m && (m & (m - 1)) === 0) {
        const d = 31 - Math.clz32(m) + 1;
        return { kind: 'place', cell: c, digit: d, message: `${cap(name(c))} is ${d}. It is the only digit that fits there.` };
      }
    }
    for (let u = 0; u < this.shape.units.length; u++) {
      const unit = this.shape.units[u]!;
      for (let d = 1; d <= this.shape.n; d++) {
        if (unit.some((c) => this.values[c] === d)) continue;
        const spots = unit.filter((c) => !this.values[c] && this.candidates(c) & (1 << (d - 1)));
        if (spots.length === 1) return { kind: 'place', cell: spots[0]!, digit: d, message: `${cap(name(spots[0]!))} is ${d}. It is the only place for a ${d} in ${unitLabel(this.shape, u)}.` };
      }
    }
    const c = empty[0]!;
    return { kind: 'place', cell: c, digit: this.solution[c]!, message: `${cap(name(c))} is ${this.solution[c]}.` };
  }

  applyHint(h: VariantHint): boolean {
    if (h.kind === 'none') return false;
    this.hintsUsed++;
    return h.kind === 'wrong' ? this.erase(h.cell) : this.setValue(h.cell, h.digit);
  }

  serialize() {
    return { values: this.values.slice(), notes: this.notes.slice(), moves: this.moves, mistakes: this.mistakes, hintsUsed: this.hintsUsed };
  }

  restore(s: { values: number[]; notes: number[]; moves: number; mistakes: number; hintsUsed: number }): boolean {
    if (s.values?.length !== this.size || s.notes?.length !== this.size) return false;
    for (let c = 0; c < this.size; c++) if (this.givens[c] && s.values[c] !== this.givens[c]) return false;
    s.values.forEach((v, i) => (this.values[i] = v));
    s.notes.forEach((v, i) => (this.notes[i] = v));
    this.moves = s.moves;
    this.mistakes = s.mistakes;
    this.hintsUsed = s.hintsUsed;
    this.history = [];
    return true;
  }
}
