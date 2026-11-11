import type { Card } from './cards';
import { tableau, type PileRef, type TableSpec, type TableView } from './table';

export const CARD_ASPECT = 1.4;
export const MAX_CARD_W = 104;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Metrics {
  cardW: number;
  cardH: number;
  gap: number;
  /** x of each grid column */
  colX: number[];
  topY: number;
  tableauY: number;
  boardW: number;
}

/** Narrow gaps for wide tables (Spider's 10 columns) so cards stay as large as possible. */
const gapRatio = (columns: number) => (columns >= 8 ? 0.08 : 0.14);

/**
 * Card size for a viewport: N columns plus N+1 gaps fill the width (never
 * wider), capped so the top row and a short column fit the height.
 */
export function metricsFor(viewW: number, viewH: number, columns = 7): Metrics {
  const g = gapRatio(columns);
  const byWidth = viewW / (columns + (columns + 1) * g);
  const byHeight = viewH / (CARD_ASPECT * 3.2 + 3 * g);
  const cardW = Math.floor(Math.min(byWidth, byHeight, MAX_CARD_W) * 100) / 100;
  const gap = cardW * g;
  const boardW = columns * cardW + (columns + 1) * gap;
  const offset = Math.max(0, (viewW - boardW) / 2);
  const colX = Array.from({ length: columns }, (_, i) => offset + gap + i * (cardW + gap));
  const cardH = cardW * CARD_ASPECT;
  return { cardW, cardH, gap, colX, topY: gap, tableauY: gap * 2 + cardH, boardW };
}

export interface PlacedCard {
  card: Card;
  faceUp: boolean;
  pile: PileRef;
  index: number;
  rect: Rect;
}

export interface Scene {
  metrics: Metrics;
  /** Empty-slot outlines (with optional label) for every pile. */
  slots: { pile: PileRef; rect: Rect; label?: string }[];
  /** Cards back to front, ready to paint and hit-test. */
  cards: PlacedCard[];
  /** Total height the scene needs (may exceed the viewport in extreme cases). */
  height: number;
}

/**
 * Positions every card of any solitaire game described by a TableSpec.
 * Column fans shrink so the longest column fits the viewport height: first
 * the face-up spacing, then the face-down spacing, each down to a floor
 * that keeps ranks readable.
 */
export function layoutTable(spec: TableSpec, view: TableView, viewW: number, viewH: number): Scene {
  const m = metricsFor(viewW, viewH, spec.columns);
  const { cardW: w, cardH: h, colX, topY, tableauY } = m;
  const slots: Scene['slots'] = [];
  const cards: PlacedCard[] = [];

  for (const t of spec.top) {
    const x = colX[t.col]!;
    slots.push({ pile: t.pile, rect: { x, y: topY, w, h }, ...(t.label ? { label: t.label } : {}) });
    const pile = view.cardsIn(t.pile);
    const down = view.faceDownIn(t.pile);
    const fan = t.fan ?? 1;
    const firstFanned = Math.max(0, pile.length - fan);
    pile.forEach((card, i) => {
      let dx = 0;
      let dy = 0;
      if (t.stack) {
        // A few pixels of thickness per ten cards, so the stack shows what is left.
        // Capped by the top margin so the stack never pokes off the canvas.
        const step = Math.min(Math.floor(i / 10) * 1.5, 6, m.gap * 0.9);
        dx = -step;
        dy = -step;
      } else if (fan > 1) dx = Math.max(0, i - firstFanned) * w * 0.28;
      cards.push({ card, faceUp: t.pile.kind !== 'stock' && i >= down, pile: t.pile, index: i, rect: { x: x + dx, y: topY + dy, w, h } });
    });
  }

  const piles = Array.from({ length: spec.tableau }, (_, i) => ({ ref: tableau(i), cards: view.cardsIn(tableau(i)), down: view.faceDownIn(tableau(i)) }));
  const available = Math.max(h, viewH - tableauY - m.gap - h);
  let down = h * 0.12;
  let up = h * 0.27;
  const need = (d: number, u: number) => Math.max(0, ...piles.map((p) => p.down * d + Math.max(0, p.cards.length - p.down - 1) * u));
  if (need(down, up) > available) {
    const longestUp = Math.max(1, ...piles.map((p) => p.cards.length - p.down - 1));
    const longestDown = Math.max(0, ...piles.map((p) => p.down));
    up = Math.max(h * 0.17, (available - longestDown * down) / longestUp);
    if (need(down, up) > available && longestDown > 0) {
      down = Math.max(h * 0.06, (available - longestUp * up) / longestDown);
    }
  }

  let bottom = tableauY + h;
  piles.forEach((p, col) => {
    slots.push({ pile: p.ref, rect: { x: colX[col]!, y: tableauY, w, h } });
    let y = tableauY;
    p.cards.forEach((card, i) => {
      const faceUp = i >= p.down;
      cards.push({ card, faceUp, pile: p.ref, index: i, rect: { x: colX[col]!, y, w, h } });
      bottom = Math.max(bottom, y + h);
      y += faceUp ? up : down;
    });
  });

  return { metrics: m, slots, cards, height: Math.ceil(bottom + m.gap) };
}

/**
 * Which pile a drop at (x, y) lands on. Tableau columns accept drops anywhere
 * below their top; in the top row only foundations and free cells accept drops.
 */
export function dropTarget(scene: Scene, x: number, y: number): PileRef | null {
  const { cardW: w, cardH: h, topY, tableauY, gap } = scene.metrics;
  if (y >= tableauY - gap / 2) {
    for (const s of scene.slots) {
      if (s.pile.kind !== 'tableau') continue;
      if (x >= s.rect.x - gap / 2 && x <= s.rect.x + w + gap / 2) return s.pile;
    }
    return null;
  }
  if (y < topY || y > topY + h + gap / 2) return null;
  for (const s of scene.slots) {
    if (s.pile.kind !== 'foundation' && s.pile.kind !== 'cell') continue;
    if (x >= s.rect.x - gap / 2 && x <= s.rect.x + w + gap / 2) return s.pile;
  }
  return null;
}

/** Topmost card under a point, or the empty slot there (index -1). */
export function hitTest(scene: Scene, x: number, y: number): { pile: PileRef; index: number } | null {
  for (let k = scene.cards.length - 1; k >= 0; k--) {
    const p = scene.cards[k]!;
    const r = p.rect;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { pile: p.pile, index: p.index };
  }
  for (const s of scene.slots) {
    const r = s.rect;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { pile: s.pile, index: -1 };
  }
  return null;
}
