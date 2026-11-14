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

/** A page; hubs that list games use 'CollectionPage' (pass mainEntity to point at their ItemList). */
export function webPage(origin: string, url: string, name: string, description: string, type: 'WebPage' | 'CollectionPage' = 'WebPage', mainEntity?: string): JsonLd {
  return {
    '@type': type,
    ...(mainEntity ? { mainEntity: { '@id': mainEntity } } : {}),
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

/** An ordered list of game pages (homepage and hubs). */
export function itemList(url: string, name: string, items: readonly { name: string; url: string; description?: string }[], frag = 'games'): JsonLd {
  return {
    '@type': 'ItemList',
    '@id': id(url, frag),
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: it.url,
      name: it.name,
      ...(it.description ? { description: it.description } : {}),
    })),
  };
}

export interface PostInfo {
  url: string;
  headline: string;
  description: string;
  image: string;
  datePublished: Date;
  dateModified: Date;
  section: string;
  keywords: readonly string[];
  wordCount: number;
  /** The game the article is about. */
  about: { name: string; url: string };
}

/** A strategy or rules article, published by the Organization. */
export function blogPosting(origin: string, p: PostInfo): JsonLd {
  return {
    '@type': 'BlogPosting',
    '@id': id(p.url, 'article'),
    headline: p.headline,
    description: p.description,
    image: p.image,
    url: p.url,
    datePublished: p.datePublished.toISOString().slice(0, 10),
    dateModified: p.dateModified.toISOString().slice(0, 10),
    articleSection: p.section,
    keywords: p.keywords.join(', '),
    wordCount: p.wordCount,
    inLanguage: SITE.lang,
    author: { '@id': id(origin, 'organization') },
    publisher: { '@id': id(origin, 'organization') },
    mainEntityOfPage: { '@id': id(p.url, 'webpage') },
    isPartOf: { '@id': id(origin, 'website') },
    about: { '@type': 'VideoGame', name: p.about.name, url: p.about.url },
  };
}

export function graph(...nodes: (JsonLd | null | undefined | false)[]): JsonLd {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) };
}

/** Serialises JSON-LD for a <script> tag, escaping "<" so content can never close the tag. */
export const serializeJsonLd = (data: JsonLd) => JSON.stringify(data).replace(/</g, '\\u003c');
