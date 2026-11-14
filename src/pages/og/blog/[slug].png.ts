import type { APIRoute, GetStaticPaths } from 'astro';
import { allPosts, postGame } from '../../../lib/blog';
import { guideArt, ogCardSvg, svgToPng } from '../../../lib/og';

/** One 1200x630 OpenGraph PNG per strategy guide, rendered at build time. */
export const getStaticPaths = (async () => {
  const posts = await allPosts();
  return posts.map((p) => {
    const game = postGame(p);
    return {
      params: { slug: p.id },
      props: { title: p.data.title, subtitle: `${game.name} ${p.data.category.toLowerCase()} guide`, art: guideArt(game.icon), long: true },
    };
  });
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const png = svgToPng(ogCardSvg(props as Parameters<typeof ogCardSvg>[0]), 1200);
  return new Response(png as BodyInit, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
