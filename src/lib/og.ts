import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import type { Slot } from '../engines/mahjong/types';
import { boundsOf } from '../engines/mahjong/board';
import { layoutPreviewSvg } from './layout-preview';
import { SITE } from '../data/site';
import { PIECE_PATHS } from '../components/game/chess-pieces';

/*
 * Build-time PNG rendering for OpenGraph images and app icons. Runs only
 * while Astro prerenders, never in the browser, so it costs no client JS.
 */
const FONT_DIR = join(process.cwd(), 'node_modules', '@expo-google-fonts', 'inter');
const fontFiles = [join(FONT_DIR, '400Regular', 'Inter_400Regular.ttf'), join(FONT_DIR, '700Bold', 'Inter_700Bold.ttf')];

export function svgToPng(svg: string, width: number): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' },
  });
  return resvg.render().asPng();
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Greedy word wrap for SVG text (resvg has no automatic wrapping). */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

export interface OgArt {
  svg: string;
  width: number;
  height: number;
}

/** A Mahjong layout's silhouette, 540px wide. */
export function layoutArt(slots: readonly Slot[]): OgArt {
  const b = boundsOf(slots);
  const width = 540;
  const height = (width * ((b.h / 2) * 1.22 + (b.maxZ + 1) * 0.14)) / (b.w / 2 + (b.maxZ + 1) * 0.14);
  return { svg: layoutPreviewSvg(slots, { tile: 10, width }), width, height };
}

/** Suit shapes as paths in a 100x100 box (the OG font has no suit glyphs). */
const SUIT_PATHS: Record<'s' | 'h' | 'd' | 'c', string> = {
  d: '<path d="M50 0 L88 50 L50 100 L12 50 Z"/>',
  h: '<path d="M50 92 C20 66 0 47 0 29 C0 12 12 0 27 0 C38 0 46 7 50 16 C54 7 62 0 73 0 C88 0 100 12 100 29 C100 47 80 66 50 92 Z"/>',
  s: '<path d="M50 0 C80 30 100 45 100 62 C100 77 88 88 74 88 C64 88 57 83 53 77 C54 88 58 95 66 100 L34 100 C42 95 46 88 47 77 C43 83 36 88 26 88 C12 88 0 77 0 62 C0 45 20 30 50 0 Z"/>',
  c: '<circle cx="50" cy="26" r="23"/><circle cx="24" cy="58" r="23"/><circle cx="76" cy="58" r="23"/><path d="M44 58 L56 58 L63 100 L37 100 Z"/>',
};

type FanCard = readonly [rank: string, suit: 's' | 'h' | 'd' | 'c'];
const KLONDIKE_FAN: FanCard[] = [['A', 's'], ['K', 'h'], ['Q', 'c'], ['J', 'd'], ['10', 's']];

/** A fan of five playing cards for card-game pages. */
export function cardFanArt(cards: readonly FanCard[] = KLONDIKE_FAN): OgArt {
  const w = 170;
  const h = 238;
  const svg = cards
    .map(([rank, suit], i) => {
      const ink = suit === 'h' || suit === 'd' ? '#c2272d' : '#1b2823';
      const angle = (i - 2) * 11;
      const x = 150 + i * 62;
      return `<g transform="translate(${x} 300) rotate(${angle}) translate(${-w / 2} ${-h})">
  <rect width="${w}" height="${h}" rx="14" fill="#fffdf8" stroke="#bfb6a3" stroke-width="2"/>
  <text x="16" y="50" font-size="44" font-weight="700" fill="${ink}">${rank}</text>
  <g transform="translate(${w / 2 - 40} ${h * 0.4}) scale(0.8)" fill="${ink}">${SUIT_PATHS[suit]}</g>
</g>`;
    })
    .join('');
  return { svg, width: 540, height: 340 };
}

/** A 9x9 Sudoku grid with its clues, 340px square. */
export function sudokuArt(givens: readonly number[]): OgArt {
  const size = 340;
  const cell = size / 9;
  const lines: string[] = [];
  for (let k = 0; k <= 9; k++) {
    const p = k * cell;
    const w = k % 3 === 0 ? 3 : 1;
    const c = k % 3 === 0 ? '#1b2823' : '#c9bfa8';
    lines.push(`<line x1="${p}" y1="0" x2="${p}" y2="${size}" stroke="${c}" stroke-width="${w}"/>`);
    lines.push(`<line x1="0" y1="${p}" x2="${size}" y2="${p}" stroke="${c}" stroke-width="${w}"/>`);
  }
  const digits = givens
    .map((v, i) =>
      v
        ? `<text x="${(i % 9) * cell + cell / 2}" y="${Math.floor(i / 9) * cell + cell * 0.72}" font-size="${Math.round(cell * 0.6)}" font-weight="700" text-anchor="middle" fill="#1b2823">${v}</text>`
        : '',
    )
    .join('');
  const svg = `<g transform="translate(100 0)"><rect width="${size}" height="${size}" rx="8" fill="#fffdf8"/>${lines.join('')}${digits}</g>`;
  return { svg, width: 540, height: size };
}

/** A small Minesweeper field: opened cells with numbers, hidden tiles and flags. */
export function minesArt(field: { width: number; height: number; cells: readonly ('hidden' | 'flag' | number)[] }): OgArt {
  const cell = Math.floor(Math.min(500 / field.width, 380 / field.height));
  const w = cell * field.width;
  const h = cell * field.height;
  const colors = ['', '#1d4ed8', '#15803d', '#c2272d', '#1e3a8a', '#7f1d1d', '#0f766e', '#1b2823', '#6b7280'];
  const parts = field.cells.map((c, i) => {
    const x = (i % field.width) * cell;
    const y = Math.floor(i / field.width) * cell;
    if (c === 'hidden' || c === 'flag') {
      const b = Math.round(cell * 0.12);
      const tile = `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#b9c8bd"/><path d="M${x} ${y}h${cell}l-${b} ${b}h-${cell - 2 * b}v${cell - 2 * b}l-${b} ${b}z" fill="#eef3ee"/><path d="M${x + cell} ${y + cell}h-${cell}l${b} -${b}h${cell - 2 * b}v-${cell - 2 * b}l${b} -${b}z" fill="#7d9186"/>`;
      if (c === 'hidden') return tile;
      return `${tile}<rect x="${x + cell * 0.48}" y="${y + cell * 0.22}" width="${cell * 0.07}" height="${cell * 0.5}" fill="#1b2823"/><rect x="${x + cell * 0.3}" y="${y + cell * 0.7}" width="${cell * 0.42}" height="${cell * 0.08}" fill="#1b2823"/><path d="M${x + cell * 0.55} ${y + cell * 0.2}V${y + cell * 0.5}L${x + cell * 0.24} ${y + cell * 0.35}z" fill="#c2272d"/>`;
    }
    const bg = `<rect x="${x + 0.5}" y="${y + 0.5}" width="${cell - 1}" height="${cell - 1}" fill="#f6f1e6"/>`;
    return c ? `${bg}<text x="${x + cell / 2}" y="${y + cell * 0.72}" font-size="${Math.round(cell * 0.62)}" font-weight="700" text-anchor="middle" fill="${colors[c]}">${c}</text>` : bg;
  });
  const svg = `<g transform="translate(${Math.round((540 - w) / 2)} 0)"><rect width="${w}" height="${h}" fill="#d6ccb6"/>${parts.join('')}</g>`;
  return { svg, width: 540, height: h };
}

const TILE_PIPS: readonly (readonly [number, number])[][] = [
  [[0.5, 0.5]],
  [[0.5, 0.28], [0.5, 0.72]],
  [[0.26, 0.22], [0.5, 0.5], [0.74, 0.78]],
  [[0.3, 0.28], [0.7, 0.28], [0.3, 0.72], [0.7, 0.72]],
  [[0.28, 0.24], [0.72, 0.24], [0.5, 0.5], [0.28, 0.76], [0.72, 0.76]],
  [[0.32, 0.2], [0.68, 0.2], [0.32, 0.5], [0.68, 0.5], [0.32, 0.8], [0.68, 0.8]],
  [[0.24, 0.16], [0.5, 0.27], [0.76, 0.38], [0.32, 0.62], [0.68, 0.62], [0.32, 0.85], [0.68, 0.85]],
  [[0.32, 0.15], [0.68, 0.15], [0.32, 0.38], [0.68, 0.38], [0.32, 0.62], [0.68, 0.62], [0.32, 0.85], [0.68, 0.85]],
  [[0.22, 0.18], [0.5, 0.18], [0.78, 0.18], [0.22, 0.5], [0.5, 0.5], [0.78, 0.5], [0.22, 0.82], [0.5, 0.82], [0.78, 0.82]],
];

/** One tile face for OG art: dots, bamboo, a flower or a joker (no CJK font needed). */
export type ArtTile = { dots: number } | { bamboo: number } | 'flower' | 'joker';

/** A row of upright Mahjong tiles, the middle one raised like a tile being played. */
export function tileHandArt(tiles: readonly ArtTile[]): OgArt {
  const w = 70;
  const h = 94;
  const gap = 6;
  const total = tiles.length * w + (tiles.length - 1) * gap;
  const x0 = (540 - total) / 2;
  const svg = tiles
    .map((t, i) => {
      const x = x0 + i * (w + gap);
      const y = 70 - (i === 3 ? 18 : 0);
      let face = '';
      if (t === 'joker') {
        face = `<text x="${w / 2}" y="${h * 0.55}" font-size="40" font-weight="700" text-anchor="middle" fill="#7b3fa0">J</text><text x="${w / 2}" y="${h * 0.83}" font-size="12" font-weight="700" text-anchor="middle" fill="#b7791f">JOKER</text>`;
      } else if (t === 'flower') {
        face =
          [0, 1, 2, 3, 4]
            .map((k) => {
              const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
              return `<circle cx="${w / 2 + Math.cos(a) * 14}" cy="${h / 2 + Math.sin(a) * 14}" r="10" fill="#c2417a"/>`;
            })
            .join('') + `<circle cx="${w / 2}" cy="${h / 2}" r="7" fill="#f5d37a"/>`;
      } else if ('dots' in t) {
        const colors = ['#1d4e89', '#167a3e', '#c2272d'];
        const r = t.dots === 1 ? 20 : t.dots <= 4 ? 10 : 8;
        face = TILE_PIPS[t.dots - 1]!.map(([px, py], k) => `<circle cx="${8 + px * (w - 16)}" cy="${10 + py * (h - 20)}" r="${r}" fill="${colors[(k + t.dots) % 3]}"/>`).join('');
      } else {
        face = TILE_PIPS[t.bamboo - 1]!.map(([px, py]) => `<rect x="${8 + px * (w - 16) - 4}" y="${10 + py * (h - 20) - 11}" width="8" height="22" rx="4" fill="#167a3e"/>`).join('');
      }
      return `<g transform="translate(${x} ${y})"><rect y="7" width="${w}" height="${h}" rx="9" fill="#b3a27c"/><rect width="${w}" height="${h}" rx="9" fill="#fbf6e9" stroke="#a8987a" stroke-width="2"/>${face}</g>`;
    })
    .join('');
  return { svg, width: 540, height: 250 };
}

/** Word Guess: rows of coloured letter tiles. */
export function wordArt(rows: readonly { word: string; marks: string }[]): OgArt {
  const colors: Record<string, string> = { h: '#15803d', n: '#d97706', m: '#4b5563' };
  const len = rows[0]!.word.length;
  const tile = Math.min(64, Math.floor(440 / len));
  const gap = 8;
  const w = len * tile + (len - 1) * gap;
  const x0 = (540 - w) / 2;
  const svg = rows
    .map((r, ri) =>
      [...r.word]
        .map((ch, i) => {
          const x = x0 + i * (tile + gap);
          const y = ri * (tile + gap);
          return `<rect x="${x}" y="${y}" width="${tile}" height="${tile}" rx="8" fill="${colors[r.marks[i]!]}"/><text x="${x + tile / 2}" y="${y + tile * 0.7}" font-size="${tile * 0.55}" font-weight="700" text-anchor="middle" fill="#ffffff">${ch}</text>`;
        })
        .join(''),
    )
    .join('');
  return { svg, width: 540, height: rows.length * (tile + gap) - gap };
}

/** Color Memory: four rounded pads, one lit. */
export function memoryArt(): OgArt {
  const pads = [
    ['#0f9b8e', '#5eead4'],
    ['#c0264d', '#c0264d'],
    ['#c77c0a', '#c77c0a'],
    ['#4338ca', '#4338ca'],
  ];
  const s = 160;
  const gap = 14;
  const x0 = (540 - (2 * s + gap)) / 2;
  const svg = pads
    .map(([base, lit], i) => `<rect x="${x0 + (i % 2) * (s + gap)}" y="${Math.floor(i / 2) * (s + gap)}" width="${s}" height="${s}" rx="26" fill="${i === 0 ? lit : base}"/>`)
    .join('');
  return { svg, width: 540, height: 2 * s + gap };
}

/** Paddle Ball: a small court with two paddles and a ball. */
export function paddleArt(): OgArt {
  const w = 460;
  const h = 290;
  const x0 = 40;
  const svg = `<g transform="translate(${x0} 0)"><rect width="${w}" height="${h}" rx="14" fill="#0e3127"/><path d="M${w / 2} 14V${h - 14}" stroke="#ffffff" stroke-opacity=".3" stroke-width="5" stroke-dasharray="14 14"/><rect x="26" y="70" width="14" height="96" rx="5" fill="#f5ecd2"/><rect x="${w - 40}" y="140" width="14" height="96" rx="5" fill="#f5ecd2"/><circle cx="300" cy="120" r="10" fill="#f5d37a"/><text x="${w / 2 - 40}" y="60" font-size="42" font-weight="700" text-anchor="middle" fill="#ffffff" fill-opacity=".75">3</text><text x="${w / 2 + 40}" y="60" font-size="42" font-weight="700" text-anchor="middle" fill="#ffffff" fill-opacity=".75">2</text></g>`;
  return { svg, width: 540, height: h };
}

/** Arcade pack artwork: one small original scene per game, 460 × 300 inside a 540-wide art box. */
export function arcadeArt(kind: 'maze-chomper' | 'alien-invaders' | 'space-rocks' | 'river-hopper' | 'flappy-wing' | 'ocean-grow'): OgArt {
  const frame = (bg: string, inner: string) => `<g transform="translate(40 0)"><rect width="460" height="300" rx="16" fill="${bg}"/>${inner}</g>`;
  let svg = '';
  switch (kind) {
    case 'maze-chomper': {
      const walls = [
        [20, 20, 420, 14], [20, 266, 420, 14], [20, 20, 14, 260], [426, 20, 14, 260],
        [70, 70, 110, 30], [280, 70, 110, 30], [70, 200, 110, 30], [280, 200, 110, 30], [215, 70, 30, 160],
      ];
      const dots = Array.from({ length: 14 }, (_, i) => `<circle cx="${60 + i * 25}" cy="155" r="4" fill="#fde68a"/>`).join('');
      svg = frame('#081722', `${walls.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#145c4c"/>`).join('')}${dots}
<circle cx="120" cy="155" r="18" fill="#34d399"/><circle cx="124" cy="150" r="5" fill="#fff"/><circle cx="134" cy="150" r="5" fill="#fff"/><circle cx="126" cy="150" r="2.4" fill="#0f172a"/><circle cx="136" cy="150" r="2.4" fill="#0f172a"/>
${([['#a855f7', 300], ['#f97316', 360]] as const).map(([c, x]) => `<path d="M${x} 137 Q${+x + 18} 137 ${+x + 18} 155 Q${+x + 18} 173 ${x} 173 Q${+x - 18} 173 ${+x - 18} 155 Q${+x - 18} 137 ${x} 137z" fill="${c}"/><rect x="${+x - 9}" y="148" width="6" height="8" fill="#fff"/><rect x="${+x + 3}" y="148" width="6" height="8" fill="#fff"/>`).join('')}`);
      break;
    }
    case 'alien-invaders': {
      const alien = (x: number, y: number, c: string) =>
        ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X.XX.X.', 'X......X']
          .flatMap((row, r) => [...row].map((ch, k) => (ch === 'X' ? `<rect x="${x + k * 5}" y="${y + r * 5}" width="5" height="5" fill="${c}"/>` : '')))
          .join('');
      let a = '';
      ['#f472b6', '#a3e635', '#38bdf8'].forEach((c, r) => {
        for (let i = 0; i < 6; i++) a += alien(70 + i * 56, 40 + r * 44, c);
      });
      svg = frame('#070d16', `${a}<rect x="90" y="200" width="60" height="30" rx="6" fill="#22c55e"/><rect x="310" y="200" width="60" height="30" rx="6" fill="#22c55e"/><rect x="205" y="258" width="50" height="16" rx="4" fill="#34d399"/><rect x="226" y="246" width="8" height="14" fill="#34d399"/><rect x="229" y="190" width="3" height="24" fill="#fff"/>`);
      break;
    }
    case 'space-rocks': {
      const rock = (cx: number, cy: number, r: number) => {
        const k = [1, 0.8, 1.05, 0.85, 1, 0.75, 1.1, 0.9, 0.95];
        return `<polygon points="${k.map((m, i) => `${(cx + Math.cos((i / k.length) * 6.283) * r * m).toFixed(1)},${(cy + Math.sin((i / k.length) * 6.283) * r * m).toFixed(1)}`).join(' ')}" fill="none" stroke="#cbd5e1" stroke-width="3"/>`;
      };
      svg = frame('#05070d', `${rock(110, 90, 50)}${rock(350, 80, 34)}${rock(380, 220, 22)}${rock(130, 230, 26)}<polygon points="250,130 220,180 230,165 240,180" fill="none" stroke="#5eead4" stroke-width="3" transform="rotate(20 235 160)"/><circle cx="270" cy="110" r="3" fill="#fde68a"/><circle cx="285" cy="90" r="3" fill="#fde68a"/>`);
      break;
    }
    case 'river-hopper': {
      const rows = ['#14532d', '#1d4ed8', '#1d4ed8', '#a16207', '#334155', '#334155', '#166534'];
      const bands = rows.map((c, i) => `<rect x="0" y="${i * 42.8}" width="460" height="43" fill="${c}"/>`).join('');
      svg = frame('#000', `<clipPath id="rh"><rect width="460" height="300" rx="16"/></clipPath><g clip-path="url(#rh)">${bands}
<rect x="40" y="50" width="150" height="26" rx="12" fill="#92400e"/><rect x="260" y="93" width="190" height="26" rx="12" fill="#92400e"/>
<rect x="60" y="180" width="70" height="28" rx="6" fill="#f87171"/><rect x="300" y="222" width="60" height="28" rx="6" fill="#60a5fa"/>
<circle cx="230" cy="150" r="18" fill="#f59e0b"/><circle cx="219" cy="134" r="7" fill="#f59e0b"/><circle cx="241" cy="134" r="7" fill="#f59e0b"/><circle cx="224" cy="148" r="2.5" fill="#1c1917"/><circle cx="236" cy="148" r="2.5" fill="#1c1917"/></g>`);
      break;
    }
    case 'flappy-wing':
      svg = frame('#38bdf8', `<rect x="250" y="0" width="60" height="110" fill="#94a3b8"/><rect x="244" y="96" width="72" height="16" fill="#64748b"/><rect x="250" y="210" width="60" height="70" fill="#94a3b8"/><rect x="244" y="210" width="72" height="16" fill="#64748b"/><rect x="0" y="270" width="460" height="30" fill="#e7c98f"/><rect x="0" y="270" width="460" height="6" fill="#16a34a"/><ellipse cx="90" cy="70" rx="40" ry="14" fill="#fff" opacity=".8"/>
<circle cx="150" cy="160" r="26" fill="#fb7185"/><ellipse cx="142" cy="170" rx="14" ry="8" fill="#fecdd3"/><circle cx="160" cy="151" r="9" fill="#fff"/><circle cx="163" cy="151" r="4" fill="#111827"/><path d="M174 156 L190 162 L174 168z" fill="#f59e0b"/>`);
      break;
    case 'ocean-grow': {
      const fish = (x: number, y: number, r: number, c: string, dir = 1, outline = '') =>
        `<g transform="translate(${x} ${y}) scale(${dir} 1)"><path d="M${-r * 0.8} 0 L${-r * 1.45} ${-r * 0.6} L${-r * 1.45} ${r * 0.6}z" fill="${c}"/><ellipse rx="${r}" ry="${r * 0.68}" fill="${c}" ${outline ? `stroke="${outline}" stroke-width="3"` : ''}/><circle cx="${r * 0.5}" cy="${-r * 0.18}" r="${r * 0.18}" fill="#fff"/><circle cx="${r * 0.55}" cy="${-r * 0.18}" r="${r * 0.09}" fill="#0f172a"/></g>`;
      svg = frame('#0e5a7a', `${fish(150, 150, 34, '#fbbf24', 1, '#fff7ed')}${fish(240, 120, 12, '#f472b6')}${fish(270, 190, 10, '#a3e635')}${fish(370, 90, 58, '#7c3aed', -1, '#f87171')}${fish(90, 250, 9, '#38bdf8', -1)}<rect x="20" y="16" width="420" height="10" rx="5" fill="rgba(0,0,0,.3)"/><rect x="20" y="16" width="250" height="10" rx="5" fill="#fbbf24"/>`);
      break;
    }
  }
  return { svg, width: 540, height: 300 };
}

/** Art for the six newer games, each an original scene in a 460 × 300 frame. */
export function newGameArt(
  kind: 'snake' | 'brick-breaker' | 'number-merge' | 'memory-match' | 'nonogram' | 'four-in-a-row' | 'chess' | 'checkers' | 'dominoes' | 'word-search' | 'mini-crossword' | 'bubble-shooter' | 'hearts' | 'spades' | 'pyramid' | 'backgammon' | 'tic-tac-toe' | 'word-builder',
  picture: readonly (readonly boolean[])[] = []): OgArt {
  const frame = (bg: string, inner: string) => `<g transform="translate(40 0)"><rect width="460" height="300" rx="16" fill="${bg}"/>${inner}</g>`;
  let svg = '';
  switch (kind) {
    case 'snake': {
      const path = [[3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [7, 8], [7, 7], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6], [12, 7], [12, 8], [13, 8], [14, 8]];
      const c = 20;
      const cells = path.map(([x, y], i) => `<rect x="${30 + x! * c + 2}" y="${y! * c + 2}" width="${c - 4}" height="${c - 4}" rx="5" fill="hsl(${150 + (i / path.length) * 20} 70% ${32 + (i / path.length) * 22}%)"/>`).join('');
      svg = frame('#123b2f', `<rect x="4" y="4" width="452" height="292" rx="14" fill="none" stroke="#f59e0b" stroke-width="5"/>${cells}<circle cx="${30 + 19 * c + 10}" cy="${8 * c + 11}" r="8" fill="#f43f5e"/><ellipse cx="${30 + 19 * c + 13}" cy="${8 * c + 2}" rx="4" ry="2" fill="#4ade80"/>`);
      break;
    }
    case 'brick-breaker': {
      const colors = ['#f43f5e', '#f59e0b', '#22c55e', '#0ea5e9', '#8b5cf6'];
      let bricks = '';
      colors.forEach((col, r) => {
        for (let i = 0; i < 10; i++) if (!(r === 3 && (i === 4 || i === 5))) bricks += `<rect x="${22 + i * 42}" y="${26 + r * 22}" width="38" height="18" rx="3" fill="${col}"/>`;
      });
      svg = frame('#0b1324', `${bricks}<rect x="190" y="262" width="96" height="12" rx="6" fill="#e2e8f0"/><circle cx="262" cy="196" r="8" fill="#fef08a"/><rect x="96" y="200" width="30" height="18" rx="9" fill="#0ea5e9"/><text x="111" y="214" font-size="13" font-weight="700" text-anchor="middle" fill="#fff">W</text>`);
      break;
    }
    case 'number-merge': {
      const vals = [
        [2, 4, 8, 0],
        [0, 16, 32, 64],
        [4, 128, 256, 512],
        [2, 0, 1024, 2048],
      ];
      const hues = [0, 0, 168, 176, 190, 205, 220, 262, 290, 320, 345, 18, 38];
      const s = 62;
      const g = 8;
      let tiles = '';
      vals.forEach((row, r) =>
        row.forEach((v, c) => {
          const x = 100 + c * (s + g);
          const y = 12 + r * (s + g);
          if (!v) {
            tiles += `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="8" fill="#ffffff" fill-opacity=".08"/>`;
            return;
          }
          const k = Math.log2(v);
          const light = k <= 2 ? 88 - k * 4 : Math.max(38, 62 - (k % 4) * 4);
          tiles += `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="8" fill="hsl(${hues[Math.min(k, hues.length - 1)]} ${k <= 2 ? 45 : 70}% ${light}%)"/><text x="${x + s / 2}" y="${y + s / 2 + (v >= 1000 ? 7 : 10)}" font-size="${v >= 1000 ? 20 : v >= 100 ? 24 : 28}" font-weight="700" text-anchor="middle" fill="${light > 70 ? '#12332b' : '#ffffff'}">${v}</text>`;
        }),
      );
      svg = frame('#0d3a30', tiles);
      break;
    }
    case 'memory-match': {
      const faces: Record<number, string> = {
        1: '<circle cx="0" cy="0" r="16" fill="#f59e0b"/>',
        4: '<path d="M0 -20l6 13 14 1-11 9 3 14-12-7-12 7 3-14-11-9 14-1z" fill="#eab308"/>',
        6: '<circle cx="0" cy="0" r="16" fill="#f59e0b"/>',
        9: '<path d="M0 -20 20 0 0 20 -20 0z" fill="#14b8a6"/>',
      };
      let cards = '';
      for (let i = 0; i < 12; i++) {
        const x = 40 + (i % 4) * 98;
        const y = 14 + Math.floor(i / 4) * 94;
        const face = faces[i];
        cards += face
          ? `<rect x="${x}" y="${y}" width="86" height="84" rx="10" fill="#fffdf8" stroke="${i === 1 || i === 6 ? '#22c55e' : '#e0d6c1'}" stroke-width="3"/><g transform="translate(${x + 43} ${y + 42})">${face}</g>`
          : `<rect x="${x}" y="${y}" width="86" height="84" rx="10" fill="#0f766e"/><rect x="${x + 6}" y="${y + 6}" width="74" height="72" rx="7" fill="none" stroke="#ffffff" stroke-opacity=".3" stroke-width="2"/><circle cx="${x + 43}" cy="${y + 42}" r="9" fill="#ffffff" fill-opacity=".25"/>`;
      }
      svg = frame('#123f33', cards);
      break;
    }
    case 'nonogram': {
      const n = picture.length || 10;
      const cell = 23;
      const x0 = 200;
      const y0 = 50;
      let out = `<rect x="${x0}" y="${y0}" width="${n * cell}" height="${n * cell}" fill="#fffdf8"/>`;
      picture.forEach((row, r) =>
        row.forEach((v, c) => {
          if (v) out += `<rect x="${x0 + c * cell}" y="${y0 + r * cell}" width="${cell}" height="${cell}" fill="#134e4a"/>`;
        }),
      );
      for (let i = 0; i <= n; i++) {
        const w = i % 5 === 0 ? 2.5 : 1;
        out += `<path d="M${x0 + i * cell} ${y0}V${y0 + n * cell}M${x0} ${y0 + i * cell}H${x0 + n * cell}" stroke="${i % 5 === 0 ? '#1b2823' : '#cdbf9f'}" stroke-width="${w}"/>`;
      }
      const runs = (line: readonly boolean[]) => {
        const o: number[] = [];
        let k = 0;
        for (const v of line) {
          if (v) k++;
          else if (k) {
            o.push(k);
            k = 0;
          }
        }
        if (k) o.push(k);
        return o.length ? o : [0];
      };
      picture.forEach((row, r) => {
        out += `<text x="${x0 - 8}" y="${y0 + r * cell + 17}" font-size="15" font-weight="700" text-anchor="end" fill="#f5ecd2">${runs(row).join(' ')}</text>`;
      });
      picture[0]?.forEach((_, c) => {
        const clue = runs(picture.map((row) => row[c]!));
        clue.forEach((v, i) => {
          out += `<text x="${x0 + c * cell + cell / 2}" y="${y0 - 8 - (clue.length - 1 - i) * 15}" font-size="13" font-weight="700" text-anchor="middle" fill="#f5ecd2">${v}</text>`;
        });
      });
      svg = frame('#123f33', out);
      break;
    }
    case 'chess': {
      const sq = 36;
      const x0 = 86;
      let out = '';
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) out += `<rect x="${x0 + c * sq}" y="${6 + r * sq}" width="${sq}" height="${sq}" fill="${(r + c) % 2 ? '#9a6b46' : '#eedcb4'}"/>`;
      const pieces: [number, number, number, boolean][] = [
        [6, 0, 4, false], [5, 0, 3, false], [4, 0, 7, false], [1, 1, 5, false], [1, 2, 4, false], [2, 2, 2, false],
        [6, 7, 6, true], [5, 4, 3, true], [2, 5, 5, true], [1, 6, 3, true], [1, 6, 4, true], [4, 7, 0, true],
      ];
      for (const [t, r, c, white] of pieces)
        out += `<g transform="translate(${x0 + c * sq + 2} ${6 + r * sq + 2}) scale(${(sq - 4) / 45})" fill="${white ? '#f8f4ea' : '#2b2b30'}" stroke="${white ? '#3a3a3a' : '#0d0d10'}" stroke-width="1.4" style="--eye:${white ? '#3a3a3a' : '#f8f4ea'}">${PIECE_PATHS[t]!.replace(/var\(--eye\)/g, white ? '#3a3a3a' : '#f8f4ea')}</g>`;
      svg = frame('#123f33', out);
      break;
    }
    case 'checkers': {
      const sq = 36;
      const x0 = 86;
      let out = '';
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
          const dark = (r + c) % 2 === 1;
          out += `<rect x="${x0 + c * sq}" y="${6 + r * sq}" width="${sq}" height="${sq}" fill="${dark ? '#3f6b4f' : '#f1e3c6'}"/>`;
          const piece = dark && (r < 3 ? (r * 8 + c) % 5 !== 0 : r > 4 ? (r * 8 + c) % 4 !== 0 : r === 3 && c === 4);
          if (piece) {
            const red = r > 3;
            out += `<circle cx="${x0 + c * sq + sq / 2}" cy="${6 + r * sq + sq / 2}" r="${sq * 0.38}" fill="${red ? '#dc2626' : '#f5f5f4'}" stroke="rgba(0,0,0,.3)" stroke-width="2"/>`;
          }
        }
      out += `<text x="${x0 + 4 * sq + sq / 2}" y="${6 + 3 * sq + sq / 2 + 7}" font-size="20" text-anchor="middle" fill="#facc15">♛</text>`;
      svg = frame('#123f33', out);
      break;
    }
    case 'dominoes': {
      const pipsAt: Record<number, [number, number][]> = {
        0: [], 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]],
        5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
      };
      const tile = (x: number, y: number, a: number, b: number, vertical = false) => {
        const w = vertical ? 44 : 88;
        const h = vertical ? 88 : 44;
        let t = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#fbf7ec" stroke="#cbd5e1" stroke-width="2"/>`;
        t += vertical ? `<path d="M${x + 6} ${y + 44}H${x + 38}" stroke="#9ca3af" stroke-width="2"/>` : `<path d="M${x + 44} ${y + 6}V${y + 38}" stroke="#9ca3af" stroke-width="2"/>`;
        [a, b].forEach((n, half) => {
          const ox = vertical ? x : x + half * 44;
          const oy = vertical ? y + half * 44 : y;
          for (const [px, py] of pipsAt[n]!) t += `<circle cx="${ox + 10 + px * 12}" cy="${oy + 10 + py * 12}" r="4.2" fill="#1f2937"/>`;
        });
        return t;
      };
      let out = tile(20, 40, 3, 6) + tile(110, 40, 6, 6) + tile(200, 40, 6, 2) + tile(290, 40, 2, 5) + tile(380, 18, 5, 5, true);
      out += tile(60, 190, 4, 1, true) + tile(120, 190, 0, 3, true) + tile(180, 190, 5, 4, true) + tile(240, 190, 2, 2, true) + tile(300, 190, 6, 1, true) + tile(360, 190, 3, 3, true);
      svg = frame('#123f33', out);
      break;
    }
    case 'word-search': {
      const rows = ['TIGERXOAPM', 'KOALAWNUEO', 'BZEBRALRNO', 'IRSOTTERGS', 'SHPANDAICE', 'OCAMELFVUH', 'NLLAMATEIN'];
      let out = '<rect x="40" y="14" width="380" height="272" rx="10" fill="#fffdf8"/>';
      out += `<path d="M64 41H222" stroke="#f59e0b" stroke-width="30" stroke-linecap="round" opacity=".45"/><path d="M102 158H252" stroke="#38bdf8" stroke-width="30" stroke-linecap="round" opacity=".45"/><path d="M64 80L64 236" stroke="#22c55e" stroke-width="30" stroke-linecap="round" opacity=".4"/>`;
      rows.forEach((row, r) => [...row].forEach((ch, c) => (out += `<text x="${64 + c * 38}" y="${50 + r * 39}" font-size="24" font-weight="700" text-anchor="middle" fill="#1b2823">${ch}</text>`)));
      svg = frame('#123f33', out);
      break;
    }
    case 'mini-crossword': {
      const grid = ['##C#B', '#MAIL', 'A#B#A', 'D#I#Z', 'DANCE'];
      const nums: Record<string, number> = { '0,2': 1, '0,4': 2, '1,1': 3, '2,0': 4, '4,0': 5 };
      const sq = 54;
      const x0 = 95;
      let out = `<rect x="${x0 - 4}" y="8" width="${sq * 5 + 8}" height="${sq * 5 + 8}" rx="6" fill="#1b2823"/>`;
      grid.forEach((row, r) =>
        [...row].forEach((ch, c) => {
          if (ch === '#') return;
          const x = x0 + c * sq;
          const y = 12 + r * sq;
          out += `<rect x="${x + 1}" y="${y + 1}" width="${sq - 2}" height="${sq - 2}" fill="${r === 1 ? '#cfe8f7' : '#fffdf8'}"/>`;
          if (nums[`${r},${c}`]) out += `<text x="${x + 5}" y="${y + 15}" font-size="12" font-weight="700" fill="#1b2823">${nums[`${r},${c}`]}</text>`;
          if (r !== 3) out += `<text x="${x + sq / 2}" y="${y + 38}" font-size="26" font-weight="700" text-anchor="middle" fill="#1b2823">${ch}</text>`;
        }),
      );
      svg = frame('#123f33', out);
      break;
    }
    case 'bubble-shooter': {
      const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];
      const pattern = ['00112233441', '1122334400', '22334400112', '3344001122', '44001122'];
      let out = '';
      pattern.forEach((row, r) =>
        [...row].forEach((ch, c) => {
          const x = 40 + c * 34 + (r % 2 ? 17 : 0);
          const y = 30 + r * 29;
          out += `<circle cx="${x}" cy="${y}" r="16" fill="${colors[Number(ch)]}"/><circle cx="${x - 5}" cy="${y - 6}" r="5" fill="#fff" opacity=".55"/>`;
        }),
      );
      for (let i = 1; i < 9; i++) out += `<circle cx="${230 - i * 9}" cy="${260 - i * 16}" r="3" fill="#fff" opacity=".6"/>`;
      out += `<circle cx="230" cy="268" r="22" fill="#1e293b"/><circle cx="230" cy="268" r="16" fill="#3b82f6"/><circle cx="225" cy="262" r="5" fill="#fff" opacity=".55"/>`;
      svg = frame('#0f2a3f', out);
      break;
    }
    case 'hearts':
    case 'spades':
    case 'pyramid': {
      const cardSvg = (x: number, y: number, rank: string, suit: string, red: boolean, rot = 0, w = 74) => {
        const h = w * 1.4;
        return `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="8" fill="#fffdf8" stroke="#bfb6a3" stroke-width="2"/><text x="${-w / 2 + 8}" y="${-h / 2 + 24}" font-size="22" font-weight="700" fill="${red ? '#c2272d' : '#1b2823'}">${rank}</text><text x="${-w / 2 + 9}" y="${-h / 2 + 44}" font-size="18" fill="${red ? '#c2272d' : '#1b2823'}">${suit}</text><text x="${w / 2 - 10}" y="${h / 2 - 10}" font-size="${w * 0.5}" text-anchor="end" fill="${red ? '#c2272d' : '#1b2823'}">${suit}</text></g>`;
      };
      const back = (x: number, y: number, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="-37" y="-52" width="74" height="104" rx="8" fill="#0f5c4a" stroke="#fffdf8" stroke-width="4"/></g>`;
      let out = '';
      if (kind === 'pyramid') {
        const ranks = ['K', '7', '6', 'Q', 'A', '4', '9', '3', '10', 'J', '2', '8', '5', '6', 'K'];
        let k = 0;
        for (let r = 0; r < 5; r++)
          for (let i = 0; i <= r; i++) {
            const red = (r + i) % 2 === 0;
            out += cardSvg(230 + (i - r / 2) * 64, 50 + r * 50, ranks[k++ % ranks.length]!, red ? '♥' : '♠', red, 0, 58);
          }
      } else {
        out += back(80, 150, -8) + back(380, 150, 8) + back(230, 40, 0);
        if (kind === 'hearts') out += cardSvg(200, 165, 'Q', '♠', false, -10) + cardSvg(262, 172, 'A', '♥', true, 8) + cardSvg(232, 230, '10', '♥', true, 0);
        else out += cardSvg(200, 165, 'K', '♦', true, -10) + cardSvg(262, 172, '3', '♠', false, 8) + cardSvg(232, 230, 'A', '♦', true, 0);
      }
      svg = frame('#123f33', out);
      break;
    }
    case 'backgammon': {
      let out = '<rect x="20" y="10" width="420" height="280" rx="12" fill="#6b4226"/><rect x="30" y="20" width="400" height="260" fill="#e9d8b4"/><rect x="222" y="20" width="16" height="260" fill="#4a2c17"/>';
      for (let i = 0; i < 12; i++) {
        const x = 30 + (i < 6 ? i : i + 0.5) * 32;
        const c = i % 2 ? '#9a3412' : '#1f4e46';
        out += `<path d="M${x} 20 L${x + 32} 20 L${x + 16} 135z" fill="${c}"/><path d="M${x} 280 L${x + 32} 280 L${x + 16} 165z" fill="${i % 2 ? '#1f4e46' : '#9a3412'}"/>`;
      }
      const chk = (x: number, y: number, w: boolean) => `<circle cx="${x}" cy="${y}" r="13" fill="${w ? '#f5f5f4' : '#1f2937'}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>`;
      for (let k = 0; k < 5; k++) out += chk(46, 36 + k * 26, true) + chk(46 + 12.5 * 32, 264 - k * 26, false);
      for (let k = 0; k < 3; k++) out += chk(46 + 4 * 32, 264 - k * 26, true) + chk(46 + 7.5 * 32 + 16, 36 + k * 26, false);
      out += `<rect x="290" y="132" width="32" height="32" rx="6" fill="#fffdf8"/><circle cx="298" cy="140" r="3.5" fill="#1f2937"/><circle cx="314" cy="156" r="3.5" fill="#1f2937"/><rect x="332" y="132" width="32" height="32" rx="6" fill="#fffdf8"/><circle cx="340" cy="140" r="3.5" fill="#1f2937"/><circle cx="348" cy="148" r="3.5" fill="#1f2937"/><circle cx="356" cy="156" r="3.5" fill="#1f2937"/>`;
      svg = frame('#123f33', out);
      break;
    }
    case 'tic-tac-toe': {
      let out = '<path d="M180 30V270M280 30V270M130 80H330M130 180H330" stroke="#f5ecd2" stroke-width="8" stroke-linecap="round"/>';
      const x = (cx: number, cy: number) => `<path d="M${cx - 26} ${cy - 26}L${cx + 26} ${cy + 26}M${cx + 26} ${cy - 26}L${cx - 26} ${cy + 26}" stroke="#fda4af" stroke-width="12" stroke-linecap="round"/>`;
      const o = (cx: number, cy: number) => `<circle cx="${cx}" cy="${cy}" r="28" fill="none" stroke="#fde68a" stroke-width="11"/>`;
      out += x(155, 55) + o(230, 55) + x(230, 130) + o(305, 130) + x(305, 230) + o(155, 230);
      out += '<path d="M135 35L325 250" stroke="#86efac" stroke-width="7" stroke-linecap="round" opacity=".9"/>';
      svg = frame('#123f33', out);
      break;
    }
    case 'word-builder': {
      const letters = ['P', 'L', 'A', 'N', 'E', 'T', 'S'];
      let out = '<circle cx="230" cy="160" r="120" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.2)" stroke-width="3"/>';
      letters.forEach((l, i) => {
        const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
        const x = 230 + Math.cos(a) * 82;
        const y = 160 + Math.sin(a) * 82;
        out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="30" fill="${i < 4 ? '#facc15' : '#fffdf8'}"/><text x="${x.toFixed(1)}" y="${(y + 11).toFixed(1)}" font-size="30" font-weight="700" text-anchor="middle" fill="#1b2823">${l}</text>`;
      });
      out += '<text x="230" y="40" font-size="30" font-weight="700" text-anchor="middle" fill="#fffdf8" letter-spacing="6">PLAN</text>';
      svg = frame('#123f33', out);
      break;
    }
    case 'four-in-a-row': {
      const board = ['.......', '.......', '....1..', '...12..', '.2121..', '21122..'];
      let holes = '';
      board.forEach((row, r) =>
        [...row].forEach((ch, c) => {
          const fill = ch === '1' ? '#e11d48' : ch === '2' ? '#f59e0b' : '#0b1a3a';
          holes += `<circle cx="${82 + c * 50}" cy="${32 + r * 46}" r="19" fill="${fill}"/>`;
        }),
      );
      svg = frame('#123f33', `<rect x="52" y="8" width="356" height="284" rx="16" fill="#1d4ed8"/>${holes}<path d="M132 262 L282 124" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".85"/>`);
      break;
    }
  }
  return { svg, width: 540, height: 300 };
}

/** 1200x630 social card: title on the left, artwork on the right. */
export function ogCardSvg(opts: { title: string; subtitle: string; art: OgArt }): string {
  const titleLines = wrap(opts.title, 16).slice(0, 3);
  const titleSvg = titleLines
    .map((l, i) => `<text x="72" y="${200 + i * 84}" font-size="76" font-weight="700" fill="#ffffff">${esc(l)}</text>`)
    .join('');
  const subY = 200 + titleLines.length * 84 + 20;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="felt" cx="0.6" cy="0.35" r="0.9"><stop offset="0" stop-color="#2b7a62"/><stop offset="1" stop-color="#123f33"/></radialGradient></defs>
  <rect width="1200" height="630" fill="url(#felt)"/>
  ${titleSvg}
  <text x="72" y="${subY}" font-size="34" fill="#d7efe6">${esc(opts.subtitle)}</text>
  <text x="72" y="566" font-size="30" font-weight="700" fill="#f5d37a">${esc(SITE.name)}</text>
  <g transform="translate(620 ${Math.round((630 - opts.art.height) / 2)})">${opts.art.svg}</g>
</svg>`;
}

/** App icon: the Free Play Classic mark (a play tile on a green badge). No text, so no font needed. */
export function iconSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="#0f5c4a"/>
  <rect x="15" y="12" width="36" height="44" rx="7" fill="#0b4738"/>
  <rect x="13" y="9" width="36" height="44" rx="7" fill="#fbf6e9"/>
  <path d="M26 21.5v19.5c0 1.6 1.7 2.5 3 1.7l15.4-9.7c1.3-.8 1.3-2.6 0-3.4L29 19.8c-1.3-.8-3 .1-3 1.7z" fill="#f59e0b"/>
</svg>`;
}
