/**
 * Single source of truth for every game on the platform.
 * Routes, navigation, sitemap entries, JSON-LD and OpenGraph are all derived from here.
 */

export type GameStatus = 'live' | 'planned';

export interface GameEntry {
  slug: string;
  name: string;
  shortName: string;
  /** Canonical path, always with trailing slash. */
  path: string;
  status: GameStatus;
  genre: string;
  tagline: string;
  /** Primary search phrases this page targets (used in copy, not meta keywords). */
  keywords: string[];
  /** Which engine module powers the page. */
  engine: 'mahjong' | 'solitaire' | 'sudoku' | 'minesweeper';
  icon: string;
}

export const GAMES: GameEntry[] = [
  {
    slug: 'mahjong-solitaire',
    name: 'Mahjong Solitaire',
    shortName: 'Mahjong',
    path: '/games/mahjong-solitaire/',
    status: 'live',
    genre: 'Tile matching puzzle',
    tagline: 'Match free pairs and clear the board. 144 tiles, dozens of layouts, no download.',
    keywords: ['mahjong', 'mahjong solitaire', 'free mahjong', 'mahjong games'],
    engine: 'mahjong',
    icon: '中',
  },
  {
    slug: 'klondike-solitaire',
    name: 'Klondike Solitaire',
    shortName: 'Solitaire',
    path: '/games/klondike-solitaire/',
    status: 'planned',
    genre: 'Card game',
    tagline: 'The classic solitaire. Draw 1 or draw 3, timed or relaxed.',
    keywords: ['solitaire', 'klondike solitaire', 'solitaire free'],
    engine: 'solitaire',
    icon: '♠',
  },
  {
    slug: 'spider-solitaire',
    name: 'Spider Solitaire',
    shortName: 'Spider',
    path: '/games/spider-solitaire/',
    status: 'planned',
    genre: 'Card game',
    tagline: 'One, two or four suits. Build runs from king to ace.',
    keywords: ['spider solitaire', 'spider solitaire 2 suits'],
    engine: 'solitaire',
    icon: '♣',
  },
  {
    slug: 'freecell',
    name: 'FreeCell',
    shortName: 'FreeCell',
    path: '/games/freecell/',
    status: 'planned',
    genre: 'Card game',
    tagline: 'Every deal is solvable. Numbered deals included.',
    keywords: ['freecell', 'freecell solitaire'],
    engine: 'solitaire',
    icon: '♦',
  },
  {
    slug: 'sudoku',
    name: 'Sudoku',
    shortName: 'Sudoku',
    path: '/games/sudoku/',
    status: 'planned',
    genre: 'Logic puzzle',
    tagline: 'Easy to expert, with a new daily puzzle.',
    keywords: ['sudoku', 'sudoku easy', 'sudoku hard'],
    engine: 'sudoku',
    icon: '▦',
  },
  {
    slug: 'minesweeper',
    name: 'Minesweeper',
    shortName: 'Minesweeper',
    path: '/games/minesweeper/',
    status: 'planned',
    genre: 'Logic puzzle',
    tagline: 'Beginner, intermediate and expert boards.',
    keywords: ['minesweeper', 'minesweeper online'],
    engine: 'minesweeper',
    icon: '✸',
  },
];

export const liveGames = () => GAMES.filter((g) => g.status === 'live');
export const plannedGames = () => GAMES.filter((g) => g.status === 'planned');
export const getGame = (slug: string) => GAMES.find((g) => g.slug === slug);
