import { SITE } from '@/data/site';

const TITLE_MAX = 60;
const DESC_MIN = 120;
const DESC_MAX = 158;

/**
 * Builds a page title. The brand suffix is dropped automatically when it would
 * push the title past the SERP truncation limit.
 */
export function buildTitle(title: string, withBrand = true): string {
  const suffix = ` | ${SITE.shortName}`;
  if (!withBrand) return title;
  return title.length + suffix.length <= TITLE_MAX ? title + suffix : title;
}

/** Validates description length in dev so thin or overlong snippets never ship. */
export function buildDescription(desc: string): string {
  const trimmed = desc.trim();
  if (import.meta.env?.DEV) {
    if (trimmed.length < DESC_MIN) console.warn(`[seo] description short (${trimmed.length}): ${trimmed}`);
    if (trimmed.length > DESC_MAX) console.warn(`[seo] description long (${trimmed.length}): ${trimmed}`);
  }
  return trimmed;
}

export function absoluteUrl(path: string, site: URL | string | undefined): string {
  const base = typeof site === 'string' ? site : site?.toString() ?? 'https://example.com';
  return new URL(path, base).toString();
}
