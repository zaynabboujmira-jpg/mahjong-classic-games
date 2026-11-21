import { bit } from './grid';
import { ACTIVE, GRID_CELLS, ORIGINS, PEERS, SIDE, SIZE } from './samurai';

export interface SamuraiView {
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
  peer: '#eef3ee',
  same: '#cfe8dc',
  selected: '#a8dcc6',
  badBg: '#fbe3e1',
  shared: '#f6efdc',
  thin: '#c9bfa8',
  thick: '#1b2823',
  given: '#1b2823',
  entered: '#0f5c4a',
  bad: '#c2272d',
  note: '#56655e',
  hint: '#d97706',
};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const SHARED = new Set(GRID_CELLS[2]!.filter((c) => GRID_CELLS.some((g, i) => i !== 2 && g.includes(c))));

/** Paints the five overlapping grids on a 21×21 square; `size` is in CSS pixels. */
export class SamuraiRenderer {
  private ctx: CanvasRenderingContext2D;
  size = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
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
    const cell = this.size / SIDE;
    const c = Math.floor(x / cell);
    const r = Math.floor(y / cell);
    if (r < 0 || r >= SIDE || c < 0 || c >= SIDE) return -1;
    const i = r * SIDE + c;
    return ACTIVE[i] ? i : -1;
  }

  draw(v: SamuraiView) {
    const { ctx, size } = this;
    const cell = size / SIDE;
    ctx.clearRect(0, 0, size, size);
    const sel = v.selected;
    const selDigit = sel >= 0 ? v.values[sel]! : 0;
    const peers = new Set(sel >= 0 ? PEERS[sel] : []);
    for (let i = 0; i < SIZE; i++) {
      if (!ACTIVE[i]) continue;
      let bg = SHARED.has(i) ? C.shared : C.paper;
      if (peers.has(i)) bg = C.peer;
      if (selDigit && v.values[i] === selDigit) bg = C.same;
      if (v.bad.has(i)) bg = C.badBg;
      if (i === sel) bg = C.selected;
      ctx.fillStyle = bg;
      ctx.fillRect((i % SIDE) * cell, Math.floor(i / SIDE) * cell, cell, cell);
    }
    // Thin lines around every cell, then thick box and grid borders for each of the five grids.
    ctx.strokeStyle = C.thin;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < SIZE; i++) {
      if (!ACTIVE[i]) continue;
      const x = Math.round((i % SIDE) * cell) + 0.5;
      const y = Math.round(Math.floor(i / SIDE) * cell) + 0.5;
      ctx.rect(x, y, cell, cell);
    }
    ctx.stroke();
    ctx.strokeStyle = C.thick;
    ctx.lineWidth = Math.max(1.6, size / 420);
    ctx.beginPath();
    for (const [r0, c0] of ORIGINS) {
      for (let k = 0; k <= 9; k += 3) {
        const p = (c0 + k) * cell;
        const q = (r0 + k) * cell;
        ctx.moveTo(p, r0 * cell);
        ctx.lineTo(p, (r0 + 9) * cell);
        ctx.moveTo(c0 * cell, q);
        ctx.lineTo((c0 + 9) * cell, q);
      }
    }
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < SIZE; i++) {
      if (!ACTIVE[i]) continue;
      const x = (i % SIDE) * cell;
      const y = Math.floor(i / SIDE) * cell;
      const value = v.values[i]!;
      if (value) {
        const given = v.isGiven(i);
        ctx.fillStyle = v.bad.has(i) && !given ? C.bad : given ? C.given : C.entered;
        ctx.font = `${given ? 700 : 500} ${Math.round(cell * 0.66)}px ${FONT}`;
        ctx.fillText(String(value), x + cell / 2, y + cell / 2 + cell * 0.04);
      } else if (v.notes[i] && cell >= 18) {
        ctx.font = `600 ${Math.max(6, Math.round(cell * 0.28))}px ${FONT}`;
        ctx.fillStyle = C.note;
        for (let d = 1; d <= 9; d++) {
          if (!(v.notes[i]! & bit(d))) continue;
          ctx.fillText(String(d), x + (((d - 1) % 3) + 0.5) * (cell / 3), y + (Math.floor((d - 1) / 3) + 0.5) * (cell / 3) + 0.5);
        }
      } else if (v.notes[i]) {
        // Cells too small for nine digits: a dot says there are notes (they show when the cell is selected).
        ctx.fillStyle = C.note;
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, Math.max(1.5, cell * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const ring = (i: number, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      const inset = width / 2 + 0.5;
      ctx.strokeRect((i % SIDE) * cell + inset, Math.floor(i / SIDE) * cell + inset, cell - inset * 2, cell - inset * 2);
    };
    if (v.hint >= 0) ring(v.hint, C.hint, Math.max(2, cell * 0.1));
    if (v.focusRing && sel >= 0) ring(sel, '#1d4ed8', 2);
  }
}
