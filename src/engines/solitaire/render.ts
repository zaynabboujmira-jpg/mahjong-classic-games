import { RANK_LABELS, SUIT_SYMBOLS, isRed, type Card } from './cards';
import { samePile, type PileRef } from './table';
import type { Rect, Scene } from './layout';

export interface CardRef {
  pile: PileRef;
  index: number;
}

export interface Overlay {
  /** Picked-up cards (index..end of that pile). */
  selected: CardRef | null;
  /** Keyboard focus: a card, or a pile slot when index is -1. */
  focus: CardRef | null;
  /** Hinted move: source card and destination pile. */
  hint: { from: CardRef; to: PileRef } | null;
  /** Cards being dragged follow the pointer by (dx, dy). */
  drag: (CardRef & { dx: number; dy: number }) | null;
}

const C = {
  face: '#fffdf8',
  edge: '#bfb6a3',
  red: '#c2272d',
  black: '#1b2823',
  back1: '#0f5c4a',
  back2: '#17785f',
  slot: 'rgba(255,255,255,0.28)',
  slotText: 'rgba(255,255,255,0.45)',
  selected: 'rgba(245, 158, 11, 0.30)',
  selectedRing: '#d97706',
  hint: '#14b8a6',
  focus: '#60a5fa',
};
const FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
/** U+FE0E asks for the text (not emoji) presentation of suit symbols. */
const TEXT_VS = '︎';

function roundRect(g: CanvasRenderingContext2D, r: Rect, radius: number) {
  g.beginPath();
  g.roundRect(r.x, r.y, r.w, r.h, radius);
}

const covers = (ref: CardRef | null, pile: PileRef, index: number) =>
  !!ref && samePile(ref.pile, pile) && index >= ref.index;

/**
 * Paints a Klondike scene. Card faces and the back are drawn once per size
 * into offscreen bitmaps, so a frame is ~52 image blits plus a few outlines.
 */
export class CardRenderer {
  private readonly g: CanvasRenderingContext2D;
  private dpr = 1;
  private size = { w: 0, h: 0 };
  private cache = new Map<string, HTMLCanvasElement>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const g = canvas.getContext('2d');
    if (!g) throw new Error('Canvas 2D is not supported');
    this.g = g;
  }

  resize(width: number, height: number, dpr: number): void {
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  draw(scene: Scene, o: Overlay): void {
    const { g } = this;
    const { cardW: w, cardH: h } = scene.metrics;
    if (w !== this.size.w || h !== this.size.h) {
      this.cache.clear();
      this.size = { w, h };
    }
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
    const radius = w * 0.08;

    for (const s of scene.slots) {
      g.strokeStyle = C.slot;
      g.lineWidth = 1.5;
      roundRect(g, s.rect, radius);
      g.stroke();
      const label = s.label;
      if (label) {
        g.fillStyle = C.slotText;
        g.font = `700 ${w * 0.4}px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(label, s.rect.x + w / 2, s.rect.y + h / 2);
      }
    }

    const dragged: typeof scene.cards = [];
    for (const p of scene.cards) {
      if (o.drag && covers(o.drag, p.pile, p.index)) {
        dragged.push(p);
        continue;
      }
      this.paintCard(p.card, p.faceUp, p.rect, radius);
      if (covers(o.selected, p.pile, p.index)) this.tint(p.rect, radius, C.selected, C.selectedRing);
    }

    if (o.hint) {
      const src = scene.cards.find((p) => samePile(p.pile, o.hint!.from.pile) && p.index === o.hint!.from.index);
      if (src) this.ring(src.rect, radius, C.hint, 3);
      const dest = topRect(scene, o.hint.to);
      if (dest) this.ring(dest, radius, C.hint, 3);
    }

    if (o.focus) {
      const r =
        o.focus.index >= 0
          ? scene.cards.find((p) => samePile(p.pile, o.focus!.pile) && p.index === o.focus!.index)?.rect
          : scene.slots.find((s) => samePile(s.pile, o.focus!.pile))?.rect;
      if (r) this.ring({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, radius, C.focus, 3);
    }

    if (o.drag) {
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.35)';
      g.shadowBlur = 14;
      g.shadowOffsetY = 6;
      for (const p of dragged) {
        this.paintCard(p.card, p.faceUp, { ...p.rect, x: p.rect.x + o.drag.dx, y: p.rect.y + o.drag.dy }, radius);
      }
      g.restore();
    }
  }

  private tint(r: Rect, radius: number, fill: string, ring: string) {
    this.g.fillStyle = fill;
    roundRect(this.g, r, radius);
    this.g.fill();
    this.ring(r, radius, ring, 2);
  }

  private ring(r: Rect, radius: number, color: string, width: number) {
    this.g.strokeStyle = color;
    this.g.lineWidth = width;
    roundRect(this.g, r, radius);
    this.g.stroke();
  }

  private paintCard(card: Card, faceUp: boolean, r: Rect, radius: number) {
    const key = faceUp ? String(card.id) : 'back';
    let bmp = this.cache.get(key);
    if (!bmp) {
      bmp = this.renderBitmap(faceUp ? card : null, r.w, r.h, radius);
      this.cache.set(key, bmp);
    }
    this.g.drawImage(bmp, r.x, r.y, r.w, r.h);
  }

  private renderBitmap(card: Card | null, w: number, h: number, radius: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * this.dpr);
    c.height = Math.ceil(h * this.dpr);
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    const box = { x: 0.5, y: 0.5, w: w - 1, h: h - 1 };

    if (!card) {
      g.fillStyle = C.back1;
      roundRect(g, box, radius);
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = C.back2;
      g.lineWidth = Math.max(1, w * 0.035);
      for (let d = -h; d < w + h; d += w * 0.16) {
        g.beginPath();
        g.moveTo(d, 0);
        g.lineTo(d + h, h);
        g.moveTo(d + h, 0);
        g.lineTo(d, h);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = '#fbf6e9';
      g.lineWidth = Math.max(1.5, w * 0.04);
      roundRect(g, { x: w * 0.07, y: w * 0.07, w: w * 0.86, h: h - w * 0.14 }, radius * 0.7);
      g.stroke();
      return c;
    }

    g.fillStyle = C.face;
    roundRect(g, box, radius);
    g.fill();
    g.strokeStyle = C.edge;
    g.lineWidth = 1;
    g.stroke();

    const ink = isRed(card) ? C.red : C.black;
    const rank = RANK_LABELS[card.rank]!;
    const suit = SUIT_SYMBOLS[card.suit] + TEXT_VS;
    g.fillStyle = ink;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    // Corner index sized for small phone cards: rank and suit side by side.
    const idx = w * (rank === '10' ? 0.3 : 0.34);
    g.font = `800 ${idx}px ${FONT}`;
    g.fillText(rank, w * 0.08, h * 0.05);
    const rankW = g.measureText(rank).width;
    g.font = `700 ${w * 0.3}px ${FONT}`;
    g.fillText(suit, w * 0.1 + rankW, h * 0.055);

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (card.rank > 10) {
      // Court cards: framed letter.
      const fx = w * 0.2;
      const fy = h * 0.36;
      g.strokeStyle = ink;
      g.lineWidth = Math.max(1, w * 0.025);
      g.strokeRect(fx, fy, w - fx * 2, h * 0.52);
      g.font = `800 ${w * 0.4}px ${FONT}`;
      g.fillText(rank, w / 2, h * 0.55);
      g.font = `700 ${w * 0.22}px ${FONT}`;
      g.fillText(suit, w / 2, h * 0.77);
    } else {
      g.font = `700 ${w * (card.rank === 1 ? 0.62 : 0.5)}px ${FONT}`;
      g.fillText(suit, w / 2, h * 0.62);
    }
    return c;
  }
}

/** Rect of a pile's top card, or its slot when empty (for highlighting a destination). */
function topRect(scene: Scene, pile: PileRef): Rect | undefined {
  let last: Rect | undefined;
  for (const p of scene.cards) if (samePile(p.pile, pile)) last = p.rect;
  return last ?? scene.slots.find((s) => samePile(s.pile, pile))?.rect;
}
