import { boundsOf } from '../engines/mahjong/board';
import type { Slot } from '../engines/mahjong/types';

/**
 * Server-rendered SVG silhouette of a layout, seen from above, with higher
 * layers drawn lighter and offset. Used for gallery cards (zero JS) and as the
 * artwork inside generated OpenGraph images.
 */
export function layoutPreviewSvg(
  slots: readonly Slot[],
  opts: { width?: number; tile?: number; withXmlns?: boolean; title?: string } = {},
): string {
  const tile = opts.tile ?? 10;
  const b = boundsOf(slots);
  const tw = tile;
  const th = tile * 1.22;
  const d = tile * 0.14;
  const vw = (b.w / 2) * tw + (b.maxZ + 1) * d;
  const vh = (b.h / 2) * th + (b.maxZ + 1) * d;
  const layers = ['#e8dcc0', '#f1e7cf', '#f7efdc', '#fbf6e9', '#fffdf6'];
  const sorted = slots.map((s) => s).sort((a, b2) => a.z - b2.z || b2.x - a.x || a.y - b2.y);
  const rects = sorted
    .map((s) => {
      const x = d + (s.x / 2) * tw + s.z * d;
      const y = b.maxZ * d + (s.y / 2) * th - s.z * d;
      const fill = layers[Math.min(s.z, layers.length - 1)];
      return `<rect x="${(x - d * 0.8).toFixed(1)}" y="${(y + d * 0.8).toFixed(1)}" width="${(tw - 0.6).toFixed(1)}" height="${(th - 0.6).toFixed(1)}" rx="${(tile * 0.12).toFixed(1)}" fill="#a8987a"/><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(tw - 0.6).toFixed(1)}" height="${(th - 0.6).toFixed(1)}" rx="${(tile * 0.12).toFixed(1)}" fill="${fill}" stroke="#8c7b5c" stroke-width="0.5"/>`;
    })
    .join('');
  const ns = opts.withXmlns ? ' xmlns="http://www.w3.org/2000/svg"' : '';
  const size = opts.width ? ` width="${opts.width}" height="${Math.round((opts.width * vh) / vw)}"` : '';
  const title = opts.title ? `<title>${opts.title}</title>` : '';
  return `<svg${ns} viewBox="0 0 ${vw.toFixed(1)} ${vh.toFixed(1)}"${size} role="img"${opts.title ? '' : ' aria-hidden="true"'}>${title}${rects}</svg>`;
}
