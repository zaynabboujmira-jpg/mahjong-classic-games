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
  {
    slug: 'spider-solitaire',
    name: 'Spider Solitaire',
    status: 'live',
    href: '/solitaire/spider/',
    blurb: 'Build full runs from King to Ace across ten columns, with one, two or four suits.',
  },
  {
    slug: 'freecell',
    name: 'FreeCell',
    status: 'live',
    href: '/solitaire/freecell/',
    blurb: 'Four free cells and every card face up. Play the classic numbered deals.',
  },
  {
    slug: 'sudoku',
    name: 'Sudoku',
    status: 'live',
    href: '/sudoku/',
    blurb: 'Logic number puzzles from Easy to Expert. One solution each, never a guess, with notes and hints.',
  },
  {
    slug: 'minesweeper',
    name: 'Minesweeper',
    status: 'live',
    href: '/minesweeper/',
    blurb: 'Clear the field without opening a mine. Beginner, Intermediate and Expert, with a safe first click.',
  },
];
