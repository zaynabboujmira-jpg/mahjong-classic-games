import { SITE } from '../../data/site';

/**
 * Typed JSON-LD builders. Every page emits one @graph so entities can
 * reference each other by @id (the game's publisher is the Organization, the
 * WebPage is part of the WebSite, and so on).
 */
export type JsonLd = Record<string, unknown>;

const id = (base: string, frag: string) => `${base}#${frag}`;

export function organization(origin: string): JsonLd {
  return {
    '@type': 'Organization',
    '@id': id(origin, 'organization'),
    name: SITE.name,
    url: origin,
    logo: `${origin}icon-512.png`,
    ...(SITE.sameAs.length ? { sameAs: SITE.sameAs } : {}),
  };
}

export function website(origin: string): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': id(origin, 'website'),
    name: SITE.name,
    url: origin,
    inLanguage: SITE.lang,
    publisher: { '@id': id(origin, 'organization') },
  };
}

export function webPage(origin: string, url: string, name: string, description: string): JsonLd {
  return {
    '@type': 'WebPage',
    '@id': id(url, 'webpage'),
    url,
    name,
    description,
    inLanguage: SITE.lang,
    isPartOf: { '@id': id(origin, 'website') },
  };
}

export function breadcrumbs(url: string, items: readonly { name: string; url: string }[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    '@id': id(url, 'breadcrumbs'),
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface GameInfo {
  url: string;
  name: string;
  description: string;
  image: string;
  /** e.g. ["Puzzle", "Tile-matching"] */
  genre: readonly string[];
  keywords?: readonly string[];
}

/**
 * The playable game as both VideoGame (schema.org's Game subtype) and
 * SoftwareApplication, which is what Google's software rich results read.
 */
export function videoGame(origin: string, g: GameInfo): JsonLd {
  return {
    '@type': ['VideoGame', 'SoftwareApplication'],
    '@id': id(g.url, 'game'),
    name: g.name,
    url: g.url,
    description: g.description,
    image: g.image,
    genre: g.genre,
    ...(g.keywords?.length ? { keywords: g.keywords.join(', ') } : {}),
    inLanguage: SITE.lang,
    gamePlatform: 'Web browser',
    playMode: 'SinglePlayer',
    numberOfPlayers: { '@type': 'QuantitativeValue', value: 1 },
    applicationCategory: 'GameApplication',
    applicationSubCategory: 'Puzzle game',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires JavaScript and HTML5 Canvas.',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    publisher: { '@id': id(origin, 'organization') },
    mainEntityOfPage: { '@id': id(g.url, 'webpage') },
  };
}

export function faqPage(url: string, faq: readonly { q: string; a: string }[]): JsonLd {
  return {
    '@type': 'FAQPage',
    '@id': id(url, 'faq'),
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

export function howTo(url: string, name: string, steps: readonly { name: string; text: string }[]): JsonLd {
  return {
    '@type': 'HowTo',
    '@id': id(url, 'howto'),
    name,
    totalTime: 'PT1M',
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
      url: `${url}#how-to-play`,
    })),
  };
}

export function graph(...nodes: (JsonLd | null | undefined | false)[]): JsonLd {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) };
}

/** Serialises JSON-LD for a <script> tag, escaping "<" so content can never close the tag. */
export const serializeJsonLd = (data: JsonLd) => JSON.stringify(data).replace(/</g, '\\u003c');
