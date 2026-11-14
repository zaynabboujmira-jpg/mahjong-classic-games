/**
 * Optional integrations, read from build-time environment variables and
 * validated so a typo can never inject markup. Everything is off unless set;
 * with nothing set the site ships no third-party code at all.
 */
const env = import.meta.env;
const pick = (value: string | undefined, pattern: RegExp) => (value && pattern.test(value.trim()) ? value.trim() : '');

export const CONFIG = {
  gscVerification: pick(env.PUBLIC_GSC_VERIFICATION, /^[\w-]{10,100}$/),
  bingVerification: pick(env.PUBLIC_BING_VERIFICATION, /^[A-Za-z0-9]{10,64}$/),
  ga4Id: pick(env.PUBLIC_GA4_ID, /^G-[A-Z0-9]{4,16}$/),
  adsenseClient: pick(env.PUBLIC_ADSENSE_CLIENT, /^ca-pub-\d{10,20}$/),
  adsenseSlot: pick(env.PUBLIC_ADSENSE_SLOT, /^\d{6,16}$/),
} as const;

/** What the site may promise: "no ads" and "no tracking" only while they are true. */
export const FEATURES = {
  ads: CONFIG.adsenseClient !== '',
  analytics: CONFIG.ga4Id !== '',
  /** A consent banner is needed as soon as either is on. */
  consent: CONFIG.adsenseClient !== '' || CONFIG.ga4Id !== '',
} as const;

/** "free, no ads, no sign-up, no download" (drops "no ads" once ads are on). */
export const FREE_LINE = FEATURES.ads ? 'free, no sign-up, no download' : 'free, no ads, no sign-up, no download';

export const SITE = {
  name: 'Free Play Classic',
  shortName: 'Free Play Classic',
  /** Production origin; SITE_URL overrides it at build time (see astro.config.mjs). */
  domain: 'freeplayclassic.com',
  tagline: `34 classic browser games: instant play${FEATURES.ads ? '' : ', no ads'}, on mobile and desktop`,
  description: `Free Play Classic: 34 classic browser games. Mahjong, solitaire, Hearts, chess, backgammon, Sudoku, word and arcade games. Instant play${FEATURES.ads ? ', daily challenges' : ', no ads'}, no sign-up.`,
  lang: 'en',
  locale: 'en_US',
  themeColor: '#0f5c4a',
  /** Social profiles for Organization.sameAs. Fill in when they exist. */
  sameAs: [] as string[],
  /** Twitter/X handle without @, or empty. */
  twitter: '',
} as const;
