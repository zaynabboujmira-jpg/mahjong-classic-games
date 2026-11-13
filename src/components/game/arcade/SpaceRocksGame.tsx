import ArcadeShell from '../ArcadeShell';
import { H, ROCK_R, RocksGame, SHIP_R, W } from '../../../engines/arcade/rocks';
import { SFX } from './common';

function draw(ctx: CanvasRenderingContext2D, g: RocksGame, t: number) {
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#cbd5e1';
  for (const r of g.rocks) {
    const R = ROCK_R[r.size]!;
    ctx.beginPath();
    r.shape.forEach((k, i) => {
      const a = r.angle + (i / r.shape.length) * Math.PI * 2;
      const x = r.x + Math.cos(a) * R * k;
      const y = r.y + Math.sin(a) * R * k;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }
  ctx.fillStyle = '#fde68a';
  for (const b of g.bullets) ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
  if (g.respawn > 0) return;
  const s = g.ship;
  // Draw the ship once, plus copies across the edges so wrapping looks seamless.
  for (const ox of [-W, 0, W])
    for (const oy of [-H, 0, H]) {
      const x = s.x + ox;
      const y = s.y + oy;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.angle);
      ctx.strokeStyle = '#5eead4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(SHIP_R + 4, 0);
      ctx.lineTo(-SHIP_R, -SHIP_R * 0.75);
      ctx.lineTo(-SHIP_R * 0.55, 0);
      ctx.lineTo(-SHIP_R, SHIP_R * 0.75);
      ctx.closePath();
      ctx.stroke();
      if (g.thrusting && Math.floor(t * 30) % 2) {
        ctx.strokeStyle = '#fb923c';
        ctx.beginPath();
        ctx.moveTo(-SHIP_R * 0.6, -4);
        ctx.lineTo(-SHIP_R * 1.6, 0);
        ctx.lineTo(-SHIP_R * 0.6, 4);
        ctx.stroke();
      }
      ctx.restore();
      if (g.shield > 0 && (g.shield > 0.6 || Math.floor(t * 12) % 2)) {
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.55)';
        ctx.beginPath();
        ctx.arc(x, y, SHIP_R + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
}

export default function SpaceRocksGame() {
  return (
    <ArcadeShell
      name="Space Rocks"
      storageKey="space-rocks"
      width={W}
      height={H}
      create={(seed) => new RocksGame(seed)}
      draw={draw}
      buttons={[
        { action: 'left', label: '⟲', aria: 'Turn left' },
        { action: 'right', label: '⟳', aria: 'Turn right' },
        { action: 'up', label: 'Thrust', aria: 'Thrust' },
        { action: 'special', label: 'Hyper', aria: 'Hyperspace jump' },
        { action: 'fire', label: 'Fire', aria: 'Fire' },
      ]}
      help="Turn with left and right, thrust with up, fire with Space and jump to hyperspace with H. Touch screens get buttons, and tapping the space fires."
      sounds={{
        fire: (s) => s.tone(760, 80, 'square', 0.06, 300),
        bang3: (s) => SFX.boom(s, 90, 420),
        bang2: (s) => SFX.boom(s, 130, 300),
        bang1: (s) => SFX.boom(s, 200, 200),
        die: SFX.lose,
        hyper: (s) => s.tone(200, 300, 'sine', 0.14, 1200),
        extra: SFX.fanfare,
        wave: (s) => s.tone(392, 220, 'triangle', 0.12, 784),
      }}
    />
  );
}
