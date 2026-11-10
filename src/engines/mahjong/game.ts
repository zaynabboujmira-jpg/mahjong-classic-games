import { createRng, type Rng } from '../core/rng';
import { availableMoves, freeTiles, isFree, presentTiles } from './board';
import { generateDeal, reshuffleRemaining } from './generator';
import { matches } from './tiles';
import type { Layout, Move, Tile } from './types';

export type GameStatus = 'playing' | 'won' | 'stuck';

export interface GameSnapshot {
  tiles: readonly Tile[];
  selected: number | null;
  status: GameStatus;
  moves: number;
  remaining: number;
  shuffles: number;
  seed: string;
  layoutSlug: string;
}

export type Listener = (snap: GameSnapshot) => void;

/**
 * Pure game state machine. No DOM, no timers. The renderer and UI subscribe to changes.
 */
export class MahjongGame {
  readonly layout: Layout;
  readonly seed: string;
  private rng: Rng;
  private tiles: Tile[] = [];
  private history: Move[] = [];
  private selected: number | null = null;
  private shuffles = 0;
  private listeners = new Set<Listener>();
  private hintPair: [number, number] | null = null;

  constructor(layout: Layout, seed: string) {
    this.layout = layout;
    this.seed = seed;
    this.rng = createRng(`${layout.slug}:${seed}`);
    this.tiles = generateDeal(layout, this.rng).tiles;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }

  snapshot(): GameSnapshot {
    const present = presentTiles(this.tiles);
    let status: GameStatus = 'playing';
    if (present.length === 0) status = 'won';
    else if (availableMoves(this.tiles).length === 0) status = 'stuck';
    return {
      tiles: this.tiles,
      selected: this.selected,
      status,
      moves: this.history.length,
      remaining: present.length,
      shuffles: this.shuffles,
      seed: this.seed,
      layoutSlug: this.layout.slug,
    };
  }

  getTiles(): readonly Tile[] {
    return this.tiles;
  }

  isTileFree(id: number): boolean {
    const t = this.tiles[id];
    return !t.removed && isFree(t, presentTiles(this.tiles));
  }

  getFreeTiles(): Tile[] {
    return freeTiles(this.tiles);
  }

  getHint(): [number, number] | null {
    return this.hintPair;
  }

  /**
   * Handles a tap/click on a tile. Returns what happened so the UI can animate or announce.
   */
  select(id: number): 'selected' | 'deselected' | 'matched' | 'blocked' | 'mismatch' {
    const t = this.tiles[id];
    if (!t || t.removed) return 'blocked';
    if (!this.isTileFree(id)) {
      return 'blocked';
    }
    this.hintPair = null;
    if (this.selected === null) {
      this.selected = id;
      this.emit();
      return 'selected';
    }
    if (this.selected === id) {
      this.selected = null;
      this.emit();
      return 'deselected';
    }
    const s = this.tiles[this.selected];
    if (matches(s.face, t.face)) {
      s.removed = true;
      t.removed = true;
      this.history.push({ a: s.id, b: t.id });
      this.selected = null;
      this.emit();
      return 'matched';
    }
    // Different tile: switch selection rather than punish.
    this.selected = id;
    this.emit();
    return 'mismatch';
  }

  clearSelection() {
    if (this.selected !== null) {
      this.selected = null;
      this.emit();
    }
  }

  undo(): boolean {
    const m = this.history.pop();
    if (!m) return false;
    this.tiles[m.a].removed = false;
    this.tiles[m.b].removed = false;
    this.selected = null;
    this.hintPair = null;
    this.emit();
    return true;
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  /** Picks a random available move and highlights it. */
  hint(): [number, number] | null {
    const moves = availableMoves(this.tiles);
    if (moves.length === 0) {
      this.hintPair = null;
      this.emit();
      return null;
    }
    const [a, b] = moves[this.rng.int(moves.length)];
    this.hintPair = [a.id, b.id];
    this.selected = null;
    this.emit();
    return this.hintPair;
  }

  /** Reshuffles remaining tiles into a solvable arrangement. Undo history is cleared. */
  shuffle(): boolean {
    const result = reshuffleRemaining(this.tiles, this.rng);
    if (!result) return false;
    this.shuffles++;
    this.history = [];
    this.selected = null;
    this.hintPair = null;
    this.emit();
    return true;
  }
}
