/**
 * Typed JSON-LD builders. Every route composes its graph from these so the
 * structured data stays consistent and unit-testable.
 */
import { SITE } from '@/data/site';

type JsonLd = Record<string, unknown>;

export interface Crumb {
  name: string;
  path: string;
}

export function organization(siteUrl: string): JsonLd {
  return {
    '@type': 'Organization',
    '@id': `${siteUrl}#organization`,
    name: SITE.name,
    url: siteUrl,
    logo: { '@type': 'ImageObject', url: new URL('/favicon.svg', siteUrl).toString() },
    ...(SITE.sameAs.length ? { sameAs: SITE.sameAs } : {}),
  };
}

export function website(siteUrl: string): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': `${siteUrl}#website`,
    name: SITE.name,
    url: siteUrl,
    inLanguage: SITE.lang,
    publisher: { '@id': `${siteUrl}#organization` },
  };
}

export function breadcrumbs(siteUrl: string, crumbs: Crumb[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: new URL(c.path, siteUrl).toString(),
    })),
  };
}

export interface GameSchemaInput {
  name: string;
  description: string;
  path: string;
  genre: string;
  image?: string;
  /** e.g. "Turtle layout, 144 tiles" */
  gameplayVariant?: string;
  datePublished?: string;
  dateModified?: string;
}

/**
 * Google reads `VideoGame` (a subtype of schema.org Game) for game rich results,
 * and `SoftwareApplication` for the free web-app signal. Emitting both is the
 * accepted pattern for browser games.
 */
export function game(siteUrl: string, input: GameSchemaInput): JsonLd[] {
  const url = new URL(input.path, siteUrl).toString();
  const common = {
    name: input.name,
    description: input.description,
    url,
    inLanguage: SITE.lang,
    isAccessibleForFree: true,
    publisher: { '@id': `${siteUrl}#organization` },
    ...(input.image ? { image: new URL(input.image, siteUrl).toString() } : {}),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
  };
  return [
    {
      '@type': 'VideoGame',
      '@id': `${url}#game`,
      ...common,
      genre: input.genre,
      gamePlatform: 'Web browser',
      playMode: 'SinglePlayer',
      numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 1 },
      applicationCategory: 'GameApplication',
      operatingSystem: 'Any',
      ...(input.gameplayVariant ? { gameEdition: input.gameplayVariant } : {}),
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${url}#app`,
      ...common,
      applicationCategory: 'GameApplication',
      applicationSubCategory: input.genre,
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript and HTML5 Canvas',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
  ];
}

export interface FaqItem {
  q: string;
  a: string;
}

export function faqPage(items: FaqItem[]): JsonLd {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
}

export function howTo(name: string, steps: string[]): JsonLd {
  return {
    '@type': 'HowTo',
    name,
    step: steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
  };
}

/** Wraps nodes into a single @graph document. */
export function graph(nodes: JsonLd[]): JsonLd {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
