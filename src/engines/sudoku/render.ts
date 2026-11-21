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
  /** Killer Sudoku: the cage of every cell and each cage's sum, drawn as dashed outlines with the sum in the corner. */
  cages?: { owner: readonly number[]; sums: readonly number[] } | undefined;
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
  cage: '#5b6b63',
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

    const font = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    if (v.cages) this.drawCages(v.cages, cell, font);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
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
        // With cages, notes sit lower and narrower so they clear the sum and the dashed outline.
        const k = v.cages ? 0.24 : 1 / 3;
        const ox = v.cages ? cell * 0.14 : 0;
        const oy = v.cages ? cell * 0.22 : 0;
        ctx.font = `600 ${Math.max(8, Math.round(cell * (v.cages ? 0.21 : 0.27)))}px ${font}`;
        for (let d = 1; d <= 9; d++) {
          if (!(v.notes[i]! & bit(d))) continue;
          ctx.fillStyle = d === selDigit ? C.noteSame : C.note;
          const nx = x + ox + (((d - 1) % 3) + 0.5) * (cell * k);
          const ny = y + oy + (Math.floor((d - 1) / 3) + 0.5) * (cell * k) + cell * 0.01;
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

  /** Dashed outlines just inside each cage, joined at inner corners, and the sum in the cage's top-left cell. */
  private drawCages(cages: { owner: readonly number[]; sums: readonly number[] }, cell: number, font: string) {
    const { ctx } = this;
    const m = Math.max(3, cell * 0.09);
    const same = (r: number, c: number, k: number) => r >= 0 && r < 9 && c >= 0 && c < 9 && cages.owner[r * 9 + c] === k;
    ctx.save();
    ctx.strokeStyle = C.cage;
    ctx.lineWidth = Math.max(1, cell / 45);
    ctx.setLineDash([Math.max(2, cell / 14), Math.max(2, cell / 14)]);
    ctx.beginPath();
    for (let i = 0; i < CELLS; i++) {
      const r = rowOf(i);
      const c = colOf(i);
      const k = cages.owner[i]!;
      const x = c * cell;
      const y = r * cell;
      const up = same(r - 1, c, k);
      const down = same(r + 1, c, k);
      const left = same(r, c - 1, k);
      const right = same(r, c + 1, k);
      if (!up) {
        ctx.moveTo(!left ? x + m : same(r - 1, c - 1, k) ? x - m : x, y + m);
        ctx.lineTo(!right ? x + cell - m : same(r - 1, c + 1, k) ? x + cell + m : x + cell, y + m);
      }
      if (!down) {
        ctx.moveTo(!left ? x + m : same(r + 1, c - 1, k) ? x - m : x, y + cell - m);
        ctx.lineTo(!right ? x + cell - m : same(r + 1, c + 1, k) ? x + cell + m : x + cell, y + cell - m);
      }
      if (!left) {
        ctx.moveTo(x + m, !up ? y + m : same(r - 1, c - 1, k) ? y - m : y);
        ctx.lineTo(x + m, !down ? y + cell - m : same(r + 1, c - 1, k) ? y + cell + m : y + cell);
      }
      if (!right) {
        ctx.moveTo(x + cell - m, !up ? y + m : same(r - 1, c + 1, k) ? y - m : y);
        ctx.lineTo(x + cell - m, !down ? y + cell - m : same(r + 1, c + 1, k) ? y + cell + m : y + cell);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Sums: in the first cell of each cage (top row first, then leftmost), on a patch of paper over the outline.
    ctx.font = `700 ${Math.max(9, Math.round(cell * 0.22))}px ${font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const labelled = new Set<number>();
    for (let i = 0; i < CELLS; i++) {
      const k = cages.owner[i]!;
      if (labelled.has(k)) continue;
      labelled.add(k);
      const text = String(cages.sums[k]);
      const x = colOf(i) * cell + m * 0.55;
      const y = rowOf(i) * cell + m * 0.45;
      const w = ctx.measureText(text).width;
      ctx.fillStyle = C.paper;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x - 1, y - 1, w + 3, cell * 0.24);
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.given;
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  }
}
