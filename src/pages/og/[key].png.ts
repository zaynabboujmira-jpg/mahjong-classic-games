import type { APIRoute, GetStaticPaths } from 'astro';
import { getLayout } from '../../engines/mahjong/layouts';
import { layoutPages } from '../../lib/mahjong-pages';
import { cardFanArt, layoutArt, ogCardSvg, svgToPng } from '../../lib/og';

/** One 1200x630 OpenGraph PNG per page key, rendered at build time. */
export const getStaticPaths = (async () => {
  const turtle = layoutArt(getLayout('turtle')!.slots);
  const butterfly = layoutArt(getLayout('butterfly')!.slots);
  const pages = await layoutPages();
  return [
    { params: { key: 'home' }, props: { title: 'Free Mahjong Solitaire', subtitle: 'No download · Solvable deals', art: turtle } },
    { params: { key: 'mahjong' }, props: { title: 'Mahjong Solitaire Layouts', subtitle: `${pages.length} layouts · Play free`, art: butterfly } },
    ...pages.map((p) => ({
      params: { key: `mahjong-${p.id}` },
      props: {
        title: `${p.name} Mahjong`,
        subtitle: `${p.tiles} tiles · ${p.entry.data.difficulty} · Play free`,
        art: layoutArt(getLayout(p.id)!.slots),
      },
    })),
    { params: { key: 'solitaire' }, props: { title: 'Free Solitaire Games', subtitle: 'Klondike · Draw 1 or Draw 3', art: cardFanArt() } },
    { params: { key: 'solitaire-klondike' }, props: { title: 'Klondike Solitaire', subtitle: 'Draw 1 or Draw 3 · Play free', art: cardFanArt() } },
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const png = svgToPng(ogCardSvg(props as Parameters<typeof ogCardSvg>[0]), 1200);
  return new Response(png as BodyInit, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
