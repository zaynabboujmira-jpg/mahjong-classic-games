import ArcadeShell from '../ArcadeShell';
import { CELL, GRID, H, SnakeGame as Engine, W, type SnakeMode, type SnakeSpeed } from '../../../engines/arcade/snake';
import { DPAD, SFX } from './common';

function draw(ctx: CanvasRenderingContext2D, g: Engine, t: number) {
  // Checkerboard field.
  ctx.fillStyle = '#123b2f';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#16463a';
  for (let y = 0; y < GRID; y++) for (let x = (y % 2); x < GRID; x += 2) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  if (g.mode === 'classic') {
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
  }

  // Food: a pulsing berry.
  const pulse = 1 + Math.sin(t * 6) * 0.08;
  const fx = g.food.x * CELL + CELL / 2;
  const fy = g.food.y * CELL + CELL / 2;
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.arc(fx, fy + 1, CELL * 0.36 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.ellipse(fx + 3, fy - 7, 4, 2, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Body: rounded segments from tail (dark) to head (bright).
  const n = g.body.length;
  g.body.forEach((p, i) => {
    const k = 1 - i / Math.max(1, n);
    ctx.fillStyle = `hsl(${150 + k * 20} 70% ${32 + k * 22}%)`;
    const inset = i === 0 ? 1 : 2;
    ctx.beginPath();
    ctx.roundRect(p.x * CELL + inset, p.y * CELL + inset, CELL - inset * 2, CELL - inset * 2, i === 0 ? 7 : 5);
    ctx.fill();
  });
  // Eyes look the way the snake is heading.
  const head = g.body[0]!;
  const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[g.dir];
  const cx = head.x * CELL + CELL / 2 + v[0]! * 3;
  const cy = head.y * CELL + CELL / 2 + v[1]! * 3;
  const px = -v[1]! * 4.5;
  const py = v[0]! * 4.5;
  for (const s of [1, -1]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + px * s, cy + py * s, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx + px * s + v[0]!, cy + py * s + v[1]!, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (g.over) {
    ctx.fillStyle = 'rgba(244,63,94,0.35)';
    ctx.fillRect(head.x * CELL, head.y * CELL, CELL, CELL);
  }
}

export default function SnakeGame() {
  return (
    <ArcadeShell
      name="Snake"
      storageKey="snake"
      width={W}
      height={H}
      create={(seed, o) => new Engine(seed, (o.mode as SnakeMode) ?? 'classic', (o.speed as SnakeSpeed) ?? 'normal')}
      draw={draw}
      options={[
        {
          id: 'mode',
          label: 'Mode',
          choices: [
            { value: 'classic', label: 'Walls' },
            { value: 'wrap', label: 'Wrap' },
          ],
        },
        {
          id: 'speed',
          label: 'Speed',
          initial: 'normal',
          choices: [
            { value: 'easy', label: 'Easy' },
            { value: 'normal', label: 'Normal' },
            { value: 'fast', label: 'Fast' },
          ],
        },
      ]}
      buttons={DPAD}
      help="Steer with the arrow keys, WASD, a swipe or the pad. Eat the berries to grow; do not run into yourself or, with walls on, the edge."
      sounds={{
        eat: (s) => s.tone(880, 70, 'square', 0.08, 1320),
        crash: SFX.lose,
        win: SFX.fanfare,
      }}
    />
  );
}
