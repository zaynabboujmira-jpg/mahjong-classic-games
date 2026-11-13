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
    slug: 'mahjong-hong-kong',
    name: 'Hong Kong Mahjong (4 players)',
    status: 'live',
    href: '/mahjong/hong-kong/',
    blurb: 'Classic four-player Mahjong against three bots: Pung, Kong, Chow, flowers and faan scoring.',
  },
  {
    slug: 'mahjong-american',
    name: 'American Mahjong (4 players)',
    status: 'live',
    href: '/mahjong/american/',
    blurb: 'Jokers, the Charleston and a card of hands to build, against three bots.',
  },
  {
    slug: 'mahjong-chinese',
    name: 'Chinese Mahjong (4 players)',
    status: 'live',
    href: '/mahjong/chinese/',
    blurb: 'The simplest four-player rules: no flowers, no minimum. The best table for learning.',
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
  {
    slug: 'word-guess',
    name: 'Word Guess',
    status: 'live',
    href: '/word-guess/',
    blurb: 'Find the hidden word in six tries. A daily word plus unlimited play, with 4, 5 or 6 letters.',
  },
  {
    slug: 'color-memory',
    name: 'Color Memory',
    status: 'live',
    href: '/arcade/color-memory/',
    blurb: 'Watch four pads light up with tones, then repeat the growing sequence. Classic, Strict and Speed modes.',
  },
  {
    slug: 'paddle-ball',
    name: 'Paddle Ball',
    status: 'live',
    href: '/arcade/paddle-ball/',
    blurb: 'The classic paddle and ball game against three computer levels or a friend, with touch controls.',
  },
  {
    slug: 'maze-chomper',
    name: 'Maze Chomper',
    status: 'live',
    href: '/arcade/maze-chomper/',
    blurb: 'Eat every pellet while four Wisps with different hunting styles chase you through the maze.',
  },
  {
    slug: 'alien-invaders',
    name: 'Alien Invaders',
    status: 'live',
    href: '/arcade/alien-invaders/',
    blurb: 'Blast the marching alien fleet from behind crumbling shields, and hit the bonus saucer.',
  },
  {
    slug: 'space-rocks',
    name: 'Space Rocks',
    status: 'live',
    href: '/arcade/space-rocks/',
    blurb: 'Thrust, drift and fire to break drifting rocks into smaller pieces. Vector style.',
  },
  {
    slug: 'river-hopper',
    name: 'River Hopper',
    status: 'live',
    href: '/arcade/river-hopper/',
    blurb: 'Hop across a busy road and a river of logs and turtles to fill five burrows.',
  },
  {
    slug: 'flappy-wing',
    name: 'Flappy Wing',
    status: 'live',
    href: '/arcade/flappy-wing/',
    blurb: 'One tap to flap through the gaps between stone columns. Bronze to Platinum medals.',
  },
  {
    slug: 'ocean-grow',
    name: 'Ocean Grow',
    status: 'live',
    href: '/arcade/ocean-grow/',
    blurb: 'Eat smaller fish to grow and avoid bigger ones in a calm underwater game.',
  },
];
