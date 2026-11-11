import { Cell, type Minesweeper } from './game';

export interface MinesLayout {
  /** Cell size in CSS pixels. */
  cell: number;
  /** Board drawn transposed (columns become rows) to suit a portrait screen. */
  rotated: boolean;
  cols: number;
  rows: number;
  width: number;
  height: number;
}

export const MAX_CELL = 44;

/**
 * Picks the cell size and orientation for a viewport. Wide boards turn
 * sideways on portrait screens when that gives bigger cells. Cells never go
 * below `minCell`; the board then scrolls inside its own frame instead.
 */
export function fitMines(viewW: number, viewH: number, boardW: number, boardH: number, minCell: number): MinesLayout {
  const straight = Math.min(viewW / boardW, viewH / boardH);
  const turned = Math.min(viewW / boardH, viewH / boardW);
  const rotated = boardW !== boardH && turned > straight * 1.05;
  const cols = rotated ? boardH : boardW;
  const rows = rotated ? boardW : boardH;
  const cell = Math.max(minCell, Math.min(MAX_CELL, Math.floor(Math.max(straight, turned))));
  return { cell, rotated, cols, rows, width: cols * cell, height: rows * cell };
}

/** Board index of the cell drawn at display column/row. */
export const indexAt = (l: MinesLayout, game: Pick<Minesweeper, 'width'>, col: number, row: number) =>
  l.rotated ? col * game.width + row : row * game.width + col;

/** Display column/row of a board index. */
export function displayOf(l: MinesLayout, game: Pick<Minesweeper, 'width'>, i: number): { col: number; row: number } {
  const x = i % game.width;
  const y = Math.floor(i / game.width);
  return l.rotated ? { col: y, row: x } : { col: x, row: y };
}

export function cellAtPoint(l: MinesLayout, game: Pick<Minesweeper, 'width'>, px: number, py: number): number {
  const col = Math.floor(px / l.cell);
  const row = Math.floor(py / l.cell);
  if (col < 0 || row < 0 || col >= l.cols || row >= l.rows) return -1;
  return indexAt(l, game, col, row);
}

const NUMBER_COLORS = ['', '#1d4ed8', '#15803d', '#c2272d', '#1e3a8a', '#7f1d1d', '#0f766e', '#1b2823', '#6b7280'];

export interface MinesOverlay {
  /** Keyboard cursor, or -1. */
  cursor: number;
  /** Cells drawn pressed (pointer held, or the neighbours of a chord). */
  pressed: ReadonlySet<number>;
}

export class MinesRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(l: MinesLayout, dpr: number) {
    this.canvas.width = Math.round(l.width * dpr);
    this.canvas.height = Math.round(l.height * dpr);
    this.canvas.style.width = `${l.width}px`;
    this.canvas.style.height = `${l.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(game: Minesweeper, l: MinesLayout, o: MinesOverlay) {
    const { ctx } = this;
    const s = l.cell;
    const lost = game.status === 'lost';
    ctx.fillStyle = '#d6ccb6';
    ctx.fillRect(0, 0, l.width, l.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(s * 0.62)}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;

    for (let i = 0; i < game.size; i++) {
      const { col, row } = displayOf(l, game, i);
      const x = col * s;
      const y = row * s;
      const st = game.state[i];
      const mine = game.mines[i] === 1;
      const open = st === Cell.Revealed || (lost && mine && st !== Cell.Flagged);
      if (open || o.pressed.has(i)) {
        ctx.fillStyle = i === game.exploded ? '#ef4444' : '#f6f1e6';
        ctx.fillRect(x + 0.5, y + 0.5, s - 1, s - 1);
        if (mine && open) this.mine(x, y, s);
        else if (open && game.counts[i]) {
          ctx.fillStyle = NUMBER_COLORS[game.counts[i]!]!;
          ctx.fillText(String(game.counts[i]), x + s / 2, y + s / 2 + s * 0.04);
        }
      } else {
        this.tile(x, y, s);
        if (st === Cell.Flagged) {
          this.flag(x, y, s);
          if (lost && !mine) this.cross(x, y, s);
        }
      }
    }

    if (o.cursor >= 0) {
      const { col, row } = displayOf(l, game, o.cursor);
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 3;
      ctx.strokeRect(col * s + 1.5, row * s + 1.5, s - 3, s - 3);
    }
  }

  private tile(x: number, y: number, s: number) {
    const { ctx } = this;
    const b = Math.max(2, Math.round(s * 0.1));
    ctx.fillStyle = '#b9c8bd';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#eef3ee';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s - b, y + b);
    ctx.lineTo(x + b, y + b);
    ctx.lineTo(x + b, y + s - b);
    ctx.lineTo(x, y + s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7d9186';
    ctx.beginPath();
    ctx.moveTo(x + s, y + s);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x + b, y + s - b);
    ctx.lineTo(x + s - b, y + s - b);
    ctx.lineTo(x + s - b, y + b);
    ctx.lineTo(x + s, y);
    ctx.closePath();
    ctx.fill();
  }

  private flag(x: number, y: number, s: number) {
    const { ctx } = this;
    ctx.fillStyle = '#1b2823';
    ctx.fillRect(x + s * 0.48, y + s * 0.22, Math.max(1.5, s * 0.07), s * 0.5);
    ctx.fillRect(x + s * 0.3, y + s * 0.7, s * 0.42, Math.max(2, s * 0.08));
    ctx.fillStyle = '#c2272d';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.55, y + s * 0.2);
    ctx.lineTo(x + s * 0.55, y + s * 0.5);
    ctx.lineTo(x + s * 0.24, y + s * 0.35);
    ctx.closePath();
    ctx.fill();
  }

  private mine(x: number, y: number, s: number) {
    const { ctx } = this;
    const cx = x + s / 2;
    const cy = y + s / 2;
    const r = s * 0.22;
    ctx.strokeStyle = '#1b2823';
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 4;
      ctx.moveTo(cx - Math.cos(a) * r * 1.6, cy - Math.sin(a) * r * 1.6);
      ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6);
    }
    ctx.stroke();
    ctx.fillStyle = '#1b2823';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  private cross(x: number, y: number, s: number) {
    const { ctx } = this;
    ctx.strokeStyle = '#c2272d';
    ctx.lineWidth = Math.max(2, s * 0.09);
    ctx.beginPath();
    ctx.moveTo(x + s * 0.2, y + s * 0.2);
    ctx.lineTo(x + s * 0.8, y + s * 0.8);
    ctx.moveTo(x + s * 0.8, y + s * 0.2);
    ctx.lineTo(x + s * 0.2, y + s * 0.8);
    ctx.stroke();
  }
}
