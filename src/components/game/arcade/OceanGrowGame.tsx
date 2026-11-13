import ArcadeShell from '../ArcadeShell';
import { H, OceanGame, W } from '../../../engines/arcade/ocean';
import { SFX } from './common';

function fish(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, facing: number, body: string, outline: string | null, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const wag = Math.sin(t * 9 + x * 0.05) * r * 0.15;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, 0);
  ctx.lineTo(-r * 1.45, -r * 0.6 + wag);
  ctx.lineTo(-r * 1.45, r * 0.6 + wag);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(r * 0.5, -r * 0.18, Math.max(1.6, r * 0.18), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(r * 0.55, -r * 0.18, Math.max(0.9, r * 0.09), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, g: OceanGame, t: number) {
  const sea = ctx.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#0891b2');
  sea.addColorStop(1, '#082f49');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(40 + i * 90 + Math.sin(t / 2 + i) * 10, 0);
    ctx.lineTo(80 + i * 90, 0);
    ctx.lineTo(10 + i * 90, H);
    ctx.lineTo(-20 + i * 90, H);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 12; i++) {
    const y = H - ((t * 25 + i * 53) % H);
    ctx.beginPath();
    ctx.arc((i * 71) % W + Math.sin(t + i) * 4, y, 1.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const f of g.fish) {
    const danger = f.r > g.r;
    fish(ctx, f.x, f.y, f.r, Math.sign(f.vx) || 1, `hsl(${f.hue} 65% ${danger ? 42 : 60}%)`, danger ? '#f87171' : null, t);
  }
  if (g.safe <= 0 || Math.floor(t * 10) % 2) fish(ctx, g.x, g.y, g.r, g.facing, '#fbbf24', '#fff7ed', t);
  // Growth bar.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.roundRect(12, 12, W - 24, 10, 5);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.roundRect(12, 12, Math.max(10, (W - 24) * g.progress()), 10, 5);
  ctx.fill();
}

export default function OceanGrowGame() {
  return (
    <ArcadeShell
      name="Ocean Grow"
      storageKey="ocean-grow"
      width={W}
      height={H}
      create={(seed) => new OceanGame(seed)}
      draw={draw}
      help="Your fish swims towards your finger or mouse, or use the arrow keys. Eat smaller fish to grow; fish outlined in red are bigger than you."
      sounds={{
        eat: (s) => s.tone(700, 70, 'sine', 0.1, 1100),
        die: SFX.lose,
        level: SFX.fanfare,
      }}
    />
  );
}
