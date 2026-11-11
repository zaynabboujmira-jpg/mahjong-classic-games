import { getCollection, type CollectionEntry } from 'astro:content';
import { boundsOf } from '../engines/mahjong/board';
import { getLayout } from '../engines/mahjong/layouts';

export interface LayoutPage {
  entry: CollectionEntry<'layouts'>;
  id: string;
  name: string;
  tiles: number;
  layers: number;
  /** FAQ with {tiles}/{layers} filled in from the engine, so copy never disagrees with the board. */
  faq: { q: string; a: string }[];
  next: { name: string; href: string };
}

const fill = (text: string, tiles: number, layers: number) =>
  text.replaceAll('{tiles}', String(tiles)).replaceAll('{layers}', String(layers));

/** All layout pages in display order, joined with their engine definitions. */
export async function layoutPages(): Promise<LayoutPage[]> {
  const entries = (await getCollection('layouts')).sort((a, b) => a.data.order - b.data.order);
  const pages = entries.map((entry) => {
    const def = getLayout(entry.data.engineId);
    if (!def) throw new Error(`Content file ${entry.id} points at unknown layout ${entry.data.engineId}`);
    const tiles = def.slots.length;
    const layers = boundsOf(def.slots).maxZ + 1;
    return {
      entry,
      id: def.id,
      name: def.name,
      tiles,
      layers,
      faq: entry.data.faq.map(({ q, a }) => ({ q: fill(q, tiles, layers), a: fill(a, tiles, layers) })),
      next: { name: '', href: '' },
    };
  });
  pages.forEach((p, i) => {
    const n = pages[(i + 1) % pages.length]!;
    p.next = { name: n.name, href: `/mahjong/${n.id}/` };
  });
  return pages;
}
