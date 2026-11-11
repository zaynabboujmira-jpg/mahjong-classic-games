import type { APIRoute, GetStaticPaths } from 'astro';
import { iconSvg, svgToPng } from '../lib/og';

/** /icon-192.png and /icon-512.png for the web manifest, apple-touch-icon and Organization logo. */
export const getStaticPaths = (() =>
  [192, 512].map((size) => ({ params: { icon: `icon-${size}` }, props: { size } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { size } = props as { size: number };
  return new Response(svgToPng(iconSvg(size), size) as BodyInit, { headers: { 'Content-Type': 'image/png' } });
};
