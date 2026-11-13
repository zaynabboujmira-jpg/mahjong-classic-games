import ArcadeShell from '../ArcadeShell';
import { COLS, MAZE, MazeGame, ROWS, TILE, cellAt } from '../../../engines/arcade/maze';
import { DPAD, SFX } from './common';

const WISP_COLORS: Record<string, string> = { Dash: '#a855f7', Scout: '#f97316', Twist: '#3b82f6', Drift: '#e5e7eb' };

function draw(ctx: CanvasRenderingContext2D, g: MazeGame, t: number) {
  ctx.fillStyle = '#081722';
  ctx.fillRect(0, 0, COLS * TILE, ROWS * TILE);
  // Walls: rounded teal blocks.
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const c = MAZE[y]![x];
      if (c === '#') {
        ctx.fillStyle = '#145c4c';
        ctx.beginPath();
        ctx.roundRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2, 4);
        ctx.fill();
        // Join neighbouring wall blocks so corridors read as clean lanes.
        ctx.fillStyle = '#145c4c';
        if (cellAt(x + 1, y) === '#') ctx.fillRect(x * TILE + TILE / 2, y * TILE + 1, TILE, TILE - 2);
        if (cellAt(x, y + 1) === '#') ctx.fillRect(x * TILE + 1, y * TILE + TILE / 2, TILE - 2, TILE);
      } else if (c === '-') {
        ctx.fillStyle = '#f9a8d4';
        ctx.fillRect(x * TILE, y * TILE + TILE / 2 - 1, TILE, 2);
      }
    }
  for (const k of g.pellets) {
    ctx.fillStyle = '#fde68a';
    ctx.fillRect((k % COLS) * TILE + TILE / 2 - 1.5, Math.floor(k / COLS) * TILE + TILE / 2 - 1.5, 3, 3);
  }
  for (const k of g.power) {
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc((k % COLS) * TILE + TILE / 2, Math.floor(k / COLS) * TILE + TILE / 2, 4 + Math.sin(t * 8), 0, Math.PI * 2);
    ctx.fill();
  }
  if (g.gem) {
    const cx = g.gem.x * TILE + TILE / 2;
    const cy = g.gem.y * TILE + TILE / 2;
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx, cy + 7);
    ctx.lineTo(cx - 6, cy);
    ctx.fill();
  }
  // Wisps: diamond-shaped sprites with eyes.
  for (const w of g.wisps) {
    const p = g.wispPos(w);
    const cx = p.x * TILE + TILE / 2;
    const cy = p.y * TILE + TILE / 2;
    const scared = g.frightened > 0 && w.state === 'active';
    if (w.state !== 'eaten') {
      ctx.fillStyle = scared ? (g.frightened < 2 && Math.floor(t * 6) % 2 ? '#f8fafc' : '#1e3a8a') : WISP_COLORS[w.name]!;
      ctx.beginPath();
      const s = 7.5 + Math.sin(t * 10 + cx) * 0.6;
      ctx.moveTo(cx, cy - s);
      ctx.quadraticCurveTo(cx + s, cy - s, cx + s, cy);
      ctx.quadraticCurveTo(cx + s, cy + s, cx, cy + s);
      ctx.quadraticCurveTo(cx - s, cy + s, cx - s, cy);
      ctx.quadraticCurveTo(cx - s, cy - s, cx, cy - s);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    for (const ex of [-3, 3]) ctx.fillRect(cx + ex - 1.5, cy - 3, 3, 4);
    if (!scared) {
      ctx.fillStyle = '#0f172a';
      for (const ex of [-3, 3]) ctx.fillRect(cx + ex - 0.5 + w.dir.x, cy - 2 + w.dir.y, 2, 2);
    }
  }
  // The Chomper: a round mint critter with big eyes looking where it goes.
  const pp = g.playerPos();
  const px = pp.x * TILE + TILE / 2;
  const py = pp.y * TILE + TILE / 2;
  const squash = 1 + Math.sin(t * 18) * 0.06;
  ctx.fillStyle = '#34d399';
  ctx.beginPath();
  ctx.ellipse(px, py, 7 * squash, 7 / squash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (const ex of [-2.6, 2.6]) {
    ctx.beginPath();
    ctx.arc(px + ex + pp.dir.x * 1.5, py - 1.5 + pp.dir.y * 1.5, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#0f172a';
  for (const ex of [-2.6, 2.6]) {
    ctx.beginPath();
    ctx.arc(px + ex + pp.dir.x * 2.4, py - 1.5 + pp.dir.y * 2.4, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function MazeChomperGame() {
  return (
    <ArcadeShell
      name="Maze Chomper"
      storageKey="maze-chomper"
      width={COLS * TILE}
      height={ROWS * TILE}
      create={(seed) => new MazeGame(seed)}
      draw={draw}
      buttons={DPAD}
      help="Steer with the arrow keys or WASD, swipe on the maze, or use the on-screen pad. Eat every pellet; power orbs let you catch the Wisps."
      sounds={{
        pellet: (s) => s.tone(620, 35, 'square', 0.05),
        power: (s) => s.tone(220, 260, 'triangle', 0.16, 660),
        catch: (s) => s.tone(700, 220, 'square', 0.12, 1400),
        gem: (s) => s.tone(1046, 220, 'sine', 0.16, 1568),
        die: SFX.lose,
        level: SFX.fanfare,
      }}
    />
  );
}
