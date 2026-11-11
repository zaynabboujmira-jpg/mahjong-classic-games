import { buildTopology, freeSlots, isFree } from './board';
import { generateDeal } from './generator';
import { canMatch } from './tiles';
import type { Rng } from '../core/rng';
import type { Face, Slot, Topology } from './types';

type Move =
  | { kind: 'match'; a: number; b: number }
  | { kind: 'shuffle'; previous: (Face | null)[] };

export type SelectResult =
  | { kind: 'blocked'; index: number }
  | { kind: 'selected'; index: number }
  | { kind: 'deselected'; index: number }
  | { kind: 'mismatch'; index: number; previous: number }
  | { kind: 'matched'; a: number; b: number };

/**
 * Framework-free Mahjong Solitaire state machine. The UI only calls these
 * methods and reads the public getters; it never mutates state directly.
 */
export class MahjongGame {
  readonly topo: Topology;
  private faces: (Face | null)[];
  private readonly present: boolean[];
  private readonly history: Move[] = [];
  private selectedIndex: number | null = null;

  constructor(slots: readonly Slot[], rng: Rng) {
    this.topo = buildTopology(slots);
    this.faces = generateDeal(this.topo, rng).faces;
    this.present = slots.map(() => true);
  }

  get slots(): readonly Slot[] {
    return this.topo.slots;
  }
  get selected(): number | null {
    return this.selectedIndex;
  }
  get remaining(): number {
    return this.present.reduce((c, p) => c + (p ? 1 : 0), 0);
  }
  get total(): number {
    return this.present.length;
  }
  get moveCount(): number {
    return this.history.filter((m) => m.kind === 'match').length;
  }
  get canUndo(): boolean {
    return this.history.length > 0;
  }
  get isWon(): boolean {
    return this.remaining === 0;
  }
  /** No matching free pair is left but tiles remain. */
  get isStuck(): boolean {
    return !this.isWon && this.availablePairs().length === 0;
  }

  isPresent(i: number): boolean {
    return this.present[i] === true;
  }
  isFree(i: number): boolean {
    return isFree(this.topo, this.present, i);
  }
  faceAt(i: number): Face | null {
    return this.faces[i] ?? null;
  }
  freeTiles(): number[] {
    return freeSlots(this.topo, this.present);
  }

  select(i: number): SelectResult {
    if (!this.isFree(i)) return { kind: 'blocked', index: i };
    const prev = this.selectedIndex;
    if (prev === i) {
      this.selectedIndex = null;
      return { kind: 'deselected', index: i };
    }
    if (prev === null) {
      this.selectedIndex = i;
      return { kind: 'selected', index: i };
    }
    if (canMatch(this.faces[prev]!, this.faces[i]!)) {
      this.present[prev] = false;
      this.present[i] = false;
      this.selectedIndex = null;
      this.history.push({ kind: 'match', a: prev, b: i });
      return { kind: 'matched', a: prev, b: i };
    }
    // Picking a non-matching free tile moves the selection to it.
    this.selectedIndex = i;
    return { kind: 'mismatch', index: i, previous: prev };
  }

  clearSelection(): void {
    this.selectedIndex = null;
  }

  undo(): boolean {
    const move = this.history.pop();
    if (!move) return false;
    if (move.kind === 'match') {
      this.present[move.a] = true;
      this.present[move.b] = true;
    } else {
      this.faces = move.previous;
    }
    this.selectedIndex = null;
    return true;
  }

  /** Every currently playable pair of free, matching tiles. */
  availablePairs(): [number, number][] {
    const byKey = new Map<string, number[]>();
    for (const i of this.freeTiles()) {
      const key = this.faces[i]!.matchKey;
      const list = byKey.get(key);
      if (list) list.push(i);
      else byKey.set(key, [i]);
    }
    const pairs: [number, number][] = [];
    for (const list of byKey.values()) {
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) pairs.push([list[a]!, list[b]!]);
      }
    }
    return pairs;
  }

  /**
   * Suggests a pair. Prefers pairs on higher layers, which unlock more of the
   * board, and when a tile is selected prefers a partner for that tile.
   */
  hint(): [number, number] | null {
    const pairs = this.availablePairs();
    if (pairs.length === 0) return null;
    const sel = this.selectedIndex;
    if (sel !== null) {
      const withSel = pairs.find(([a, b]) => a === sel || b === sel);
      if (withSel) return withSel;
    }
    const height = ([a, b]: [number, number]) => this.slots[a]!.z + this.slots[b]!.z;
    return pairs.reduce((best, p) => (height(p) > height(best) ? p : best));
  }

  /**
   * Re-deals the tiles still on the board into a new arrangement that is
   * guaranteed solvable, keeping the same set of faces. Undoable.
   */
  shuffle(rng: Rng): void {
    const groups = new Map<string, Face[]>();
    this.present.forEach((p, i) => {
      if (!p) return;
      const f = this.faces[i]!;
      const g = groups.get(f.matchKey);
      if (g) g.push(f);
      else groups.set(f.matchKey, [f]);
    });
    const pairs: [Face, Face][] = [];
    for (const g of groups.values()) {
      for (let k = 0; k + 1 < g.length; k += 2) pairs.push([g[k]!, g[k + 1]!]);
    }
    const deal = generateDeal(this.topo, rng, { pairs, present: this.present });
    const next = this.faces.slice();
    deal.faces.forEach((f, i) => {
      if (f) next[i] = f;
    });
    this.history.push({ kind: 'shuffle', previous: this.faces });
    this.faces = next;
    this.selectedIndex = null;
  }
}
