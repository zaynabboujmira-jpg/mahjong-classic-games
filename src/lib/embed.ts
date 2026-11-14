import { SITE } from '../data/site';

const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * The HTML a partner pastes to embed a game: a responsive iframe of the
 * canonical game page (which shows only the game when framed) and a plain
 * credit link back to it.
 */
export function embedCode(name: string, url: string, home: string): string {
  return [
    `<iframe src="${attr(url)}" title="${attr(name)} – ${SITE.name}" width="100%" height="640" style="display:block;max-width:960px;margin:0 auto;border:0;border-radius:8px" loading="lazy" allow="fullscreen" allowfullscreen></iframe>`,
    `<p style="text-align:center;font-size:14px"><a href="${attr(url)}">Play ${attr(name)} free</a> at <a href="${attr(home)}">${SITE.name}</a></p>`,
  ].join('\n');
}
