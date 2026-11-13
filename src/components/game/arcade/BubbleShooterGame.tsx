import ArcadeShell from '../ArcadeShell';
import { BubbleGame, H, LOSE_Y, PALETTE, R, SHOOTER_Y, W } from '../../../engines/arcade/bubbles';
import { SFX } from './common';

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, color: number, r = R - 0.6, alpha = 1) {
  const c = PALETTE[color] ?? '#999';
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, c);
  g.addColorStop(1, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function draw(ctx: CanvasRenderingContext2D, g: BubbleGame) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f2a3f');
  bg.addColorStop(1, '#13324a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Danger line.
  ctx.strokeStyle = 'rgba(248,113,113,0.5)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, LOSE_Y);
  ctx.lineTo(W, LOSE_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  g.rows.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v < 0) return;
      const p = g.center(r, c);
      bubble(ctx, p.x, p.y, v);
    }),
  );
  for (const f of g.falling) {
    if (f.popping) bubble(ctx, f.x, f.y, f.color, R * (1 + f.t * 2.5), Math.max(0, 1 - f.t / 0.18));
    else bubble(ctx, f.x, f.y, f.color);
  }

  // Aim guide: a dotted line that shows the first bounce.
  if (!g.over && !g.shot) {
    let x = W / 2;
    let y = SHOOTER_Y;
    let vx = Math.sin(g.angle);
    const vy = -Math.cos(g.angle);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 34; i++) {
      x += vx * 14;
      y += vy * 14;
      if (x < R || x > W - R) vx = -vx;
      if (y < R) break;
      // Stop where the shot would hit the cluster.
      const [cr] = g.cellAt(x, y);
      let blocked = false;
      for (let r = Math.max(0, cr - 1); r <= cr + 1 && !blocked; r++)
        for (let c = 0; c < g.colsIn(r); c++) {
          if (g.get(r, c) < 0) continue;
          const p = g.center(r, c);
          if (Math.hypot(p.x - x, p.y - y) < 2 * R * 0.86) {
            blocked = true;
            break;
          }
        }
      if (blocked) break;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (g.shot) bubble(ctx, g.shot.x, g.shot.y, g.shot.color);

  // Launcher, current bubble and the next one.
  ctx.save();
  ctx.translate(W / 2, SHOOTER_Y);
  ctx.rotate(g.angle);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-5, -R - 22, 10, 22);
  ctx.restore();
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(W / 2, SHOOTER_Y, R + 6, 0, Math.PI * 2);
  ctx.fill();
  if (!g.shot) bubble(ctx, W / 2, SHOOTER_Y, g.current);
  ctx.fillStyle = 'rgba(226,232,240,0.75)';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEXT', W / 2 + 62, SHOOTER_Y + 30);
  bubble(ctx, W / 2 + 62, SHOOTER_Y + 4, g.next, R * 0.75);
}

export default function BubbleShooterGame() {
  return (
    <ArcadeShell
      name="Bubble Shooter"
      storageKey="bubble-shooter"
      width={W}
      height={H}
      create={(seed) => new BubbleGame(seed)}
      draw={(ctx, g) => draw(ctx, g)}
      buttons={[
        { action: 'left', label: '◀', aria: 'Aim left' },
        { action: 'fire', label: '●', aria: 'Shoot' },
        { action: 'special', label: '⇄', aria: 'Swap with the next bubble' },
        { action: 'right', label: '▶', aria: 'Aim right' },
      ]}
      help="Drag to aim and lift your finger to shoot, or point with the mouse and click. Arrow keys aim, Space shoots, Down swaps. Match three of a colour to pop them."
      sounds={{
        fire: (s) => s.tone(520, 50, 'triangle', 0.07, 700),
        pop: (s) => s.tone(880, 90, 'sine', 0.1, 1320),
        drop: (s) => s.tone(660, 220, 'triangle', 0.1, 220),
        row: (s) => s.tone(160, 220, 'sawtooth', 0.08, 120),
        level: SFX.fanfare,
        lose: SFX.lose,
      }}
    />
  );
}
