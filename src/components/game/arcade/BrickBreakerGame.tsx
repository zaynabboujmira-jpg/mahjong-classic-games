import ArcadeShell from '../ArcadeShell';
import { BALL_R, BRICK_H, BRICK_W, BricksGame, H, PADDLE_H, PADDLE_Y, W, type PowerKind } from '../../../engines/arcade/bricks';
import { SFX } from './common';

const COLORS: Record<string, [string, string]> = {
  '1': ['#f43f5e', '#fda4af'],
  '2': ['#f59e0b', '#fcd34d'],
  '3': ['#22c55e', '#86efac'],
  '4': ['#0ea5e9', '#7dd3fc'],
  '5': ['#8b5cf6', '#c4b5fd'],
  S: ['#94a3b8', '#e2e8f0'],
};
const POWER: Record<PowerKind, { color: string; label: string }> = {
  wide: { color: '#0ea5e9', label: 'W' },
  multi: { color: '#f59e0b', label: 'M' },
  life: { color: '#f43f5e', label: '♥' },
};

function draw(ctx: CanvasRenderingContext2D, g: BricksGame, t: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b1324');
  bg.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  for (const b of g.bricks) {
    const [base, light] = COLORS[b.color] ?? COLORS['1']!;
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, BRICK_W, BRICK_H, 3);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.fillRect(b.x + 2, b.y + 2, BRICK_W - 4, 3);
    if (b.color === 'S' && b.hits === 1) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x + 8, b.y + 2);
      ctx.lineTo(b.x + 15, b.y + 9);
      ctx.lineTo(b.x + 12, b.y + BRICK_H - 1);
      ctx.stroke();
    }
  }

  for (const p of g.powers) {
    const { color, label } = POWER[p.kind];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(p.x - 12, p.y - 8, 24, 16, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y + 1);
  }

  // Paddle, glowing while it is wide.
  const w = g.paddleW;
  ctx.shadowColor = g.wideFor > 0 ? '#38bdf8' : 'transparent';
  ctx.shadowBlur = g.wideFor > 0 ? 12 : 0;
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(g.paddleX - w / 2, PADDLE_Y, w, PADDLE_H, 5);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(g.paddleX - w / 2 + 6, PADDLE_Y + 3, w - 12, 3);

  ctx.fillStyle = '#fef08a';
  for (const b of g.balls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lives as small paddles.
  ctx.fillStyle = 'rgba(226,232,240,0.7)';
  for (let i = 0; i < Math.min(g.lives, 9); i++) ctx.fillRect(8 + i * 22, H - 14, 16, 4);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText(`Level ${g.level}`, W - 8, H - 9);

  if (g.serving && !g.over) {
    ctx.textAlign = 'center';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = `rgba(254,240,138,${0.6 + Math.sin(t * 5) * 0.3})`;
    ctx.fillText('Tap, click or press Space to launch', W / 2, PADDLE_Y - 60);
  }
}

export default function BrickBreakerGame() {
  return (
    <ArcadeShell
      name="Brick Breaker"
      storageKey="brick-breaker"
      width={W}
      height={H}
      create={(seed) => new BricksGame(seed)}
      draw={draw}
      buttons={[
        { action: 'left', label: '◀', aria: 'Move left' },
        { action: 'fire', label: '●', aria: 'Launch' },
        { action: 'right', label: '▶', aria: 'Move right' },
      ]}
      help="Drag on the game or move the mouse to steer the paddle (or use the arrow keys). Tap or press Space to launch. Break every brick; catch W, M and ♥ for power-ups."
      sounds={{
        paddle: (s) => s.tone(330, 50, 'square', 0.07),
        wall: (s) => s.tone(220, 30, 'square', 0.04),
        brick: (s) => s.tone(660, 50, 'square', 0.07, 880),
        tough: (s) => s.tone(440, 60, 'triangle', 0.08),
        power: (s) => s.tone(784, 160, 'triangle', 0.12, 1175),
        lose: SFX.lose,
        level: SFX.fanfare,
      }}
    />
  );
}
