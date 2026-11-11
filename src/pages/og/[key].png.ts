import type { APIRoute, GetStaticPaths } from 'astro';
import { getLayout } from '../../engines/mahjong/layouts';
import { layoutPages } from '../../lib/mahjong-pages';
import { ogCardSvg, svgToPng } from '../../lib/og';

/** One 1200x630 OpenGraph PNG per page key, rendered at build time. */
export const getStaticPaths = (async () => {
  const turtle = getLayout('turtle')!.slots;
  const butterfly = getLayout('butterfly')!.slots;
  const pages = await layoutPages();
  return [
    { params: { key: 'home' }, props: { title: 'Free Mahjong Solitaire', subtitle: 'No download · Solvable deals', slots: turtle } },
    { params: { key: 'mahjong' }, props: { title: 'Mahjong Solitaire Layouts', subtitle: `${pages.length} layouts · Play free`, slots: butterfly } },
    ...pages.map((p) => ({
      params: { key: `mahjong-${p.id}` },
      props: {
        title: `${p.name} Mahjong`,
        subtitle: `${p.tiles} tiles · ${p.entry.data.difficulty} · Play free`,
        slots: getLayout(p.id)!.slots,
      },
    })),
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const png = svgToPng(ogCardSvg(props as Parameters<typeof ogCardSvg>[0]), 1200);
  return new Response(png as BodyInit, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
