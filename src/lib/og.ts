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

/** 1200x630 social card: title on the left, the layout's silhouette on the right. */
export function ogCardSvg(opts: { title: string; subtitle: string; slots: readonly Slot[] }): string {
  const titleLines = wrap(opts.title, 16).slice(0, 3);
  const b = boundsOf(opts.slots);
  const previewW = 540;
  const previewH = (previewW * ((b.h / 2) * 1.22 + (b.maxZ + 1) * 0.14)) / (b.w / 2 + (b.maxZ + 1) * 0.14);
  const preview = layoutPreviewSvg(opts.slots, { tile: 10, width: previewW });
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
  <g transform="translate(620 ${Math.round((630 - previewH) / 2)})">${preview}</g>
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
