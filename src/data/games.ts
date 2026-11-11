/**
 * Single source of truth for the games catalogue: navigation, the /games/
 * index, sitemaps and llms.txt all read from here. Planned games are listed
 * as "coming soon" but get no page or sitemap entry until they are playable.
 */
export interface GameEntry {
  slug: string;
  name: string;
  status: 'live' | 'planned';
  href?: string;
  blurb: string;
}

export const GAMES: readonly GameEntry[] = [
  {
    slug: 'mahjong-solitaire',
    name: 'Mahjong Solitaire',
    status: 'live',
    href: '/mahjong/',
    blurb: 'Match free pairs of tiles to clear the board. Six layouts from relaxed to tricky.',
  },
  {
    slug: 'klondike-solitaire',
    name: 'Klondike Solitaire',
    status: 'live',
    href: '/solitaire/klondike/',
    blurb: 'The classic card patience. Build the foundations from Ace to King in Draw 1 or Draw 3.',
  },
  { slug: 'spider-solitaire', name: 'Spider Solitaire', status: 'planned', blurb: 'Build suits from King to Ace with one, two or four suits.' },
  { slug: 'freecell', name: 'FreeCell', status: 'planned', blurb: 'Four free cells, every deal winnable with careful play.' },
  { slug: 'sudoku', name: 'Sudoku', status: 'planned', blurb: 'Logic number puzzles from easy to expert.' },
  { slug: 'minesweeper', name: 'Minesweeper', status: 'planned', blurb: 'Clear the field without hitting a mine.' },
];
