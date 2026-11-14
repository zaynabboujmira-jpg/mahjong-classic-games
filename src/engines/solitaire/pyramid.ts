import { createRng } from '../core/rng';
import { shuffledDeck, type Card } from './cards';

/*
 * Pyramid Solitaire: 28 cards dealt face up in a pyramid of seven rows; the
 * other 24 form the stock. Remove pairs of exposed cards that add up to 13
 * (Jack 11, Queen 12, King 13 on its own). A card is exposed when the two
 * cards below it are gone. The top card of the waste pile can also be used. Turn the stock over to the waste one card at a time; the
 * waste can be recycled into the stock (twice in Classic, any number of
 * times in Relaxed). Clear the pyramid to win.
 */
export type PyramidMode = 'classic' | 'relaxed';
export const PASSES: Record<PyramidMode, number> = { classic: 3, relaxed: Infinity };
const value = (c: Card) => c.rank;

/** Where a card can be taken from. */
export type Source = { kind: 'pyramid'; index: number } | { kind: 'waste' };

/** Index of the card in row r, position i (row 0 is the top). */
export const pIndex = (r: number, i: number) => (r * (r + 1)) / 2 + i;
export const rowOf = (index: number) => {
  let r = 0;
  while (pIndex(r + 1, 0) <= index) r++;
  return r;
};

interface Snapshot {
  pyramid: (Card | null)[];
  stock: Card[];
  waste: Card[];
  pass: number;
  score: number;
}

export class Pyramid {
  pyramid: (Card | null)[];
  stock: Card[];
  waste: Card[] = [];
  /** Passes through the stock started (the first deal counts as 1). */
  pass = 1;
  score = 0;
  readonly mode: PyramidMode;
  readonly seed: string;
  private history: Snapshot[] = [];

  constructor(seed = '1', mode: PyramidMode = 'classic') {
    this.seed = seed;
    this.mode = mode;
    const deck = shuffledDeck(createRng(`pyramid:${seed}`));
    this.pyramid = deck.slice(0, 28);
    this.stock = deck.slice(28);
  }

  isExposed(index: number): boolean {
    if (!this.pyramid[index]) return false;
    const r = rowOf(index);
    if (r === 6) return true;
    const i = index - pIndex(r, 0);
    return !this.pyramid[pIndex(r + 1, i)] && !this.pyramid[pIndex(r + 1, i + 1)];
  }

  cardAt(s: Source): Card | null {
    if (s.kind === 'pyramid') return this.isExposed(s.index) ? this.pyramid[s.index]! : null;
    return this.waste[this.waste.length - 1] ?? null;
  }

  /** Every available card with its source. */
  available(): { source: Source; card: Card }[] {
    const out: { source: Source; card: Card }[] = [];
    for (let i = 0; i < 28; i++) if (this.isExposed(i)) out.push({ source: { kind: 'pyramid', index: i }, card: this.pyramid[i]! });
    const w = this.cardAt({ kind: 'waste' });
    if (w) out.push({ source: { kind: 'waste' }, card: w });
    return out;
  }

  private save() {
    this.history.push({ pyramid: [...this.pyramid], stock: [...this.stock], waste: [...this.waste], pass: this.pass, score: this.score });
  }

  private take(s: Source) {
    if (s.kind === 'pyramid') this.pyramid[s.index] = null;
    else this.waste.pop();
  }

  /** Removes a king, or a pair adding to 13. Returns false if not allowed. */
  remove(a: Source, b?: Source): boolean {
    const ca = this.cardAt(a);
    if (!ca) return false;
    if (!b) {
      if (value(ca) !== 13) return false;
      this.save();
      this.take(a);
      this.score += a.kind === 'pyramid' ? 10 : 5;
      return true;
    }
    if (a.kind === b.kind && (a.kind !== 'pyramid' || (b.kind === 'pyramid' && a.index === b.index))) return false;
    const cb = this.cardAt(b);
    if (!cb || value(ca) + value(cb) !== 13) return false;
    this.save();
    this.take(a);
    this.take(b);
    this.score += (a.kind === 'pyramid' ? 10 : 5) + (b.kind === 'pyramid' ? 10 : 5);
    if (this.won) this.score += 500;
    return true;
  }

  /** Turns the top stock card onto the waste, or recycles the waste when the stock is empty. */
  draw(): boolean {
    if (this.stock.length) {
      this.save();
      this.waste.push(this.stock.pop()!);
      return true;
    }
    if (this.canRecycle) {
      this.save();
      this.stock = [...this.waste].reverse();
      this.waste = [];
      this.pass++;
      return true;
    }
    return false;
  }

  get canRecycle() {
    return !this.stock.length && this.waste.length > 0 && this.pass < PASSES[this.mode];
  }

  get passesLeft() {
    return PASSES[this.mode] === Infinity ? Infinity : PASSES[this.mode] - this.pass;
  }

  undo(): boolean {
    const h = this.history.pop();
    if (!h) return false;
    Object.assign(this, h);
    return true;
  }

  get canUndo() {
    return this.history.length > 0;
  }

  get won() {
    return this.pyramid.every((c) => c === null);
  }

  get cleared() {
    return this.pyramid.filter((c) => c === null).length;
  }

  /** A removable king or pair, for the Hint button. */
  hint(): Source[] | null {
    const av = this.available();
    const king = av.find((x) => value(x.card) === 13);
    if (king) return [king.source];
    for (let i = 0; i < av.length; i++) for (let j = i + 1; j < av.length; j++) if (value(av[i]!.card) + value(av[j]!.card) === 13) return [av[i]!.source, av[j]!.source];
    return null;
  }

  /** No pair, no king and no way to draw: the game is lost. */
  get stuck() {
    return !this.won && !this.hint() && !this.stock.length && !this.canRecycle;
  }
}
