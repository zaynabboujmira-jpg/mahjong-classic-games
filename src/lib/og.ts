import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import type { Slot } from '../engines/mahjong/types';
import { boundsOf } from '../engines/mahjong/board';
import { layoutPreviewSvg } from './layout-preview';
import { SITE } from '../data/site';

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

/** App icon: a stacked tile showing three dots. No text, so no font needed. */
export function iconSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0f5c4a"/>
  <rect x="13" y="13" width="34" height="44" rx="6" fill="#b3a27c"/>
  <rect x="18" y="8" width="34" height="44" rx="6" fill="#fbf6e9"/>
  <circle cx="27" cy="18" r="5" fill="#1d4e89"/><circle cx="35" cy="30" r="5" fill="#c2272d"/><circle cx="43" cy="42" r="5" fill="#167a3e"/>
</svg>`;
}
