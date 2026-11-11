import { CELLS, bit, boxOf, colOf, rowOf } from './grid';

export interface SudokuView {
  values: readonly number[];
  notes: readonly number[];
  isGiven: (i: number) => boolean;
  /** Digits shown in red: conflicts always, wrong digits when checking is on. */
  bad: ReadonlySet<number>;
  selected: number;
  /** Cell the current hint points at, or -1. */
  hint: number;
  /** Show the keyboard focus ring (keyboard users only). */
  focusRing: boolean;
}

const C = {
  paper: '#fffdf8',
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
  noteSame: '#0b4738',
  hint: '#d97706',
};

/** Paints the grid at any size; `size` is in CSS pixels. */
export class SudokuRenderer {
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

  /** Cell under a point in CSS pixels, or -1. */
  cellAt(x: number, y: number): number {
    const cell = this.size / 9;
    const c = Math.floor(x / cell);
    const r = Math.floor(y / cell);
    return r >= 0 && r < 9 && c >= 0 && c < 9 ? r * 9 + c : -1;
  }

  draw(v: SudokuView) {
    const { ctx, size } = this;
    const cell = size / 9;
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, size, size);

    const sel = v.selected;
    const selDigit = sel >= 0 ? v.values[sel]! : 0;
    for (let i = 0; i < CELLS; i++) {
      let bg = '';
      if (sel >= 0 && (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) || boxOf(i) === boxOf(sel))) bg = C.peer;
      if (selDigit && v.values[i] === selDigit) bg = C.same;
      if (v.bad.has(i)) bg = C.badBg;
      if (i === sel) bg = C.selected;
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(colOf(i) * cell, rowOf(i) * cell, cell, cell);
      }
    }

    // Grid lines: thin inside boxes, thick around them.
    for (let k = 0; k <= 9; k++) {
      const thick = k % 3 === 0;
      ctx.strokeStyle = thick ? C.thick : C.thin;
      ctx.lineWidth = thick ? Math.max(2, size / 220) : 1;
      const p = Math.round(k * cell) + (thick ? 0 : 0.5);
      const q = Math.min(Math.max(p, ctx.lineWidth / 2), size - ctx.lineWidth / 2);
      ctx.beginPath();
      ctx.moveTo(q, 0);
      ctx.lineTo(q, size);
      ctx.moveTo(0, q);
      ctx.lineTo(size, q);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const font = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    for (let i = 0; i < CELLS; i++) {
      const x = colOf(i) * cell;
      const y = rowOf(i) * cell;
      const value = v.values[i]!;
      if (value) {
        const given = v.isGiven(i);
        ctx.fillStyle = v.bad.has(i) && !given ? C.bad : given ? C.given : C.entered;
        ctx.font = `${given ? 700 : 500} ${Math.round(cell * 0.62)}px ${font}`;
        ctx.fillText(String(value), x + cell / 2, y + cell / 2 + cell * 0.04);
        if (v.bad.has(i) && given) {
          // A given in conflict: mark it without recolouring the clue itself.
          ctx.fillStyle = C.bad;
          ctx.beginPath();
          ctx.arc(x + cell * 0.82, y + cell * 0.18, cell * 0.06, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (v.notes[i]) {
        ctx.font = `600 ${Math.max(8, Math.round(cell * 0.27))}px ${font}`;
        for (let d = 1; d <= 9; d++) {
          if (!(v.notes[i]! & bit(d))) continue;
          ctx.fillStyle = d === selDigit ? C.noteSame : C.note;
          const nx = x + (((d - 1) % 3) + 0.5) * (cell / 3);
          const ny = y + (Math.floor((d - 1) / 3) + 0.5) * (cell / 3) + cell * 0.01;
          ctx.fillText(String(d), nx, ny);
        }
      }
    }

    const ring = (i: number, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      const inset = width / 2 + 1;
      ctx.strokeRect(colOf(i) * cell + inset, rowOf(i) * cell + inset, cell - inset * 2, cell - inset * 2);
    };
    if (v.hint >= 0) ring(v.hint, C.hint, Math.max(3, cell * 0.07));
    if (v.focusRing && sel >= 0) ring(sel, '#1d4ed8', 2);
  }
}
