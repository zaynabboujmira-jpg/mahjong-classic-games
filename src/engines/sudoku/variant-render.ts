import type { Shape } from './variants';

export interface VariantView {
  values: readonly number[];
  notes: readonly number[];
  isGiven: (c: number) => boolean;
  bad: ReadonlySet<number>;
  selected: number;
  hint: number;
  focusRing: boolean;
}

const C = {
  paper: '#fffdf8',
  diag: '#f3ecda',
  peer: '#eef3ee',
  same: '#cfe8dc',
  selected: '#a8dcc6',
  badBg: '#fbe3e1',
  thin: '#c9bfa8',
  thick: '#1b2823',
  given: '#1b2823',
  entered: '#0f5c4a',
  bad: '#c2272d',
  note: '#56655e',
  hint: '#d97706',
};
/** Soft tints so jigsaw regions are easy to tell apart. */
const REGION_TINT = ['#fffdf8', '#f4efe2', '#eef4ee', '#f6eee9', '#eef1f6', '#f6f3e6', '#f1eef6', '#eaf3f1', '#f6efe1'];
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

/** Paints any square variant: thick lines wherever the region changes, tinted jigsaw regions, shaded diagonals. */
export class VariantRenderer {
  private ctx: CanvasRenderingContext2D;
  size = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private shape: Shape,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  setShape(shape: Shape) {
    this.shape = shape;
  }

  resize(size: number, dpr: number) {
    this.size = size;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  cellAt(x: number, y: number): number {
    const n = this.shape.n;
    const cell = this.size / n;
    const c = Math.floor(x / cell);
    const r = Math.floor(y / cell);
    return r >= 0 && r < n && c >= 0 && c < n ? r * n + c : -1;
  }

  draw(v: VariantView) {
    const { ctx, size, shape } = this;
    const n = shape.n;
    const cell = size / n;
    const sel = v.selected;
    const selDigit = sel >= 0 ? v.values[sel]! : 0;
    const peers = new Set(sel >= 0 ? shape.peers[sel] : []);
    const onDiag = (i: number) => shape.diagonals && (Math.floor(i / n) === i % n || Math.floor(i / n) + (i % n) === n - 1);
    for (let i = 0; i < n * n; i++) {
      let bg = shape.variant === 'jigsaw' ? REGION_TINT[shape.region[i]! % REGION_TINT.length]! : onDiag(i) ? C.diag : C.paper;
      if (peers.has(i)) bg = C.peer;
      if (selDigit && v.values[i] === selDigit) bg = C.same;
      if (v.bad.has(i)) bg = C.badBg;
      if (i === sel) bg = C.selected;
      ctx.fillStyle = bg;
      ctx.fillRect((i % n) * cell, Math.floor(i / n) * cell, cell, cell);
    }
    if (shape.diagonals) {
      ctx.strokeStyle = 'rgba(176, 140, 60, 0.35)';
      ctx.lineWidth = Math.max(1, cell * 0.06);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(size, size);
      ctx.moveTo(size, 0);
      ctx.lineTo(0, size);
      ctx.stroke();
    }
    ctx.strokeStyle = C.thin;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < n; k++) {
      const p = Math.round(k * cell) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
    }
    ctx.stroke();
    // Thick segments wherever two neighbouring cells are in different regions, plus the outer frame.
    const reg = shape.region;
    ctx.strokeStyle = C.thick;
    ctx.lineWidth = Math.max(2, size / 200);
    ctx.lineCap = 'square';
    ctx.beginPath();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        if (c < n - 1 && reg[i] !== reg[i + 1]) {
          ctx.moveTo((c + 1) * cell, r * cell);
          ctx.lineTo((c + 1) * cell, (r + 1) * cell);
        }
        if (r < n - 1 && reg[i] !== reg[i + n]) {
          ctx.moveTo(c * cell, (r + 1) * cell);
          ctx.lineTo((c + 1) * cell, (r + 1) * cell);
        }
      }
    ctx.stroke();
    const lw = ctx.lineWidth;
    ctx.strokeRect(lw / 2, lw / 2, size - lw, size - lw);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const noteCols = n <= 6 ? 3 : n <= 9 ? 3 : 4;
    const noteRows = Math.ceil(n / noteCols);
    for (let i = 0; i < n * n; i++) {
      const x = (i % n) * cell;
      const y = Math.floor(i / n) * cell;
      const value = v.values[i]!;
      if (value) {
        const given = v.isGiven(i);
        ctx.fillStyle = v.bad.has(i) && !given ? C.bad : given ? C.given : C.entered;
        ctx.font = `${given ? 700 : 500} ${Math.round(cell * (value > 9 ? 0.5 : 0.62))}px ${FONT}`;
        ctx.fillText(String(value), x + cell / 2, y + cell / 2 + cell * 0.04);
      } else if (v.notes[i]) {
        ctx.font = `600 ${Math.max(7, Math.round((cell / noteCols) * 0.78))}px ${FONT}`;
        ctx.fillStyle = C.note;
        for (let d = 1; d <= n; d++) {
          if (!(v.notes[i]! & (1 << (d - 1)))) continue;
          const k = d - 1;
          ctx.fillText(String(d), x + ((k % noteCols) + 0.5) * (cell / noteCols), y + (Math.floor(k / noteCols) + 0.5) * (cell / noteRows) + 0.5);
        }
      }
    }
    const ring = (i: number, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      const inset = width / 2 + 1;
      ctx.strokeRect((i % n) * cell + inset, Math.floor(i / n) * cell + inset, cell - inset * 2, cell - inset * 2);
    };
    if (v.hint >= 0) ring(v.hint, C.hint, Math.max(2.5, cell * 0.08));
    if (v.focusRing && sel >= 0) ring(sel, '#1d4ed8', 2);
  }
}
