import type { Layout, Slot } from '../types';

/** Row helper: `count` tiles starting at half-unit x, stepping one full tile (2 units). */
export function row(x: number, y: number, z: number, count: number): Slot[] {
  const out: Slot[] = [];
  for (let i = 0; i < count; i++) out.push({ x: x + i * 2, y, z });
  return out;
}

/** Rectangular block of tiles, `cols` x `rows`, top-left at (x, y). */
export function block(x: number, y: number, z: number, cols: number, rows: number): Slot[] {
  const out: Slot[] = [];
  for (let r = 0; r < rows; r++) out.push(...row(x, y + r * 2, z, cols));
  return out;
}

export function defineLayout(slug: string, name: string, slots: Slot[]): Layout {
  if (slots.length % 2 !== 0) throw new Error(`Layout ${slug} has an odd tile count (${slots.length})`);
  if (slots.length > 144) throw new Error(`Layout ${slug} exceeds 144 tiles`);
  const seen = new Set<string>();
  for (const s of slots) {
    const k = `${s.x},${s.y},${s.z}`;
    if (seen.has(k)) throw new Error(`Layout ${slug} has duplicate slot ${k}`);
    seen.add(k);
  }
  const minX = Math.min(...slots.map((s) => s.x));
  const minY = Math.min(...slots.map((s) => s.y));
  const normalized = slots.map((s) => ({ x: s.x - minX, y: s.y - minY, z: s.z }));
  const width = Math.max(...normalized.map((s) => s.x)) + 2;
  const height = Math.max(...normalized.map((s) => s.y)) + 2;
  const layers = Math.max(...normalized.map((s) => s.z)) + 1;
  // Sort for deterministic rendering order: by z, then y, then x.
  normalized.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
  return { slug, name, slots: normalized, width, height, layers };
}
