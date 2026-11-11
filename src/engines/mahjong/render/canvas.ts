import { boundsOf } from '../board';
import { projectSlot, type Fit, type TileRect } from '../fit';
import type { Bounds, Face, Slot } from '../types';
import { drawFace, roundRect } from './faces';

export interface DrawState {
  isPresent(i: number): boolean;
  isFree(i: number): boolean;
  faceAt(i: number): Face | null;
  selected: number | null;
  hint: readonly number[];
  focus: number | null;
  dimBlocked: boolean;
}

const COLORS = {
  face: '#fbf6e9',
  faceShade: '#efe6cf',
  edge: '#a8987a',
  side: '#d9ccab',
  sideDark: '#b3a27c',
  selected: 'rgba(245, 158, 11, 0.38)',
  selectedRing: '#d97706',
  hintRing: '#0d9488',
  hint: 'rgba(20, 184, 166, 0.28)',
  focusRing: '#2563eb',
  dim: 'rgba(40, 32, 20, 0.28)',
};

/**
 * Draws a Mahjong board on a <canvas>. Knows nothing about rules: it is told
 * which tiles exist and how to highlight them. Each face's artwork is drawn
 * once per size into an offscreen bitmap, so a full redraw is ~150 image
 * blits and a few paths, well under a millisecond on mid-range phones.
 */
export class BoardRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bounds: Bounds;
  private rects: TileRect[] = [];
  /** Slot indices in painter's order (back to front). */
  private order: number[] = [];
  private fit: Fit | null = null;
  private dpr = 1;
  private faceCache = new Map<string, HTMLCanvasElement>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly slots: readonly Slot[],
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    this.bounds = boundsOf(slots);
  }

  get boardBounds(): Bounds {
    return this.bounds;
  }

  resize(fit: Fit, dpr: number): void {
    this.fit = fit;
    this.dpr = dpr;
    this.canvas.width = Math.round(fit.boardW * dpr);
    this.canvas.height = Math.round(fit.boardH * dpr);
    this.canvas.style.width = `${fit.boardW}px`;
    this.canvas.style.height = `${fit.boardH}px`;
    this.rects = this.slots.map((s) => projectSlot(s, this.bounds, fit));
    // Lower layers first; within a layer, right-to-left then top-to-bottom so
    // the left/bottom edges of nearer tiles overlap the ones behind them.
    this.order = this.slots
      .map((_, i) => i)
      .sort((a, b) => {
        const sa = this.slots[a]!;
        const sb = this.slots[b]!;
        const ra = this.rects[a]!;
        const rb = this.rects[b]!;
        return sa.z - sb.z || rb.x - ra.x || ra.y - rb.y;
      });
    this.faceCache.clear();
  }

  rectOf(i: number): TileRect | undefined {
    return this.rects[i];
  }

  /** Topmost present tile under a point in CSS pixels relative to the canvas. */
  hitTest(x: number, y: number, isPresent: (i: number) => boolean): number | null {
    for (let k = this.order.length - 1; k >= 0; k--) {
      const i = this.order[k]!;
      if (!isPresent(i)) continue;
      const r = this.rects[i]!;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return null;
  }

  draw(state: DrawState): void {
    const fit = this.fit;
    if (!fit) return;
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, fit.boardW, fit.boardH);
    const radius = fit.tileSize * 0.1;
    const d = fit.depth;

    for (const i of this.order) {
      if (!state.isPresent(i)) continue;
      const r = this.rects[i]!;
      const face = state.faceAt(i);

      // Tile thickness: a slab offset down-left behind the face.
      ctx.fillStyle = COLORS.sideDark;
      roundRect(ctx, r.x - d, r.y + d, r.w, r.h, radius);
      ctx.fill();
      ctx.fillStyle = COLORS.side;
      roundRect(ctx, r.x - d * 0.5, r.y + d * 0.5, r.w, r.h, radius);
      ctx.fill();

      if (face) ctx.drawImage(this.faceBitmap(face, r.w, r.h, radius), r.x, r.y, r.w, r.h);

      const overlay =
        i === state.selected ? COLORS.selected : state.hint.includes(i) ? COLORS.hint : state.dimBlocked && !state.isFree(i) ? COLORS.dim : null;
      if (overlay) {
        ctx.fillStyle = overlay;
        roundRect(ctx, r.x, r.y, r.w, r.h, radius);
        ctx.fill();
      }
      const ring =
        i === state.selected ? COLORS.selectedRing : state.hint.includes(i) ? COLORS.hintRing : i === state.focus ? COLORS.focusRing : null;
      if (ring) {
        ctx.strokeStyle = ring;
        ctx.lineWidth = Math.max(2, fit.tileSize * 0.07);
        roundRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, radius);
        ctx.stroke();
      }
      if (i === state.focus && ring !== COLORS.focusRing) {
        // Keyboard focus on a selected/hinted tile: add an outer ring too.
        ctx.strokeStyle = COLORS.focusRing;
        ctx.lineWidth = 2;
        roundRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, radius);
        ctx.stroke();
      }
    }
  }

  private faceBitmap(face: Face, w: number, h: number, radius: number): HTMLCanvasElement {
    const cached = this.faceCache.get(face.id);
    if (cached) return cached;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * this.dpr);
    c.height = Math.ceil(h * this.dpr);
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, COLORS.face);
    grad.addColorStop(1, COLORS.faceShade);
    g.fillStyle = grad;
    roundRect(g, 0.5, 0.5, w - 1, h - 1, radius);
    g.fill();
    g.strokeStyle = COLORS.edge;
    g.lineWidth = 1;
    g.stroke();
    drawFace(g, face, w, h);
    this.faceCache.set(face.id, c);
    return c;
  }
}
