import ArcadeShell from '../ArcadeShell';
import { ALIEN_H, ALIEN_W, H, InvadersGame, PLAYER_Y, SHIELD_CELL, SHIELD_COLS, SHIELD_ROWS, SHIELD_Y, W } from '../../../engines/arcade/invaders';
import { SFX, pixels } from './common';

// Original alien designs, two frames each: a jelly, a beetle and a blob.
const ALIENS: { color: string; frames: string[][] }[] = [
  {
    color: '#f472b6',
    frames: [
      ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X.XX.X.', 'X......X'],
      ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X.XX.X.', '.X....X.'],
    ],
  },
  {
    color: '#a3e635',
    frames: [
      ['X.XXXX.X', '.XXXXXX.', 'XX.XX.XX', '.XXXXXX.', '..X..X..', '.X....X.'],
      ['..XXXX..', 'XXXXXXXX', 'XX.XX.XX', '.XXXXXX.', '..X..X..', 'X......X'],
    ],
  },
  {
    color: '#38bdf8',
    frames: [
      ['.XXXXXX.', 'XXXXXXXX', 'X.XXXX.X', 'XXXXXXXX', '.XX..XX.', 'XX....XX'],
      ['.XXXXXX.', 'XXXXXXXX', 'X.XXXX.X', 'XXXXXXXX', 'XX.XX.XX', '.X....X.'],
    ],
  },
];
const ROW_TYPE = [0, 1, 1, 2, 2];

function draw(ctx: CanvasRenderingContext2D, g: InvadersGame, t: number) {
  ctx.fillStyle = '#070d16';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % W, (i * 53) % (H - 80), 1, 1);
  const frame = Math.floor(g.ox / 8) % 2 === 0 ? 0 : 1;
  for (const a of g.alive) {
    const kind = ALIENS[ROW_TYPE[a.row]!]!;
    ctx.fillStyle = kind.color;
    pixels(ctx, kind.frames[frame]!, g.alienX(a), g.alienY(a), ALIEN_W / 8, ALIEN_H / 6);
  }
  ctx.fillStyle = '#22c55e';
  for (const s of g.shields)
    for (let r = 0; r < SHIELD_ROWS; r++)
      for (let c = 0; c < SHIELD_COLS; c++) if (s.cells[r * SHIELD_COLS + c]) ctx.fillRect(s.x + c * SHIELD_CELL, SHIELD_Y + r * SHIELD_CELL, SHIELD_CELL, SHIELD_CELL);
  if (g.saucer) {
    const x = g.saucer.x;
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.ellipse(x, 42, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fecaca';
    ctx.beginPath();
    ctx.ellipse(x, 38, 7, 5, 0, Math.PI, 0);
    ctx.fill();
  }
  if (g.hit <= 0 || Math.floor(t * 10) % 2) {
    const x = g.playerX;
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.roundRect(x - 13, PLAYER_Y, 26, 9, 3);
    ctx.fill();
    ctx.fillRect(x - 3, PLAYER_Y - 7, 6, 8);
  }
  if (g.shot) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(g.shot.x - 1, g.shot.y - 6, 2, 10);
  }
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2;
  for (const b of g.bombs) {
    ctx.beginPath();
    ctx.moveTo(b.x - 2, b.y - 8);
    ctx.lineTo(b.x + 2, b.y - 4);
    ctx.lineTo(b.x - 2, b.y);
    ctx.lineTo(b.x + 2, b.y + 4);
    ctx.stroke();
  }
  ctx.fillStyle = '#1f6f5c';
  ctx.fillRect(0, H - 22, W, 2);
}

export default function AlienInvadersGame() {
  return (
    <ArcadeShell
      name="Alien Invaders"
      storageKey="alien-invaders"
      width={W}
      height={H}
      create={(seed) => new InvadersGame(seed)}
      draw={draw}
      buttons={[
        { action: 'left', label: '◀', aria: 'Move left' },
        { action: 'fire', label: 'Fire', aria: 'Fire' },
        { action: 'right', label: '▶', aria: 'Move right' },
      ]}
      help="Move with the arrow keys or A and D and fire with Space. On a touch screen, hold your finger on the game: the cannon follows it and fires."
      sounds={{
        shoot: (s) => s.tone(880, 90, 'square', 0.07, 220),
        alien: (s) => SFX.boom(s, 180, 160),
        player: SFX.lose,
        march0: (s) => s.tone(98, 70, 'square', 0.08),
        march1: (s) => s.tone(87, 70, 'square', 0.08),
        march2: (s) => s.tone(78, 70, 'square', 0.08),
        march3: (s) => s.tone(73, 70, 'square', 0.08),
        saucer: (s) => s.tone(520, 600, 'triangle', 0.06, 700),
        'saucer-hit': (s) => s.tone(1200, 320, 'square', 0.12, 300),
        wave: SFX.fanfare,
      }}
    />
  );
}
