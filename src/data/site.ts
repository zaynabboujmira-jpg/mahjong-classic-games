export const SITE = {
  name: 'Free Play Classic',
  shortName: 'Free Play Classic',
  /** Production origin; SITE_URL overrides it at build time (see astro.config.mjs). */
  domain: 'freeplayclassic.com',
  tagline: '16 classic browser games: instant play, no ads, on mobile and desktop',
  description:
    'Free Play Classic: 16 classic browser games. Mahjong, solitaire, Sudoku, Minesweeper, word and retro arcade games. Instant play, no ads, no sign-up.',
  lang: 'en',
  locale: 'en_US',
  themeColor: '#0f5c4a',
  /** Social profiles for Organization.sameAs. Fill in when they exist. */
  sameAs: [] as string[],
  /** Twitter/X handle without @, or empty. */
  twitter: '',
} as const;
