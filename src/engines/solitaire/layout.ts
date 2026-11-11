import type { Card } from './cards';
import { foundation, tableau, STOCK, WASTE, type KlondikeState, type PileRef } from './klondike';

export const CARD_ASPECT = 1.4;
export const MAX_CARD_W = 104;
/** Gap between columns as a fraction of card width. */
const GAP = 0.14;

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
  /** x of each of the 7 columns */
  colX: number[];
  topY: number;
  tableauY: number;
  boardW: number;
}

/**
 * Card size for a viewport: seven columns plus eight gaps fill the width
 * (never wider), capped so the top row and a short column fit the height.
 */
export function metricsFor(viewW: number, viewH: number): Metrics {
  const byWidth = viewW / (7 + 8 * GAP);
  const byHeight = viewH / (CARD_ASPECT * 3.2 + 3 * GAP);
  const cardW = Math.floor(Math.min(byWidth, byHeight, MAX_CARD_W) * 100) / 100;
  const gap = cardW * GAP;
  const boardW = 7 * cardW + 8 * gap;
  const offset = Math.max(0, (viewW - boardW) / 2);
  const colX = Array.from({ length: 7 }, (_, i) => offset + gap + i * (cardW + gap));
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
  /** Empty-slot outlines and drop zones for every pile. */
  slots: { pile: PileRef; rect: Rect }[];
  /** Cards back to front, ready to paint and hit-test. */
  cards: PlacedCard[];
  /** Total height the scene needs (may exceed the viewport in extreme cases). */
  height: number;
}

/**
 * Positions every card. Column fans shrink so the longest column fits the
 * viewport height: first the face-up spacing, then the face-down spacing,
 * each down to a floor that keeps ranks readable.
 */
export function layoutScene(state: KlondikeState, viewW: number, viewH: number, drawMode: 1 | 3): Scene {
  const m = metricsFor(viewW, viewH);
  const { cardW: w, cardH: h, colX, topY, tableauY } = m;
  const slots: Scene['slots'] = [];
  const cards: PlacedCard[] = [];

  slots.push({ pile: STOCK, rect: { x: colX[0]!, y: topY, w, h } });
  slots.push({ pile: WASTE, rect: { x: colX[1]!, y: topY, w, h } });
  for (let f = 0; f < 4; f++) slots.push({ pile: foundation(f), rect: { x: colX[3 + f]!, y: topY, w, h } });

  // Stock: draw a small stack so its thickness hints at how many cards remain.
  state.stock.forEach((card, i) => {
    const step = Math.min(Math.floor(i / 8), 2) * 1.5;
    cards.push({ card, faceUp: false, pile: STOCK, index: i, rect: { x: colX[0]! - step, y: topY - step, w, h } });
  });

  // Waste: in Draw 3 the top three cards fan to the right.
  const fanX = w * 0.28;
  const visible = drawMode === 3 ? 3 : 1;
  const firstFanned = Math.max(0, state.waste.length - visible);
  state.waste.forEach((card, i) => {
    const k = Math.max(0, i - firstFanned);
    cards.push({ card, faceUp: true, pile: WASTE, index: i, rect: { x: colX[1]! + k * fanX, y: topY, w, h } });
  });

  state.foundations.forEach((pile, f) =>
    pile.forEach((card, i) => cards.push({ card, faceUp: true, pile: foundation(f), index: i, rect: { x: colX[3 + f]!, y: topY, w, h } })),
  );

  // Tableau fans.
  const available = Math.max(h, viewH - tableauY - m.gap - h);
  let down = h * 0.12;
  let up = h * 0.27;
  const need = (d: number, u: number) =>
    Math.max(...state.tableau.map((t) => t.faceDown * d + Math.max(0, t.cards.length - t.faceDown - 1) * u));
  if (need(down, up) > available) {
    const minUp = h * 0.17;
    const minDown = h * 0.06;
    const longestUp = Math.max(1, ...state.tableau.map((t) => t.cards.length - t.faceDown - 1));
    const longestDown = Math.max(...state.tableau.map((t) => t.faceDown));
    up = Math.max(minUp, (available - longestDown * down) / longestUp);
    if (need(down, up) > available && longestDown > 0) {
      down = Math.max(minDown, (available - longestUp * up) / longestDown);
    }
  }

  let bottom = tableauY + h;
  state.tableau.forEach((t, col) => {
    slots.push({ pile: tableau(col), rect: { x: colX[col]!, y: tableauY, w, h } });
    let y = tableauY;
    t.cards.forEach((card, i) => {
      const faceUp = i >= t.faceDown;
      cards.push({ card, faceUp, pile: tableau(col), index: i, rect: { x: colX[col]!, y, w, h } });
      bottom = Math.max(bottom, y + h);
      y += faceUp ? up : down;
    });
  });

  return { metrics: m, slots, cards, height: Math.ceil(bottom + m.gap) };
}

/** Which pile a drop at (x, y) lands on. Tableau columns accept drops anywhere below their top. */
export function dropTarget(scene: Scene, x: number, y: number): PileRef | null {
  const { cardW: w, cardH: h, colX, topY, tableauY, gap } = scene.metrics;
  for (let col = 0; col < 7; col++) {
    const left = colX[col]! - gap / 2;
    if (x < left || x > left + w + gap) continue;
    if (y >= tableauY - gap / 2) return tableau(col);
    if (y >= topY && y <= topY + h + gap / 2) {
      if (col >= 3) return foundation(col - 3);
      return null;
    }
  }
  return null;
}

/** Topmost card under a point, or the empty slot there. */
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
