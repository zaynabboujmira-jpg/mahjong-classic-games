import { describe, expect, it } from 'vitest';
import { breadcrumbs, faqPage, game, graph } from '@lib/seo/schema';
import { buildTitle } from '@lib/seo/meta';

const site = 'https://example.com/';

describe('schema builders', () => {
  it('emits VideoGame and SoftwareApplication with a free offer', () => {
    const nodes = game(site, {
      name: 'Mahjong Solitaire',
      description: 'desc',
      path: '/games/mahjong-solitaire/',
      genre: 'Tile matching puzzle',
    });
    expect(nodes[0]['@type']).toBe('VideoGame');
    expect(nodes[1]['@type']).toBe('SoftwareApplication');
    expect((nodes[1].offers as { price: string }).price).toBe('0');
    expect(nodes[0].url).toBe('https://example.com/games/mahjong-solitaire/');
  });

  it('breadcrumbs are positioned and absolute', () => {
    const b = breadcrumbs(site, [
      { name: 'Home', path: '/' },
      { name: 'Mahjong', path: '/mahjong/' },
    ]);
    const items = b.itemListElement as { position: number; item: string }[];
    expect(items[1].position).toBe(2);
    expect(items[1].item).toBe('https://example.com/mahjong/');
  });

  it('graph wraps nodes with a schema.org context', () => {
    const g = graph([faqPage([{ q: 'Q?', a: 'A.' }])]);
    expect(g['@context']).toBe('https://schema.org');
    expect(Array.isArray(g['@graph'])).toBe(true);
  });
});

describe('buildTitle', () => {
  it('appends the brand when it fits and drops it when it would overflow', () => {
    expect(buildTitle('Mahjong Solitaire')).toMatch(/\| Mahjong$/);
    const long = 'Play Free Mahjong Solitaire Online With Every Layout You Remember';
    expect(buildTitle(long)).toBe(long);
  });
});
