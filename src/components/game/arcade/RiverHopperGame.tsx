import ArcadeShell from '../ArcadeShell';
import { BAYS, COLS, HopperGame, LANES, ROWS, TILE, TIME_LIMIT, isRiver, isRoad } from '../../../engines/arcade/hopper';
import { DPAD, SFX } from './common';

const BAR = 24;
const W = COLS * TILE;
const H = ROWS * TILE + BAR;
const CAR_COLORS = ['#f87171', '#60a5fa', '#facc15', '#c084fc', '#fb923c'];

function critter(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  // A round amber critter with little ears: the hopper.
  ctx.fillStyle = '#f59e0b';
  for (const ex of [-0.45, 0.45]) {
    ctx.beginPath();
    ctx.arc(cx + ex * s, cy - 0.45 * s, 0.22 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 0.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff7ed';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.12 * s, 0.28 * s, 0.22 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1917';
  for (const ex of [-0.18, 0.18]) {
    ctx.beginPath();
    ctx.arc(cx + ex * s, cy - 0.1 * s, 0.07 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw(ctx: CanvasRenderingContext2D, g: HopperGame, t: number) {
  for (let r = 0; r < ROWS; r++) {
    ctx.fillStyle = r === 0 ? '#14532d' : isRiver(r) ? '#1d4ed8' : r === 6 ? '#a16207' : isRoad(r) ? '#334155' : '#166534';
    ctx.fillRect(0, r * TILE, W, TILE);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.setLineDash([12, 12]);
  for (let r = 7; r < 11; r++) {
    ctx.beginPath();
    ctx.moveTo(0, (r + 1) * TILE);
    ctx.lineTo(W, (r + 1) * TILE);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  BAYS.forEach((b, i) => {
    ctx.fillStyle = '#0c4a6e';
    ctx.beginPath();
    ctx.roundRect(b * TILE + 2, 4, TILE - 4, TILE - 6, 8);
    ctx.fill();
    if (g.filled[i]) critter(ctx, b * TILE + TILE / 2, TILE / 2 + 2, TILE * 0.7);
  });

  for (const lane of LANES) {
    const y = lane.row * TILE;
    g.objectsIn(lane).forEach((x0, i) => {
      const x = x0 * TILE;
      const w = lane.length * TILE;
      if (lane.kind === 'log') {
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 5, w - 4, TILE - 10, 10);
        ctx.fill();
        ctx.fillStyle = '#b45309';
        ctx.fillRect(x + 8, y + 12, w - 16, 3);
      } else if (lane.kind === 'turtle') {
        const phase = g.divePhase(lane, i);
        if (phase === 'down') {
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          for (let k = 0; k < lane.length; k++) {
            ctx.beginPath();
            ctx.arc(x + k * TILE + TILE / 2, y + TILE / 2, 8, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else
          for (let k = 0; k < lane.length; k++) {
            ctx.fillStyle = phase === 'warn' && Math.floor(t * 8) % 2 ? '#86efac' : '#15803d';
            ctx.beginPath();
            ctx.ellipse(x + k * TILE + TILE / 2, y + TILE / 2, 12, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4ade80';
            ctx.beginPath();
            ctx.arc(x + k * TILE + TILE / 2 + (lane.speed > 0 ? 12 : -12), y + TILE / 2, 4, 0, Math.PI * 2);
            ctx.fill();
          }
      } else {
        ctx.fillStyle = lane.kind === 'truck' ? '#e2e8f0' : CAR_COLORS[(lane.row + i) % CAR_COLORS.length]!;
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 6, w - 6, TILE - 12, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(15,23,42,0.6)';
        const front = lane.speed > 0 ? x + w - 12 : x + 6;
        ctx.fillRect(front, y + 9, 6, TILE - 18);
      }
    });
  }

  if (g.lost && g.pause > 0) {
    ctx.fillStyle = g.lost.how === 'water' ? 'rgba(191,219,254,0.8)' : '#fca5a5';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(g.lost.how === 'water' ? '≈' : '✕', g.lost.x * TILE + TILE / 2, g.lost.y * TILE + TILE * 0.7);
  }
  if (!(g.pause > 0 && g.lost)) {
    const lift = g.hop ? Math.sin(Math.min(1, g.hop.t / 0.12) * Math.PI) * 6 : 0;
    const y = g.hop ? g.hop.fy + (g.hop.ty - g.hop.fy) * Math.min(1, g.hop.t / 0.12) : g.y;
    critter(ctx, g.x * TILE + TILE / 2, y * TILE + TILE / 2 - lift, TILE * 0.8);
  }
  // Time bar.
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, ROWS * TILE, W, BAR);
  const k = Math.max(0, g.timeLeft / TIME_LIMIT);
  ctx.fillStyle = k < 0.25 ? '#f87171' : '#34d399';
  ctx.fillRect(8, ROWS * TILE + 8, (W - 16) * k, 8);
}

export default function RiverHopperGame() {
  return (
    <ArcadeShell
      name="River Hopper"
      storageKey="river-hopper"
      width={W}
      height={H}
      create={() => new HopperGame()}
      draw={draw}
      buttons={DPAD}
      help="Hop with the arrow keys or WASD, swipe, or tap to hop forward. Cross the road, ride logs and turtles over the river, and fill all five burrows."
      sounds={{
        hop: (s) => s.tone(520, 45, 'triangle', 0.08, 700),
        crash: (s) => SFX.boom(s, 160, 300),
        splash: (s) => s.tone(600, 400, 'sine', 0.12, 120),
        die: SFX.lose,
        home: (s) => s.tone(659, 160, 'triangle', 0.14, 988),
        level: SFX.fanfare,
      }}
    />
  );
}
