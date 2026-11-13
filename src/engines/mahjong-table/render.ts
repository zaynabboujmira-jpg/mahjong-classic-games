import { FACES } from '../mahjong/tiles';
import { drawFace, roundRect } from '../mahjong/render/faces';
import { JOKER, WINDS, type Meld, type Tile } from './tiles';
import { SEAT_NAMES, type TableGame } from './game';

/*
 * Draws the four-seat table: your hand along the bottom (one row, or two on
 * narrow screens), the other three players around the edges, each player's
 * discards (the "river") in front of them, and the latest discard large in
 * the middle. Pure drawing plus hit-testing of your own hand.
 */

const ASPECT = 1.32;
const C = {
  face: '#fbf6e9',
  edge: '#a8987a',
  side: '#d9ccab',
  back: '#0f5c4a',
  backEdge: '#0b4738',
  selected: '#d97706',
  hint: '#0d9488',
  focus: '#2563eb',
  text: '#f2f7f4',
  muted: '#bcd6cb',
  turn: '#f5d37a',
  last: '#f59e0b',
};

export interface TableView {
  selected: ReadonlySet<number>;
  hint: number;
  focus: number;
  /** Seat whose turn or decision it is, for the name highlight. */
  active: number;
  scores: readonly number[];
  reveal: boolean;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TableLayout {
  w: number;
  h: number;
  /** Hand tile width. */
  tw: number;
  rows: number;
  handRects: { id: number; rect: Rect }[];
}

export class TableRenderer {
  private ctx: CanvasRenderingContext2D;
  private cache = new Map<string, HTMLCanvasElement>();
  layout: TableLayout = { w: 0, h: 0, tw: 0, rows: 1, handRects: [] };
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(w: number, h: number, dpr: number) {
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout = { ...this.layout, w, h };
    this.cache.clear();
  }

  /** Hand tile under a point, or -1. */
  tileAt(x: number, y: number): number {
    for (const { id, rect: r } of this.layout.handRects) if (x >= r.x && x <= r.x + r.w && y >= r.y - r.h * 0.2 && y <= r.y + r.h) return id;
    return -1;
  }

  /** Face bitmap per kind and size, drawn once. */
  private faceBitmap(kind: number, w: number, h: number): HTMLCanvasElement {
    const key = `${kind}:${Math.round(w * 10)}`;
    let c = this.cache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * this.dpr));
      c.height = Math.max(1, Math.round(h * this.dpr));
      const g = c.getContext('2d')!;
      g.scale(this.dpr, this.dpr);
      if (kind === JOKER) {
        g.fillStyle = '#7b3fa0';
        g.font = `800 ${h * 0.42}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('J', w / 2, w < 34 ? h * 0.52 : h * 0.4);
        if (w >= 34) {
          // "JOKER" only where it fits; small tiles show the J alone.
          g.font = `700 ${w * 0.19}px system-ui, sans-serif`;
          g.fillStyle = '#b7791f';
          g.fillText('JOKER', w / 2, h * 0.78);
        }
      } else drawFace(g, FACES[kind]!, w, h);
      this.cache.set(key, c);
    }
    return c;
  }

  private tile(x: number, y: number, w: number, kind: number | null, ring?: string) {
    const { ctx } = this;
    const h = w * ASPECT;
    const r = Math.max(2, w * 0.12);
    const depth = Math.max(1.5, w * 0.07);
    ctx.fillStyle = kind === null ? C.backEdge : C.side;
    roundRect(ctx, x, y + depth, w, h, r);
    ctx.fill();
    ctx.fillStyle = kind === null ? C.back : C.face;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.strokeStyle = kind === null ? C.backEdge : C.edge;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (kind !== null) ctx.drawImage(this.faceBitmap(kind, w, h), x, y, w, h);
    if (ring) {
      ctx.strokeStyle = ring;
      ctx.lineWidth = Math.max(2, w * 0.08);
      roundRect(ctx, x - 1, y - 1, w + 2, h + 2, r + 1);
      ctx.stroke();
    }
  }

  private label(text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left') {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  }

  /** Melds in a row starting at (x, y); returns the width used. */
  private melds(melds: readonly Meld[], x: number, y: number, w: number, hideConcealed: boolean): number {
    let cx = x;
    for (const m of melds) {
      m.tiles.forEach((t, i) => {
        const hidden = hideConcealed && m.concealed && (i === 0 || i === 3);
        this.tile(cx, y, w, hidden ? null : t.kind);
        cx += w;
      });
      cx += w * 0.35;
    }
    return cx - x;
  }

  private river(tiles: readonly Tile[], r: Rect, cols: number, tw: number, last: Tile | null) {
    const th = tw * ASPECT;
    tiles.forEach((t, i) => {
      const x = r.x + (i % cols) * tw;
      const y = r.y + Math.floor(i / cols) * (th + 1);
      if (y + th > r.y + r.h + th * 0.5) return;
      this.tile(x, y, tw, t.kind, last && t.id === last.id ? C.last : undefined);
    });
  }

  draw(game: TableGame, v: TableView) {
    const { ctx } = this;
    const { w, h } = this.layout;
    ctx.clearRect(0, 0, w, h);
    const pad = Math.max(6, Math.min(14, w * 0.015));
    const me = game.seats[0]!;
    const turnId = game.phase === 'turn' && game.current === 0 ? game.drawnId : -1;

    // ---- your hand (bottom), drawn tile set slightly apart
    const hand = me.hand.filter((t) => t.id !== turnId);
    const drawn = me.hand.find((t) => t.id === turnId);
    const count = me.hand.length + (drawn ? 0.4 : 0);
    let rows = 1;
    let tw = Math.min(54, (w - pad * 2) / count);
    if (tw < 34 && w < 700) {
      rows = 2;
      tw = Math.min(54, (w - pad * 2) / Math.ceil(count / 2));
    }
    const th = tw * ASPECT;
    const perRow = rows === 1 ? me.hand.length : Math.ceil(me.hand.length / 2);
    const ordered = drawn ? [...hand, drawn] : hand;
    const handTop = h - pad - rows * (th + 4);
    const handRects: TableLayout['handRects'] = [];
    ordered.forEach((t, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const rowCount = Math.min(perRow, ordered.length - row * perRow);
      const rowW = rowCount * tw + (drawn && i >= ordered.length - 1 && row === rows - 1 ? tw * 0.4 : 0);
      let x = (w - rowW) / 2 + col * tw;
      if (drawn && t === drawn) x += tw * 0.4;
      const lift = v.selected.has(t.id) ? th * 0.18 : 0;
      const y = handTop + row * (th + 4) - lift;
      const ring = v.selected.has(t.id) ? C.selected : v.hint === t.id ? C.hint : v.focus === t.id ? C.focus : undefined;
      this.tile(x, y, tw, t.kind, ring);
      handRects.push({ id: t.id, rect: { x, y, w: tw, h: th } });
    });
    this.layout = { ...this.layout, tw, rows, handRects };

    // ---- your melds and name, just above the hand
    const mw = Math.min(tw * 0.72, 34);
    const mh = mw * ASPECT;
    const meldY = handTop - mh - pad * 0.8;
    const nameSize = Math.max(11, Math.min(15, w * 0.03));
    this.seatLabel(game, 0, v, pad, meldY - 4 > 0 ? meldY - 4 : handTop - 4, nameSize);
    if (me.melds.length || me.bonus.length) {
      const used = this.melds(me.melds, pad, meldY, mw, false);
      me.bonus.forEach((b, i) => this.tile(pad + used + i * mw * 0.8, meldY, mw * 0.8, b.kind));
    }

    // ---- opponents: across (top), right and left (sides)
    const sideW = Math.max(58, Math.min(150, w * 0.15));
    const sw = Math.min(26, Math.max(14, w * 0.028));
    const sh = sw * ASPECT;
    const topY = pad + nameSize;
    this.seatLabel(game, 2, v, w / 2, topY - 2, nameSize, 'center');
    this.opponentRow(game, 2, w / 2, topY + 4, sw, v.reveal);
    const sideTop = topY + sh + pad * 2;
    for (const p of [3, 1]) {
      const x = p === 3 ? pad : w - pad - sideW;
      this.seatLabel(game, p, v, p === 3 ? x : x + sideW, sideTop, nameSize, p === 3 ? 'left' : 'right');
      this.opponentSide(game, p, x, sideTop + 6, sideW, sw, v.reveal);
    }

    // ---- the middle: rivers around the latest discard
    const mid: Rect = { x: pad + sideW + pad, y: topY + sh + pad * 2, w: w - 2 * (pad * 2 + sideW), h: meldY - (topY + sh + pad * 3) - nameSize };
    const rt = Math.max(12, Math.min(34, mid.w / 13, mid.h / (ASPECT * 7.5)));
    const rh = rt * ASPECT;
    const cols6 = 6 * rt;
    const last = game.lastDiscard?.tile ?? null;
    const bandH = rh * 3 + 3;
    this.river(game.seats[2]!.river, { x: mid.x + (mid.w - cols6) / 2, y: mid.y, w: cols6, h: bandH }, 6, rt, last);
    this.river(game.seats[0]!.river, { x: mid.x + (mid.w - cols6) / 2, y: mid.y + mid.h - bandH, w: cols6, h: bandH }, 6, rt, last);
    const sideBandW = rt * 3;
    const sideBand: Rect = { x: mid.x, y: mid.y + bandH + 4, w: sideBandW, h: Math.max(rh, mid.h - 2 * bandH - 8) };
    this.river(game.seats[3]!.river, sideBand, 3, rt, last);
    this.river(game.seats[1]!.river, { ...sideBand, x: mid.x + mid.w - sideBandW }, 3, rt, last);

    // centre: wall count, round wind and the latest discard, large
    const cx = mid.x + mid.w / 2;
    const cy = mid.y + mid.h / 2;
    const lw = Math.min(48, Math.max(26, mid.w * 0.12));
    if (last && game.phase === 'claim') {
      this.tile(cx - lw / 2, cy - (lw * ASPECT) / 2 - 6, lw, last.kind, C.last);
      this.label(`${SEAT_NAMES[game.lastDiscard!.from]} discarded`, cx, cy + (lw * ASPECT) / 2 + 12, Math.max(10, nameSize - 2), C.muted, 'center');
    } else {
      this.label(`${game.wallCount} tiles left`, cx, cy - 2, Math.max(11, nameSize - 1), C.text, 'center');
      this.label(`${WINDS[game.prevailing]} round`, cx, cy + nameSize + 2, Math.max(10, nameSize - 3), C.muted, 'center');
    }
  }

  private seatLabel(game: TableGame, p: number, v: TableView, x: number, y: number, size: number, align: CanvasTextAlign = 'left') {
    const active = v.active === p;
    if (active) {
      // Turn marker: a dot before the name (drawn, so it never depends on a font glyph).
      const { ctx } = this;
      ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      const tw = ctx.measureText(`${SEAT_NAMES[p]} · ${game.windName(p)}${p === game.dealer ? ' (dealer)' : ''} · ${Math.abs(v.scores[p]!)}`).width + size;
      const start = align === 'left' ? x : align === 'center' ? x - tw / 2 : x - tw;
      ctx.fillStyle = C.turn;
      ctx.beginPath();
      ctx.arc(start + size * 0.3, y - size * 0.35, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      if (align === 'left') x += size * 0.8;
      else if (align === 'center') x += size * 0.4;
    }
    const text = `${SEAT_NAMES[p]} · ${game.windName(p)}${p === game.dealer ? ' (dealer)' : ''} · ${v.scores[p]! >= 0 ? '' : '−'}${Math.abs(v.scores[p]!)}`;
    this.label(text, x, y, size, active ? C.turn : C.text, align);
  }

  /** The player across: hidden tiles as a row of backs (faces at the end of a hand), then melds. */
  private opponentRow(game: TableGame, p: number, cx: number, y: number, w: number, reveal: boolean) {
    const s = game.seats[p]!;
    const meldTiles = s.melds.reduce((n, m) => n + m.tiles.length, 0) + s.bonus.length;
    const total = (s.hand.length + meldTiles) * w + (s.melds.length ? w * 0.6 : 0);
    let x = cx - total / 2;
    for (const t of s.hand) {
      this.tile(x, y, w, reveal ? t.kind : null);
      x += w;
    }
    x += w * 0.6;
    x += this.melds(s.melds, x, y, w, !reveal);
    s.bonus.forEach((b) => {
      this.tile(x, y, w * 0.8, b.kind);
      x += w * 0.8;
    });
  }

  /** Right or left player: hidden tiles as a compact block of backs, melds below. */
  private opponentSide(game: TableGame, p: number, x: number, y: number, width: number, w: number, reveal: boolean) {
    const s = game.seats[p]!;
    const perRow = Math.max(3, Math.floor(width / w));
    const h = w * ASPECT;
    s.hand.forEach((t, i) => this.tile(x + (i % perRow) * w, y + Math.floor(i / perRow) * (h + 2), w, reveal ? t.kind : null));
    let my = y + Math.ceil(s.hand.length / perRow) * (h + 2) + 6;
    for (const m of s.melds) {
      const hidden = !reveal && m.concealed;
      m.tiles.forEach((t, i) => this.tile(x + i * w, my, w, hidden && (i === 0 || i === 3) ? null : t.kind));
      my += h + 4;
    }
    s.bonus.forEach((b, i) => this.tile(x + (i % perRow) * w * 0.8, my + Math.floor(i / perRow) * (h * 0.8 + 2), w * 0.8, b.kind));
  }
}
