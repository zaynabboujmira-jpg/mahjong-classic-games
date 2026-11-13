import { MAX_GUESSES, type Mark } from './game';

export const MARK_COLORS: Record<Mark, string> = { hit: '#15803d', near: '#d97706', miss: '#4b5563' };

export interface BoardView {
  length: number;
  guesses: readonly string[];
  marks: readonly Mark[][];
  current: string;
  /** Row to shake after an invalid guess (-1 for none) and the shake offset in px. */
  shakeRow: number;
  shake: number;
}

/** Draws the guess grid: finished rows coloured, the current row outlined. */
export class WordBoardRenderer {
  private ctx: CanvasRenderingContext2D;
  w = 0;
  h = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Sizes the canvas to the largest grid that fits the box; returns the CSS size. */
  fit(boxW: number, boxH: number, length: number, dpr: number): { w: number; h: number } {
    const gap = 6;
    const tile = Math.floor(Math.min(64, (boxW - gap * (length - 1)) / length, (boxH - gap * (MAX_GUESSES - 1)) / MAX_GUESSES));
    const w = tile * length + gap * (length - 1);
    const h = tile * MAX_GUESSES + gap * (MAX_GUESSES - 1);
    if (w !== this.w || h !== this.h) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w;
      this.h = h;
    }
    return { w, h };
  }

  draw(v: BoardView) {
    const { ctx } = this;
    const gap = 6;
    const tile = (this.w - gap * (v.length - 1)) / v.length;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(tile * 0.55)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    for (let r = 0; r < MAX_GUESSES; r++) {
      const done = r < v.guesses.length;
      const word = done ? v.guesses[r]! : r === v.guesses.length ? v.current : '';
      const dx = r === v.shakeRow ? v.shake : 0;
      for (let c = 0; c < v.length; c++) {
        const x = c * (tile + gap) + dx;
        const y = r * (tile + gap);
        const ch = word[c] ?? '';
        const radius = Math.max(4, tile * 0.12);
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, tile - 2, tile - 2, radius);
        if (done) {
          ctx.fillStyle = MARK_COLORS[v.marks[r]![c]!];
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = ch ? '#f2f7f4' : 'rgba(255,255,255,0.35)';
          ctx.stroke();
        }
        if (ch) {
          ctx.fillStyle = '#ffffff';
          ctx.fillText(ch.toUpperCase(), x + tile / 2, y + tile / 2 + 1);
        }
      }
    }
  }
}
