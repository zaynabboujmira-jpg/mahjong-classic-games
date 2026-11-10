import type { MahjongGame } from '../game';
import type { Layout, Tile, TileFace } from '../types';

export interface RenderOptions {
  largeTiles: boolean;
  highlightFree: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  dark: boolean;
}

/** Comfortable touch target (WCAG 2.5.5 / Apple HIG). Enforced when the board would otherwise be unusably small. */
const MIN_TOUCH = 44;
/**
 * Smallest tile we accept in exchange for fitting the viewport width with no horizontal scroll.
 * Taps are forgiving (nearest free tile within MIN_TOUCH/2), so 36px stays comfortable in practice.
 */
const MIN_TOUCH_SOFT = 36;
const LARGE_TILE_W = 56;
/** Tile aspect: height / width. */
const ASPECT = 1.32;
/** 3D stacking offset per layer, as a fraction of tile width/height. */
const DZ_X = 0.1;
const DZ_Y = 0.12;

interface Geometry {
  /** Pixels per half-unit on the x axis. */
  ux: number;
  /** Pixels per half-unit on the y axis. */
  uy: number;
  tileW: number;
  tileH: number;
  /** Whether the logical board is rotated 90° (portrait phones). */
  rotated: boolean;
  /** CSS pixel size of the canvas. */
  cssW: number;
  cssH: number;
  offsetX: number;
  offsetY: number;
}

interface Palette {
  felt: string;
  felt2: string;
  face: string;
  faceDim: string;
  side: string;
  edge: string;
  selected: string;
  hint: string;
  focus: string;
  ink: string;
  red: string;
  green: string;
  blue: string;
  flower: string;
  season: string;
}

const LIGHT: Palette = {
  felt: '#1f6b4a',
  felt2: '#17563b',
  face: '#fffdf5',
  faceDim: '#d9d6cc',
  side: '#c9c3b2',
  edge: '#8c8674',
  selected: '#ffe08a',
  hint: '#60a5fa',
  focus: '#f97316',
  ink: '#1e3a8a',
  red: '#b91c1c',
  green: '#15803d',
  blue: '#1d4ed8',
  flower: '#be185d',
  season: '#c2410c',
};
const DARK: Palette = { ...LIGHT, felt: '#14532d', felt2: '#0f3f22', face: '#f5f1e6', faceDim: '#b8b4a8' };
const HIGH_CONTRAST: Palette = {
  ...LIGHT,
  felt: '#000000',
  felt2: '#000000',
  face: '#ffffff',
  faceDim: '#9a9a9a',
  side: '#666666',
  edge: '#000000',
  selected: '#ffff00',
  hint: '#00e5ff',
  focus: '#ff00ff',
  ink: '#000000',
  red: '#c80000',
  green: '#006400',
  blue: '#0000c8',
};

/**
 * Responsive HTML5 Canvas renderer for the Mahjong board.
 *
 * Sizing strategy (mobile first):
 *  1. Measure the container. Pick the orientation (normal or rotated 90°) that yields the
 *     larger tile, so a wide Turtle becomes a tall Turtle on a portrait phone.
 *  2. Scale tiles to fit, but never below MIN_TOUCH px wide. If that does not fit, the canvas
 *     grows past the container and the container scrolls, rather than shrinking tiles into
 *     unusable targets.
 *  3. Render at devicePixelRatio for crisp glyphs; hit-testing is done in CSS pixels and is
 *     forgiving: a tap that misses picks the nearest free tile within half a touch target.
 */
export class MahjongCanvas {
  private ctx: CanvasRenderingContext2D;
  private game: MahjongGame | null = null;
  private layout: Layout;
  private geo: Geometry | null = null;
  private raf = 0;
  private cursor: number | null = null;
  private pulse = 0;
  private pulseRaf = 0;
  private ro: ResizeObserver | null = null;
  private pointerStart: { x: number; y: number; id: number } | null = null;
  private unsubscribe: (() => void) | null = null;

  onTileTap: ((id: number) => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private container: HTMLElement,
    layout: Layout,
    private opts: RenderOptions,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.layout = layout;
    this.bindEvents();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(container);
    }
    this.resize();
  }

  setGame(game: MahjongGame) {
    this.unsubscribe?.();
    this.game = game;
    this.layout = game.layout;
    this.unsubscribe = game.subscribe(() => this.requestDraw());
    this.resize();
  }

  setOptions(opts: RenderOptions) {
    this.opts = opts;
    this.resize();
  }

  setCursor(id: number | null) {
    this.cursor = id;
    this.requestDraw();
  }

  getCursor() {
    return this.cursor;
  }

  destroy() {
    this.ro?.disconnect();
    this.unsubscribe?.();
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.pulseRaf);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
  }

  // ---------- Sizing ----------

  resize() {
    const cw = Math.max(this.container.clientWidth, 240);
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    // Height budget: the viewport minus the toolbar and some breathing room, at least 320px.
    const ch = Math.max(Math.min(this.container.clientHeight || vh, vh - 140), 320);

    const W = this.layout.width;
    const H = this.layout.height;
    const L = this.layout.layers;
    const padding = 0.5; // half-units of margin around the board

    const softMin = this.opts.largeTiles ? LARGE_TILE_W : MIN_TOUCH_SOFT;
    const hardMin = this.opts.largeTiles ? LARGE_TILE_W : MIN_TOUCH;

    const fit = (rotated: boolean) => {
      const bw = (rotated ? H : W) + padding * 2 + L * DZ_X * 2;
      const bh = (rotated ? W : H) + padding * 2 + L * DZ_Y * 2;
      // ux: px per half unit horizontally; tile width = 2*ux; tile height = 2*ux*ASPECT = 2*uy
      const byW = Math.floor(cw / bw);
      const byH = Math.floor(ch / (bh * ASPECT));
      let ux = Math.min(byW, byH);
      let scrolls = false;
      // 1. Prefer fitting both axes. 2. Else fit the width and let the page scroll vertically.
      // 3. Only as a last resort enforce the hard minimum and let the board scroll horizontally.
      if (ux * 2 < softMin) ux = byW;
      if (ux * 2 < softMin) {
        ux = Math.ceil(hardMin / 2);
        scrolls = true;
      }
      return { rotated, ux, bw, bh, scrolls };
    };

    const normal = fit(false);
    const rot = fit(true);
    const isPortrait = cw < ch;
    let best = normal;
    if (isPortrait && rot.ux > normal.ux * 1.15) best = rot;
    else if (normal.scrolls && !rot.scrolls) best = rot;

    const ux = best.ux;
    const uy = ux * ASPECT;
    const cssW = Math.ceil(best.bw * ux);
    const cssH = Math.ceil(best.bh * uy);

    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 3);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.geo = {
      ux,
      uy,
      tileW: ux * 2,
      tileH: uy * 2,
      rotated: best.rotated,
      cssW,
      cssH,
      offsetX: (padding + L * DZ_X) * ux,
      offsetY: (padding + L * DZ_Y) * uy,
    };
    this.requestDraw();
  }

  /** Top-left corner of a tile's face in CSS pixels. */
  private tileRect(t: Tile) {
    const g = this.geo!;
    const lx = g.rotated ? t.y : t.x;
    const ly = g.rotated ? this.layout.width - 2 - t.x : t.y;
    const x = g.offsetX + lx * g.ux - t.z * DZ_X * g.tileW;
    const y = g.offsetY + ly * g.uy - t.z * DZ_Y * g.tileH;
    return { x, y, w: g.tileW, h: g.tileH };
  }

  /** Centre of a tile in CSS pixels, used for keyboard navigation and forgiving taps. */
  tileCenter(id: number) {
    const t = this.game!.getTiles()[id];
    const r = this.tileRect(t);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  // ---------- Hit testing ----------

  hitTest(px: number, py: number): number | null {
    if (!this.game || !this.geo) return null;
    const tiles = this.game.getTiles();
    // Topmost first: iterate from the end (sorted z asc, y asc, x asc).
    for (let i = tiles.length - 1; i >= 0; i--) {
      const t = tiles[i];
      if (t.removed) continue;
      const r = this.tileRect(t);
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return t.id;
    }
    // Forgiving: nearest free tile within half a touch target.
    let best: number | null = null;
    let bestD = (MIN_TOUCH / 2) ** 2;
    for (const t of this.game.getFreeTiles()) {
      const c = this.tileCenter(t.id);
      const d = (c.x - px) ** 2 + (c.y - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = t.id;
      }
    }
    return best;
  }

  private bindEvents() {
    this.canvas.style.touchAction = 'manipulation';
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerCancel);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointerStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  private onPointerCancel = () => {
    this.pointerStart = null;
  };
  private onPointerUp = (e: PointerEvent) => {
    const s = this.pointerStart;
    this.pointerStart = null;
    if (!s || s.id !== e.pointerId) return;
    // Ignore drags/scrolls.
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 12) return;
    const rect = this.canvas.getBoundingClientRect();
    const id = this.hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (id !== null) this.onTileTap?.(id);
  };

  // ---------- Drawing ----------

  requestDraw() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.draw());
    const wantsPulse = !!this.game?.getHint() && !this.opts.reducedMotion;
    if (wantsPulse && !this.pulseRaf) this.startPulse();
    if (!wantsPulse && this.pulseRaf) {
      cancelAnimationFrame(this.pulseRaf);
      this.pulseRaf = 0;
    }
  }

  private startPulse() {
    const tick = (t: number) => {
      this.pulse = (Math.sin(t / 250) + 1) / 2;
      this.draw();
      this.pulseRaf = this.game?.getHint() ? requestAnimationFrame(tick) : 0;
    };
    this.pulseRaf = requestAnimationFrame(tick);
  }

  private palette(): Palette {
    if (this.opts.highContrast) return HIGH_CONTRAST;
    return this.opts.dark ? DARK : LIGHT;
  }

  draw() {
    if (!this.geo) return;
    const ctx = this.ctx;
    const g = this.geo;
    const p = this.palette();

    // Felt background
    const grad = ctx.createLinearGradient(0, 0, 0, g.cssH);
    grad.addColorStop(0, p.felt);
    grad.addColorStop(1, p.felt2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.cssW, g.cssH);

    if (!this.game) return;
    const snap = this.game.snapshot();
    const hint = this.game.getHint();
    const free = new Set(this.game.getFreeTiles().map((t) => t.id));

    for (const t of snap.tiles) {
      if (t.removed) continue;
      const r = this.tileRect(t);
      const isFree = free.has(t.id);
      const isSel = snap.selected === t.id;
      const isHint = !!hint && (hint[0] === t.id || hint[1] === t.id);
      const isCursor = this.cursor === t.id;
      this.drawTile(ctx, r.x, r.y, r.w, r.h, t.face, p, {
        dim: this.opts.highlightFree && !isFree,
        selected: isSel,
        hint: isHint,
        cursor: isCursor,
      });
    }
  }

  private drawTile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    face: TileFace,
    p: Palette,
    state: { dim: boolean; selected: boolean; hint: boolean; cursor: boolean },
  ) {
    const r = Math.max(3, w * 0.09);
    const sx = w * DZ_X;
    const sy = h * DZ_Y;

    // Side faces (right and bottom) to suggest depth.
    ctx.fillStyle = p.side;
    roundRect(ctx, x + sx, y + sy, w, h, r);
    ctx.fill();
    ctx.fillStyle = p.edge;
    ctx.globalAlpha = 0.35;
    roundRect(ctx, x + sx, y + sy, w, h, r);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Face
    ctx.fillStyle = state.selected ? p.selected : state.dim ? p.faceDim : p.face;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.lineWidth = Math.max(1, w * 0.03);
    ctx.strokeStyle = p.edge;
    ctx.stroke();

    if (state.hint) {
      ctx.lineWidth = Math.max(2, w * 0.08);
      ctx.strokeStyle = p.hint;
      ctx.globalAlpha = this.opts.reducedMotion ? 1 : 0.5 + this.pulse * 0.5;
      roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (state.cursor) {
      ctx.lineWidth = Math.max(2, w * 0.07);
      ctx.strokeStyle = p.focus;
      ctx.setLineDash([4, 3]);
      roundRect(ctx, x - 2, y - 2, w + 4, h + 4, r);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    this.drawFace(ctx, x, y, w, h, face, p, state.dim);
  }

  private drawFace(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: TileFace, p: Palette, dim: boolean) {
    ctx.save();
    ctx.globalAlpha = dim ? 0.55 : 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = x + w / 2;
    const cy = y + h / 2;
    const cjk = `"Noto Sans CJK TC","Noto Sans TC","PingFang TC","Microsoft JhengHei","Hiragino Sans","Yu Gothic",serif`;

    switch (f.suit) {
      case 'character': {
        ctx.fillStyle = p.ink;
        ctx.font = `700 ${h * 0.4}px ${cjk}`;
        ctx.fillText(f.glyph, cx, y + h * 0.32);
        ctx.fillStyle = p.red;
        ctx.font = `700 ${h * 0.36}px ${cjk}`;
        ctx.fillText('萬', cx, y + h * 0.71);
        break;
      }
      case 'bamboo': {
        this.drawBamboo(ctx, x, y, w, h, f.rank, p);
        break;
      }
      case 'circle': {
        this.drawCircles(ctx, x, y, w, h, f.rank, p);
        break;
      }
      case 'wind': {
        ctx.fillStyle = p.ink;
        ctx.font = `700 ${h * 0.5}px ${cjk}`;
        ctx.fillText(f.glyph, cx, cy);
        break;
      }
      case 'dragon': {
        if (f.rank === 1) {
          ctx.fillStyle = p.red;
          ctx.font = `700 ${h * 0.5}px ${cjk}`;
          ctx.fillText('中', cx, cy);
        } else if (f.rank === 2) {
          ctx.fillStyle = p.green;
          ctx.font = `700 ${h * 0.5}px ${cjk}`;
          ctx.fillText('發', cx, cy);
        } else {
          ctx.strokeStyle = p.blue;
          ctx.lineWidth = Math.max(2, w * 0.06);
          ctx.strokeRect(x + w * 0.22, y + h * 0.2, w * 0.56, h * 0.6);
        }
        break;
      }
      case 'flower':
      case 'season': {
        const col = f.suit === 'flower' ? p.flower : p.season;
        ctx.fillStyle = col;
        ctx.font = `700 ${h * 0.42}px ${cjk}`;
        ctx.fillText(f.glyph, cx, y + h * 0.42);
        ctx.font = `600 ${h * 0.16}px system-ui, sans-serif`;
        ctx.fillText(f.suit === 'flower' ? 'FLOWER' : 'SEASON', cx, y + h * 0.8);
        break;
      }
    }
    ctx.restore();
  }

  private drawBamboo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, p: Palette) {
    if (n === 1) {
      // The "one bamboo" is traditionally a bird; we draw a single tall stick with a red cap.
      ctx.fillStyle = p.green;
      roundRect(ctx, x + w * 0.4, y + h * 0.22, w * 0.2, h * 0.56, w * 0.08);
      ctx.fill();
      ctx.fillStyle = p.red;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h * 0.22, w * 0.11, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const cols = n <= 3 ? 1 : n <= 6 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const padX = w * 0.18;
    const padY = h * 0.14;
    const cellW = (w - padX * 2) / cols;
    const cellH = (h - padY * 2) / rows;
    const stickW = Math.max(3, cellW * 0.42);
    const stickH = cellH * 0.78;
    const colors = [p.green, p.blue, p.red];
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols && i < n; c++, i++) {
        const cx = x + padX + cellW * (c + 0.5);
        const cy = y + padY + cellH * (r + 0.5);
        ctx.fillStyle = colors[(r + c) % colors.length];
        roundRect(ctx, cx - stickW / 2, cy - stickH / 2, stickW, stickH, stickW / 2);
        ctx.fill();
      }
    }
  }

  private drawCircles(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, p: Palette) {
    const cols = n === 1 ? 1 : n <= 4 ? 2 : n <= 6 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const padX = w * 0.16;
    const padY = h * 0.14;
    const cellW = (w - padX * 2) / cols;
    const cellH = (h - padY * 2) / rows;
    const rad = Math.max(2.5, Math.min(cellW, cellH) * (n === 1 ? 0.42 : 0.34));
    const colors = [p.blue, p.green, p.red];
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols && i < n; c++, i++) {
        const cx = x + padX + cellW * (c + 0.5);
        const cy = y + padY + cellH * (r + 0.5);
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.face;
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
