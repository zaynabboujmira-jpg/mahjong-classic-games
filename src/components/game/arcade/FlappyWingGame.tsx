import ArcadeShell from '../ArcadeShell';
import { BIRD_R, BIRD_X, COLUMN_W, FlappyGame, GROUND, H, W, medalFor } from '../../../engines/arcade/flappy';
import { SFX } from './common';

const MEDAL_COLORS: Record<string, string> = { Bronze: '#cd7f32', Silver: '#cbd5e1', Gold: '#facc15', Platinum: '#a5f3fc' };

function draw(ctx: CanvasRenderingContext2D, g: FlappyGame, t: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#38bdf8');
  sky.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 4; i++) {
    const x = ((i * 97 - g.time * 12) % (W + 80) + W + 80) % (W + 80) - 40;
    ctx.beginPath();
    ctx.ellipse(x, 70 + i * 52, 30, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Stone columns with carved caps.
  for (const c of g.columns) {
    const top = c.gapY - c.gap / 2;
    const bottom = c.gapY + c.gap / 2;
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(c.x, 0, COLUMN_W, top);
    ctx.fillRect(c.x, bottom, COLUMN_W, GROUND - bottom);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(c.x - 4, top - 14, COLUMN_W + 8, 14);
    ctx.fillRect(c.x - 4, bottom, COLUMN_W + 8, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(c.x + 6, 0, 5, top - 14);
    ctx.fillRect(c.x + 6, bottom + 14, 5, GROUND - bottom - 14);
  }
  ctx.fillStyle = '#e7c98f';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#d4a85c';
  for (let x = -g.scroll; x < W; x += 24) ctx.fillRect(x, GROUND + 6, 12, 4);
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(0, GROUND, W, 5);

  // The bird: a round coral bird that tilts with its speed.
  ctx.save();
  ctx.translate(BIRD_X, g.y);
  ctx.rotate(Math.max(-0.5, Math.min(1.2, g.vy / 520)));
  ctx.fillStyle = '#fb7185';
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_R + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fecdd3';
  ctx.beginPath();
  ctx.ellipse(-3, 4 + Math.sin(t * 24) * (g.waiting || g.vy < 0 ? 4 : 1), 7, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(5, -4, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(6.5, -4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(11, -1);
  ctx.lineTo(18, 2);
  ctx.lineTo(11, 5);
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(15,23,42,0.35)';
  ctx.fillText(String(g.score), W / 2 + 2, 72);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(g.score), W / 2, 70);
  if (g.waiting) {
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Tap or press Space to flap', W / 2, GROUND - 40);
  }
  const medal = g.over ? medalFor(g.score) : null;
  if (medal) {
    ctx.fillStyle = MEDAL_COLORS[medal]!;
    ctx.beginPath();
    ctx.arc(W / 2, 120, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function FlappyWingGame() {
  return (
    <ArcadeShell
      name="Flappy Wing"
      storageKey="flappy-wing"
      width={W}
      height={H}
      create={(seed) => new FlappyGame(seed)}
      draw={draw}
      help="Tap, click, or press Space or Up to flap. Fly through the gaps between the columns; every column passed scores a point."
      sounds={{
        flap: (s) => s.tone(560, 70, 'triangle', 0.08, 820),
        point: (s) => s.tone(1046, 90, 'sine', 0.1),
        medal: SFX.fanfare,
        hit: (s) => SFX.boom(s, 160, 380),
      }}
    />
  );
}
