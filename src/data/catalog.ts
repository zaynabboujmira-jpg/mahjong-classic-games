/**
 * The 16 games of Free Play Classic, grouped for the portal. One source for
 * the homepage cards, the Quick Switch bar, the "Quick answer" blocks under
 * each game and the llms.txt / llms-full.txt summaries, so the facts never
 * drift apart. Facts must match what the engines actually do.
 */
export type CategoryId = 'mahjong-cards' | 'puzzles' | 'arcade';

export interface Category {
  id: CategoryId;
  name: string;
  /** Short label for the jump links on phones. */
  short: string;
  blurb: string;
}

export const CATEGORIES: readonly Category[] = [
  { id: 'mahjong-cards', name: 'Mahjong & Card Classics', short: 'Mahjong & Cards', blurb: 'Tile matching, four-player Mahjong against computer opponents, and the three great solitaire games.' },
  { id: 'puzzles', name: 'Brain, Logic & Word Puzzles', short: 'Puzzles', blurb: 'Pure-logic Sudoku, Minesweeper with a safe first click, and a daily word game.' },
  { id: 'arcade', name: 'Retro Arcade', short: 'Arcade', blurb: 'Original takes on the arcade classics: quick to start, with touch controls on phones.' },
];

export interface CatalogGame {
  id: string;
  name: string;
  category: CategoryId;
  /** The page that plays at once. */
  play: string;
  /** Hub or landing page (levels, layouts, rule sets); same as `play` when there is none. */
  hub: string;
  hook: string;
  badges: readonly string[];
  /** Inner SVG markup for a 24 × 24 icon. */
  icon: string;
  facts: {
    type: string;
    goal: string;
    modes: string;
    controls: string;
    players: string;
  };
}

const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

export const CATALOG: readonly CatalogGame[] = [
  {
    id: 'mahjong-solitaire',
    name: 'Mahjong Solitaire',
    category: 'mahjong-cards',
    play: '/mahjong/turtle/',
    hub: '/mahjong/',
    hook: 'Match free pairs of tiles to clear the board. Every deal can be solved.',
    badges: ['6 Layouts', 'Solvable Deals', 'Touch + Keys'],
    icon: `<rect x="5" y="3" width="13" height="17" rx="2" ${S}/><path d="M9 8h5M11.5 8v8M9 12h5" ${S}/>`,
    facts: {
      type: 'Tile-matching solitaire puzzle',
      goal: 'Remove all tiles by matching identical free pairs; a tile is free when nothing covers it and its left or right side is open',
      modes: 'Six layouts: Turtle, Dragon, Pyramid, Fortress, Butterfly and Fish (120-144 tiles); every deal is generated with a solution',
      controls: 'Tap or click two tiles; keyboard arrows and Enter; hint, undo and shuffle buttons',
      players: '1',
    },
  },
  {
    id: 'mahjong-4p',
    name: '4-Player Mahjong',
    category: 'mahjong-cards',
    play: '/mahjong/hong-kong/',
    hub: '/mahjong/hong-kong/',
    hook: 'Sit down with three computer opponents: Pung, Kong, Chow and Mahjong.',
    badges: ['4-Player AI', '3 Rule Sets', 'Hints'],
    icon: `<rect x="2" y="7" width="6" height="9" rx="1.5" ${S}/><rect x="9" y="7" width="6" height="9" rx="1.5" ${S}/><rect x="16" y="7" width="6" height="9" rx="1.5" ${S}/>`,
    facts: {
      type: 'Four-player tile game against three computer opponents',
      goal: 'Complete a winning hand first: four sets and a pair, or a hand from the card in American Mahjong',
      modes: 'Hong Kong (flowers, 3-faan minimum), Chinese Classic (no flowers, no minimum) and American (jokers, Charleston, an original hand card)',
      controls: 'Tap or click tiles to discard; buttons for calls; keyboard arrows and Enter',
      players: '1 player against 3 computer players',
    },
  },
  {
    id: 'klondike',
    name: 'Klondike Solitaire',
    category: 'mahjong-cards',
    play: '/solitaire/klondike/',
    hub: '/solitaire/',
    hook: 'The classic patience game. Build each suit from Ace to King.',
    badges: ['Draw 1 / Draw 3', 'Undo + Hints', 'Touch + Keys'],
    icon: `<rect x="4" y="4" width="11" height="16" rx="2" ${S}/><path d="M15 6l4 1.2-3 12" ${S}/><path d="M9.5 9.5l2 2.5-2 2.5-2-2.5z" fill="currentColor"/>`,
    facts: {
      type: 'Patience (solitaire) card game',
      goal: 'Move all 52 cards to four foundations, one suit each, from Ace to King',
      modes: 'Draw 1 or Draw 3 from the stock, unlimited passes',
      controls: 'Tap a card to auto-move it, drag and drop, or use the keyboard; unlimited undo and hints',
      players: '1',
    },
  },
  {
    id: 'spider',
    name: 'Spider Solitaire',
    category: 'mahjong-cards',
    play: '/solitaire/spider/',
    hub: '/solitaire/',
    hook: 'Build King-to-Ace runs across ten columns with 1, 2 or 4 suits.',
    badges: ['1 / 2 / 4 Suits', 'Hints', 'Touch + Keys'],
    icon: `<circle cx="12" cy="12" r="3" ${S}/><path d="M12 9V4M12 15v5M9 12H3M15 12h6M9.5 9.5 5 5M14.5 9.5 19 5M9.5 14.5 5 19M14.5 14.5 19 19" ${S}/>`,
    facts: {
      type: 'Two-deck patience card game',
      goal: 'Build eight complete runs from King to Ace in one suit; finished runs clear automatically',
      modes: '1, 2 or 4 suits; 104 cards in ten columns with five extra deals',
      controls: 'Tap, drag and drop, or keyboard; unlimited undo and hints',
      players: '1',
    },
  },
  {
    id: 'freecell',
    name: 'FreeCell',
    category: 'mahjong-cards',
    play: '/solitaire/freecell/',
    hub: '/solitaire/',
    hook: 'Every card face up, four free cells, and the classic numbered deals.',
    badges: ['Numbered Deals', 'Solver Hints', 'Touch + Keys'],
    icon: `<rect x="3" y="3" width="8" height="8" rx="1.5" ${S}/><rect x="13" y="3" width="8" height="8" rx="1.5" ${S}/><rect x="3" y="13" width="8" height="8" rx="1.5" ${S}/><rect x="13" y="13" width="8" height="8" rx="1.5" ${S}/>`,
    facts: {
      type: 'Open (all cards visible) patience card game',
      goal: 'Move all 52 cards to the foundations using four free cells and eight columns',
      modes: 'Classic numbered deals, shareable by link; deal #11982 is the famous unsolvable one',
      controls: 'Tap, drag and drop, or keyboard; unlimited undo; hints from a built-in solver',
      players: '1',
    },
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    category: 'puzzles',
    play: '/sudoku/easy/',
    hub: '/sudoku/',
    hook: 'Four levels, one solution each, and never a guess: pure logic.',
    badges: ['4 Levels', 'Notes + Hints', 'One Solution'],
    icon: `<rect x="3" y="3" width="18" height="18" rx="2" ${S}/><path d="M9 3v18M15 3v18M3 9h18M3 15h18" ${S}/>`,
    facts: {
      type: 'Number-placement logic puzzle',
      goal: 'Fill the 9×9 grid so every row, column and 3×3 box holds the digits 1 to 9 once',
      modes: 'Easy, Medium, Hard and Expert, graded by the hardest solving technique needed; every puzzle has exactly one solution',
      controls: 'Tap a cell and a number, or type 1-9; notes mode, auto notes, mistake highlighting, hints, undo',
      players: '1',
    },
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    category: 'puzzles',
    play: '/minesweeper/beginner/',
    hub: '/minesweeper/',
    hook: 'Clear the field without opening a mine. The first click is always safe.',
    badges: ['Safe First Click', '3 Levels', 'Touch + Keys'],
    icon: `<circle cx="12" cy="13" r="5" ${S}/><path d="M12 4v3M12 19v2M4 13h3M17 13h3M6.5 7.5l2 2M15.5 16.5l2 2M17.5 7.5l-2 2M8.5 16.5l-2 2" ${S}/>`,
    facts: {
      type: 'Logic puzzle game',
      goal: 'Open every cell that is not a mine; numbers show how many of the eight neighbours hide a mine',
      modes: 'Beginner 9×9 with 10 mines, Intermediate 16×16 with 40, Expert 30×16 with 99',
      controls: 'Tap or click to open; long-press, right-click or Flag mode to flag; double-tap, double-click or two-finger tap to chord; keyboard',
      players: '1',
    },
  },
  {
    id: 'word-guess',
    name: 'Word Guess',
    category: 'puzzles',
    play: '/word-guess/',
    hub: '/word-guess/',
    hook: 'Find the hidden word in six tries. A daily word, plus unlimited play.',
    badges: ['Daily + Unlimited', '4-6 Letters', 'Streaks'],
    icon: `<rect x="2" y="8" width="6" height="8" rx="1" ${S}/><rect x="9" y="8" width="6" height="8" rx="1" fill="currentColor" opacity=".35" ${S}/><rect x="16" y="8" width="6" height="8" rx="1" ${S}/>`,
    facts: {
      type: 'Word guessing puzzle',
      goal: 'Find the hidden word in six guesses; green = right spot, orange = elsewhere in the word, grey = not in the word',
      modes: 'Daily word (the same for everyone, new at local midnight) and unlimited play; 4, 5 or 6 letters',
      controls: 'On-screen keyboard or your own keyboard; Enter to guess, Backspace to delete',
      players: '1',
    },
  },
  {
    id: 'maze-chomper',
    name: 'Maze Chomper',
    category: 'arcade',
    play: '/arcade/maze-chomper/',
    hub: '/arcade/',
    hook: 'Eat every pellet while four Wisps with different tactics hunt you.',
    badges: ['Swipe + Keys', '4 Smart Hunters', 'Power Orbs'],
    icon: `<path d="M3 3h18v18H3zM7 3v6M3 13h6M13 21v-6M17 7h4M11 7v4h4" ${S}/><circle cx="16" cy="16" r="2" fill="currentColor"/>`,
    facts: {
      type: 'Maze chase arcade game',
      goal: 'Eat every pellet in the maze without being caught; power orbs let you catch the Wisps',
      modes: 'Endless levels that speed up; 3 lives; bonus gems',
      controls: 'Arrow keys or WASD, swipe on the maze, or the on-screen pad',
      players: '1',
    },
  },
  {
    id: 'alien-invaders',
    name: 'Alien Invaders',
    category: 'arcade',
    play: '/arcade/alien-invaders/',
    hub: '/arcade/',
    hook: 'Stop the marching alien fleet from behind four crumbling shields.',
    badges: ['Touch + Keys', 'Endless Waves', 'Bonus Saucer'],
    icon: `<path d="M7 5h10v3h2v5h-2v3h-2v-2H9v2H7v-3H5V8h2z" ${S}/><path d="M9 9h1M14 9h1" ${S}/><path d="M12 19v2" ${S}/>`,
    facts: {
      type: 'Fixed-shooter arcade game',
      goal: 'Shoot every alien in the fleet before it reaches your cannon',
      modes: 'Endless waves that start lower and faster; 3 lives',
      controls: 'Arrow keys or A/D to move, Space to fire; on touch screens hold a finger on the game to move and fire automatically',
      players: '1',
    },
  },
  {
    id: 'space-rocks',
    name: 'Space Rocks',
    category: 'arcade',
    play: '/arcade/space-rocks/',
    hub: '/arcade/',
    hook: 'Thrust, drift and fire to break drifting rocks into ever-smaller pieces.',
    badges: ['Vector Style', 'Hyperspace', 'Touch Buttons'],
    icon: `<path d="M5 9l4-5 7 1 4 6-3 7-8 2-5-5z" ${S}/><path d="M17 3l3 3" ${S}/>`,
    facts: {
      type: 'Vector-style space shooter',
      goal: 'Destroy every rock without being hit; large rocks split into medium and small ones',
      modes: 'Endless waves; 3 lives, an extra life every 10,000 points',
      controls: 'Arrows or WASD to turn and thrust, Space to fire, H for hyperspace; on-screen buttons on touch screens',
      players: '1',
    },
  },
  {
    id: 'river-hopper',
    name: 'River Hopper',
    category: 'arcade',
    play: '/arcade/river-hopper/',
    hub: '/arcade/',
    hook: 'Hop across a busy road and a river of logs and turtles to get home.',
    badges: ['Swipe + Tap', '5 Burrows', 'Faster Levels'],
    icon: `<path d="M2 15c2-2 4 2 6 0s4 2 6 0 4 2 6 0" ${S}/><circle cx="12" cy="8" r="4" ${S}/><circle cx="9.5" cy="4.5" r="1.5" ${S}/><circle cx="14.5" cy="4.5" r="1.5" ${S}/>`,
    facts: {
      type: 'Road and river crossing arcade game',
      goal: 'Fill all five burrows at the top by crossing traffic and riding logs and turtles',
      modes: 'Levels that get faster; 3 lives; 30 seconds per crossing',
      controls: 'Arrow keys or WASD, swipe, tap to hop forward, or the on-screen pad',
      players: '1',
    },
  },
  {
    id: 'flappy-wing',
    name: 'Flappy Wing',
    category: 'arcade',
    play: '/arcade/flappy-wing/',
    hub: '/arcade/',
    hook: 'One tap to flap. Fly through the gaps and earn a Platinum medal.',
    badges: ['One Tap', 'Medals', 'Instant Restart'],
    icon: `<path d="M3 3h4v6H3zM3 16h4v5H3z" ${S}/><circle cx="15" cy="12" r="4" ${S}/><path d="M19 12l3 1-3 1" ${S}/>`,
    facts: {
      type: 'One-button endless flying game',
      goal: 'Fly through as many gaps between stone columns as you can',
      modes: 'Endless; medals at 10 (Bronze), 20 (Silver), 30 (Gold) and 40 (Platinum)',
      controls: 'Tap, click, Space or Up to flap',
      players: '1',
    },
  },
  {
    id: 'ocean-grow',
    name: 'Ocean Grow',
    category: 'arcade',
    play: '/arcade/ocean-grow/',
    hub: '/arcade/',
    hook: 'Eat smaller fish to grow, and keep clear of the big ones.',
    badges: ['Touch Steering', 'Growth Bar', 'Relaxed'],
    icon: `<path d="M3 12c3-5 9-6 13-2l5-3v10l-5-3c-4 4-10 3-13-2z" ${S}/><circle cx="8" cy="11" r="1" fill="currentColor"/>`,
    facts: {
      type: 'Eat-and-grow action game',
      goal: 'Eat fish smaller than you to fill the growth bar; avoid fish outlined in red',
      modes: 'Levels with more predators; 3 lives',
      controls: 'Your fish follows your finger or mouse; arrow keys or WASD also work',
      players: '1',
    },
  },
  {
    id: 'color-memory',
    name: 'Color Memory',
    category: 'arcade',
    play: '/arcade/color-memory/',
    hub: '/arcade/',
    hook: 'Watch the pads light up, then repeat the growing sequence.',
    badges: ['3 Modes', 'Sound + Light', 'Keys 1-4'],
    icon: `<rect x="3" y="3" width="8" height="8" rx="2" fill="#0f9b8e"/><rect x="13" y="3" width="8" height="8" rx="2" fill="#c0264d"/><rect x="3" y="13" width="8" height="8" rx="2" fill="#c77c0a"/><rect x="13" y="13" width="8" height="8" rx="2" fill="#4338ca"/>`,
    facts: {
      type: 'Sequence memory game',
      goal: 'Repeat the sequence of lights and tones; it grows by one every round',
      modes: 'Classic (3 lives), Strict (one mistake ends it) and Speed (strict and faster each round)',
      controls: 'Tap or click the pads, or press 1-4 or the arrow keys',
      players: '1',
    },
  },
  {
    id: 'paddle-ball',
    name: 'Paddle Ball',
    category: 'arcade',
    play: '/arcade/paddle-ball/',
    hub: '/arcade/',
    hook: 'The classic paddle and ball game against the computer or a friend.',
    badges: ['2 Players', '3 AI Levels', 'Touch Drag'],
    icon: `<path d="M4 7v10M20 7v10" ${S}/><circle cx="13" cy="10" r="2" fill="currentColor"/><path d="M12 3v2M12 19v2M12 9v0M12 14v1" ${S}/>`,
    facts: {
      type: 'Paddle and ball arcade game',
      goal: 'Get the ball past your opponent; first to 7 points wins',
      modes: 'Against the computer (Easy, Medium, Unbeatable) or 2 players on one device',
      controls: 'Drag on your half, move the mouse, or W/S and the arrow keys',
      players: '1 against the computer, or 2 on one device',
    },
  },
];

export const gameById = (id: string) => {
  const g = CATALOG.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown catalog game ${id}`);
  return g;
};
