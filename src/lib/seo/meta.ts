import { SITE } from '../../data/site';

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** "Page | Brand" when it fits in 60 characters, otherwise just the page title. */
export function pageTitle(title: string): string {
  const full = `${title} | ${SITE.name}`;
  return full.length <= TITLE_MAX ? full : title;
}

/** Trims a description to 160 characters on a word boundary. */
export function clampDescription(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= DESCRIPTION_MAX) return t;
  const cut = t.slice(0, DESCRIPTION_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** Absolute, self-referencing canonical: no query or hash, always a trailing slash for pages. */
export function canonicalUrl(pathname: string, site: URL | string): string {
  const url = new URL(pathname, site);
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(url.pathname)) url.pathname += '/';
  return url.href;
}

/** OG image path for a page key (rendered at build time by /og/[key].png). */
export const ogImagePath = (key: string) => `/og/${key}.png`;
