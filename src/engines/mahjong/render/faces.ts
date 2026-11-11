import type { Face } from '../types';

/*
 * Tile artwork drawn with Canvas primitives and CJK glyphs, so the game ships
 * no image files. Every face also gets a small Latin index in its corner
 * (e.g. "3", "E") so it stays readable where CJK fonts are missing.
 */

const CJK = '"Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","Microsoft YaHei","PingFang SC","Hiragino Sans GB",serif';
const LATIN = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

const INK = { red: '#c2272d', green: '#167a3e', blue: '#1d4e89', dark: '#1f2933', gold: '#b7791f', purple: '#7b3fa0', pink: '#c2417a' };

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WIND_GLYPHS = ['東', '南', '西', '北'];
const WIND_INDEX = ['E', 'S', 'W', 'N'];
const FLOWER_GLYPHS = ['梅', '蘭', '菊', '竹'];
const FLOWER_INK = [INK.pink, INK.purple, INK.gold, INK.green];
const SEASON_GLYPHS = ['春', '夏', '秋', '冬'];
const SEASON_INK = [INK.green, INK.red, INK.gold, INK.blue];

/** Pip positions (0..1 in the content box) for 1-9, shared by dots and bamboo. */
const PIPS: readonly (readonly [number, number])[][] = [
  [[0.5, 0.5]],
  [[0.5, 0.27], [0.5, 0.73]],
  [[0.24, 0.2], [0.5, 0.5], [0.76, 0.8]],
  [[0.28, 0.27], [0.72, 0.27], [0.28, 0.73], [0.72, 0.73]],
  [[0.26, 0.22], [0.74, 0.22], [0.5, 0.5], [0.26, 0.78], [0.74, 0.78]],
  [[0.3, 0.2], [0.7, 0.2], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
  [[0.22, 0.14], [0.5, 0.25], [0.78, 0.36], [0.3, 0.6], [0.7, 0.6], [0.3, 0.85], [0.7, 0.85]],
  [[0.3, 0.13], [0.7, 0.13], [0.3, 0.38], [0.7, 0.38], [0.3, 0.62], [0.7, 0.62], [0.3, 0.87], [0.7, 0.87]],
  [[0.2, 0.17], [0.5, 0.17], [0.8, 0.17], [0.2, 0.5], [0.5, 0.5], [0.8, 0.5], [0.2, 0.83], [0.5, 0.83], [0.8, 0.83]],
];
const DOT_COLORS = [INK.blue, INK.green, INK.red];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function glyph(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, color: string, font = CJK) {
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

function drawDots(ctx: CanvasRenderingContext2D, n: number, box: Box) {
  const r = box.w * (n === 1 ? 0.34 : n <= 4 ? 0.17 : n <= 6 ? 0.15 : 0.12);
  PIPS[n - 1]!.forEach(([px, py], k) => {
    const cx = box.x + px * box.w;
    const cy = box.y + py * box.h;
    ctx.fillStyle = DOT_COLORS[(k + n) % 3]!;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fffaf0';
    ctx.lineWidth = r * 0.28;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawBamboo(ctx: CanvasRenderingContext2D, n: number, box: Box) {
  if (n === 1) {
    // A single tall stalk with leaves stands in for the traditional bird.
    const cx = box.x + box.w / 2;
    ctx.fillStyle = INK.green;
    roundRect(ctx, cx - box.w * 0.08, box.y + box.h * 0.12, box.w * 0.16, box.h * 0.76, box.w * 0.06);
    ctx.fill();
    ctx.fillStyle = INK.red;
    ctx.beginPath();
    ctx.ellipse(cx - box.w * 0.18, box.y + box.h * 0.35, box.w * 0.16, box.w * 0.07, -0.6, 0, Math.PI * 2);
    ctx.ellipse(cx + box.w * 0.18, box.y + box.h * 0.6, box.w * 0.16, box.w * 0.07, 0.6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const sw = box.w * (n <= 4 ? 0.14 : 0.12);
  const sh = box.h * (n <= 2 ? 0.36 : n <= 6 ? 0.24 : 0.2);
  PIPS[n - 1]!.forEach(([px, py], k) => {
    const cx = box.x + px * box.w;
    const cy = box.y + py * box.h;
    ctx.fillStyle = n % 2 === 1 && k === Math.floor(n / 2) ? INK.red : INK.green;
    roundRect(ctx, cx - sw / 2, cy - sh / 2, sw, sh, sw / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(cx - sw / 2, cy - sh * 0.04, sw, sh * 0.08);
  });
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cornerIndex(face: Face): { text: string; color: string } | null {
  switch (face.suit) {
    case 'dots':
      return { text: String(face.rank), color: INK.blue };
    case 'bamboo':
      return { text: String(face.rank), color: INK.green };
    case 'characters':
      return { text: String(face.rank), color: INK.red };
    case 'wind':
      return { text: WIND_INDEX[face.rank - 1]!, color: INK.dark };
    default:
      return null;
  }
}

/** Draws a face's artwork inside the face rectangle (0, 0, w, h). */
export function drawFace(ctx: CanvasRenderingContext2D, face: Face, w: number, h: number) {
  // Content box keeps portrait proportions, centred even on landscape tiles.
  const bw = Math.min(w * 0.8, (h * 0.8) / 1.22);
  const bh = bw * 1.22;
  const box: Box = { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh };
  const cx = w / 2;
  const cy = h / 2;
  const big = bh * 0.62;

  switch (face.suit) {
    case 'dots':
      drawDots(ctx, face.rank, box);
      break;
    case 'bamboo':
      drawBamboo(ctx, face.rank, box);
      break;
    case 'characters':
      glyph(ctx, NUMERALS[face.rank - 1]!, cx, box.y + bh * 0.28, bh * 0.4, INK.dark);
      glyph(ctx, '萬', cx, box.y + bh * 0.72, bh * 0.44, INK.red);
      break;
    case 'wind':
      glyph(ctx, WIND_GLYPHS[face.rank - 1]!, cx, cy, big, INK.dark);
      break;
    case 'dragon':
      if (face.rank === 1) glyph(ctx, '中', cx, cy, big, INK.red);
      else if (face.rank === 2) glyph(ctx, '發', cx, cy, big, INK.green);
      else {
        ctx.strokeStyle = INK.blue;
        ctx.lineWidth = bw * 0.08;
        ctx.strokeRect(box.x + bw * 0.12, box.y + bh * 0.12, bw * 0.76, bh * 0.76);
      }
      break;
    case 'flower':
      glyph(ctx, FLOWER_GLYPHS[face.rank - 1]!, cx, cy, big * 0.9, FLOWER_INK[face.rank - 1]!);
      glyph(ctx, '✿', box.x + bw * 0.86, box.y + bh * 0.1, bh * 0.16, FLOWER_INK[face.rank - 1]!, LATIN);
      break;
    case 'season':
      glyph(ctx, SEASON_GLYPHS[face.rank - 1]!, cx, cy, big * 0.9, SEASON_INK[face.rank - 1]!);
      glyph(ctx, '☀', box.x + bw * 0.86, box.y + bh * 0.1, bh * 0.16, SEASON_INK[face.rank - 1]!, LATIN);
      break;
  }

  const idx = cornerIndex(face);
  if (idx) glyph(ctx, idx.text, w * 0.13, h * 0.12, Math.max(9, h * 0.15), idx.color, LATIN);
}
