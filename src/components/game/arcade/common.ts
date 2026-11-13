import type { ArcadeButton } from '../ArcadeShell';
import type { Synth } from '../../../engines/arcade/audio';

/** Four-way pad for maze and grid games. */
export const DPAD: ArcadeButton[] = [
  { action: 'left', label: '◀', aria: 'Left' },
  { action: 'up', label: '▲', aria: 'Up' },
  { action: 'down', label: '▼', aria: 'Down' },
  { action: 'right', label: '▶', aria: 'Right' },
];

/** Shared sound effects, all synthesized. */
export const SFX = {
  lose: (s: Synth) => s.tone(420, 700, 'sawtooth', 0.14, 60),
  fanfare: (s: Synth) => {
    s.tone(523, 120, 'triangle', 0.16);
    window.setTimeout(() => s.tone(659, 120, 'triangle', 0.16), 120);
    window.setTimeout(() => s.tone(784, 260, 'triangle', 0.16), 240);
  },
  boom: (s: Synth, pitch = 120, ms = 300) => s.tone(pitch, ms, 'sawtooth', 0.16, Math.max(30, pitch / 3)),
};

/** A pixel bitmap ("X" = filled) drawn at (x, y) with the given pixel size. */
export function pixels(ctx: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number, px: number, py = px) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === 'X') ctx.fillRect(x + c * px, y + r * py, px + 0.05, py + 0.05);
  });
}
