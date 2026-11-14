import type { APIRoute, GetStaticPaths } from 'astro';
import { FEATURES } from '../../data/site';
import { getLayout } from '../../engines/mahjong/layouts';
import { layoutPages } from '../../lib/mahjong-pages';
import { Minesweeper, LEVELS, LEVEL_IDS } from '../../engines/minesweeper/game';
import { DIFFICULTIES, generate } from '../../engines/sudoku/generator';
import { score } from '../../engines/word/game';

/** Rows of a real solve, coloured by the game's own scoring. */
const solve = (answer: string, ...guesses: string[]) =>
  [...guesses, answer].map((g) => ({ word: g.toUpperCase(), marks: score(g, answer).map((m) => m[0]).join('') }));
import { generate as nonogram } from '../../engines/puzzles/nonogram';
import { arcadeArt, guideArt, newGameArt, cardFanArt, layoutArt, memoryArt, minesArt, ogCardSvg, paddleArt, sudokuArt, svgToPng, tileHandArt, wordArt, type ArtTile } from '../../lib/og';

const TABLE_ART: Record<'american' | 'hong-kong' | 'chinese', { title: string; subtitle: string; tiles: ArtTile[] }> = {
  american: {
    title: 'American Mahjong',
    subtitle: 'Jokers & Charleston · vs 3 bots',
    tiles: [{ dots: 2 }, { dots: 2 }, 'joker', { dots: 4 }, { bamboo: 6 }, { bamboo: 6 }, 'flower'],
  },
  'hong-kong': {
    title: 'Hong Kong Mahjong',
    subtitle: 'Pung, Kong, Chow · vs 3 bots',
    tiles: [{ bamboo: 1 }, { bamboo: 2 }, { bamboo: 3 }, { dots: 5 }, { dots: 5 }, { dots: 5 }, 'flower'],
  },
  chinese: {
    title: 'Chinese Mahjong',
    subtitle: 'Classic rules · vs 3 bots',
    tiles: [{ dots: 1 }, { dots: 2 }, { dots: 3 }, { bamboo: 7 }, { bamboo: 7 }, { bamboo: 8 }, { dots: 9 }],
  },
};

const SUDOKU_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' } as const;
const SUDOKU_SUBTITLES = {
  easy: 'About 38 clues · Play free',
  medium: 'Hidden singles · Play free',
  hard: 'Pairs & locked candidates',
  expert: 'X-Wing, XY-Wing, Swordfish',
} as const;

/** A real, part-solved 9x9 field: one opening from the centre, with its border mines flagged. */
function minesField() {
  const g = new Minesweeper({ width: 9, height: 9, mines: 10 }, 'og-card');
  g.reveal(40);
  const cells = Array.from({ length: g.size }, (_, i): 'hidden' | 'flag' | number => {
    if (g.state[i] === 1) return g.counts[i]!;
    const bordersOpen = g.neighbors[i]!.some((n) => g.state[n] === 1);
    return g.mines[i] && bordersOpen ? 'flag' : 'hidden';
  });
  return { width: 9, height: 9, cells };
}

/** One 1200x630 OpenGraph PNG per page key, rendered at build time. */
export const getStaticPaths = (async () => {
  const turtle = layoutArt(getLayout('turtle')!.slots);
  const butterfly = layoutArt(getLayout('butterfly')!.slots);
  const pages = await layoutPages();
  return [
    { params: { key: 'home' }, props: { title: 'Free Play Classic', subtitle: `34 classic games · ${FEATURES.ads ? 'Daily challenges' : 'No ads'} · No download`, art: turtle } },
    { params: { key: 'blog' }, props: { title: 'Strategy Guides', subtitle: 'Tactics for classic games · Free', art: guideArt('<path d="M4 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-7a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>') } },
    { params: { key: 'daily' }, props: { title: 'Daily Challenges', subtitle: 'Word · Sudoku · Klondike · Mahjong', art: tileHandArt([{ dots: 1 }, { dots: 2 }, { dots: 3 }, { bamboo: 4 }, { bamboo: 4 }, { bamboo: 4 }, 'flower']) } },
    { params: { key: 'mahjong' }, props: { title: 'Mahjong Solitaire Layouts', subtitle: `${pages.length} layouts · Play free`, art: butterfly } },
    ...pages.map((p) => ({
      params: { key: `mahjong-${p.id}` },
      props: {
        title: `${p.name} Mahjong`,
        subtitle: `${p.tiles} tiles · ${p.entry.data.difficulty} · Play free`,
        art: layoutArt(getLayout(p.id)!.slots),
      },
    })),
    { params: { key: 'solitaire' }, props: { title: 'Free Solitaire Games', subtitle: 'Klondike · Spider · FreeCell', art: cardFanArt() } },
    { params: { key: 'solitaire-klondike' }, props: { title: 'Klondike Solitaire', subtitle: 'Draw 1 or Draw 3 · Play free', art: cardFanArt() } },
    {
      params: { key: 'solitaire-spider' },
      props: { title: 'Spider Solitaire', subtitle: '1, 2 or 4 suits · Play free', art: cardFanArt([['K', 's'], ['Q', 's'], ['J', 's'], ['10', 's'], ['9', 's']]) },
    },
    ...(Object.keys(TABLE_ART) as (keyof typeof TABLE_ART)[]).map((v) => ({
      params: { key: `mahjong-table-${v}` },
      props: { title: TABLE_ART[v].title, subtitle: TABLE_ART[v].subtitle, art: tileHandArt(TABLE_ART[v].tiles) },
    })),
    {
      params: { key: 'mahjong-american-guide' },
      props: {
        title: 'American Mahjong Guide',
        subtitle: '9 hand types · Free printable scorecard',
        art: tileHandArt([{ dots: 3 }, { dots: 6 }, { dots: 9 }, 'joker', { bamboo: 2 }, { bamboo: 4 }, 'flower']),
      },
    },
    {
      params: { key: 'word-4' },
      props: { title: '4-Letter Word Guess', subtitle: 'Daily word · Unlimited play', art: wordArt(solve('name', 'lake', 'cane')) },
    },
    {
      params: { key: 'word-5' },
      props: { title: 'Word Guess', subtitle: 'Daily word · 4, 5 or 6 letters', art: wordArt(solve('grape', 'stare', 'crane')) },
    },
    {
      params: { key: 'word-6' },
      props: { title: '6-Letter Word Guess', subtitle: 'Daily word · Unlimited play', art: wordArt(solve('golden', 'stolen', 'garden')) },
    },
    { params: { key: 'arcade' }, props: { title: 'Free Arcade Games', subtitle: '8 classics · No download', art: arcadeArt('maze-chomper') } },
    { params: { key: 'arcade-color-memory' }, props: { title: 'Color Memory', subtitle: 'Lights & sounds · 3 modes', art: memoryArt() } },
    { params: { key: 'arcade-paddle-ball' }, props: { title: 'Paddle Ball', subtitle: 'vs computer or a friend', art: paddleArt() } },
    { params: { key: 'arcade-maze-chomper' }, props: { title: 'Maze Chomper', subtitle: 'Maze chase · Play free', art: arcadeArt('maze-chomper') } },
    { params: { key: 'arcade-alien-invaders' }, props: { title: 'Alien Invaders', subtitle: 'Retro space shooter · Free', art: arcadeArt('alien-invaders') } },
    { params: { key: 'arcade-space-rocks' }, props: { title: 'Space Rocks', subtitle: 'Vector shooter · Play free', art: arcadeArt('space-rocks') } },
    { params: { key: 'arcade-river-hopper' }, props: { title: 'River Hopper', subtitle: 'Road & river crossing · Free', art: arcadeArt('river-hopper') } },
    { params: { key: 'arcade-flappy-wing' }, props: { title: 'Flappy Wing', subtitle: 'One tap to flap · Medals', art: arcadeArt('flappy-wing') } },
    { params: { key: 'arcade-ocean-grow' }, props: { title: 'Ocean Grow', subtitle: 'Eat & grow · Play free', art: arcadeArt('ocean-grow') } },
    { params: { key: 'arcade-snake' }, props: { title: 'Snake', subtitle: 'Walls or wrap · 3 speeds', art: newGameArt('snake') } },
    { params: { key: 'arcade-brick-breaker' }, props: { title: 'Brick Breaker', subtitle: 'Power-ups · 5 layouts', art: newGameArt('brick-breaker') } },
    { params: { key: 'puzzles' }, props: { title: 'Puzzle & Word Games', subtitle: 'Logic, words, numbers, memory', art: newGameArt('nonogram', nonogram(10, 'og').solution) } },
    { params: { key: 'puzzles-number-merge' }, props: { title: 'Number Merge', subtitle: 'Slide & join to reach 2048', art: newGameArt('number-merge') } },
    { params: { key: 'puzzles-memory-match' }, props: { title: 'Memory Match', subtitle: 'Find every pair · 3 sizes', art: newGameArt('memory-match') } },
    { params: { key: 'puzzles-nonogram' }, props: { title: 'Nonogram', subtitle: 'Picture logic · 5×5 to 15×15', art: newGameArt('nonogram', nonogram(10, 'og').solution) } },
    { params: { key: 'cards' }, props: { title: 'Mahjong & Card Games', subtitle: 'Mahjong · Solitaire · Hearts · Spades', art: newGameArt('hearts') } },
    { params: { key: 'cards-hearts' }, props: { title: 'Hearts', subtitle: '4 players · Shoot the moon', art: newGameArt('hearts') } },
    { params: { key: 'cards-spades' }, props: { title: 'Spades', subtitle: 'Partners · Bids · Nil', art: newGameArt('spades') } },
    { params: { key: 'solitaire-pyramid' }, props: { title: 'Pyramid Solitaire', subtitle: 'Pairs of 13 · Play free', art: newGameArt('pyramid') } },
    { params: { key: 'board-backgammon' }, props: { title: 'Backgammon', subtitle: '3 computer levels or a friend', art: newGameArt('backgammon') } },
    { params: { key: 'board-tic-tac-toe' }, props: { title: 'Tic Tac Toe', subtitle: 'Unbeatable AI · Five in a Row', art: newGameArt('tic-tac-toe') } },
    { params: { key: 'puzzles-word-builder' }, props: { title: 'Word Builder', subtitle: 'Letter wheel · Daily', art: newGameArt('word-builder') } },
    { params: { key: 'board' }, props: { title: 'Board Games', subtitle: 'Chess · Checkers · Dominoes', art: newGameArt('chess') } },
    { params: { key: 'board-four-in-a-row' }, props: { title: 'Four in a Row', subtitle: 'vs computer or a friend', art: newGameArt('four-in-a-row') } },
    { params: { key: 'board-chess' }, props: { title: 'Chess', subtitle: '3 computer levels or a friend', art: newGameArt('chess') } },
    { params: { key: 'board-checkers' }, props: { title: 'Checkers', subtitle: 'Forced jumps · Kings · 3 levels', art: newGameArt('checkers') } },
    { params: { key: 'board-dominoes' }, props: { title: 'Dominoes', subtitle: 'Draw & Block · 2-4 players', art: newGameArt('dominoes') } },
    { params: { key: 'puzzles-word-search' }, props: { title: 'Word Search', subtitle: '10 themes · 3 grid sizes', art: newGameArt('word-search') } },
    { params: { key: 'puzzles-mini-crossword' }, props: { title: 'Mini Crossword', subtitle: 'Daily 5×5 & 7×7 · Unlimited', art: newGameArt('mini-crossword') } },
    { params: { key: 'arcade-bubble-shooter' }, props: { title: 'Bubble Shooter', subtitle: 'Aim · Match 3 · Drop', art: newGameArt('bubble-shooter') } },
    {
      params: { key: 'sudoku' },
      props: { title: 'Free Sudoku', subtitle: 'Easy to Expert · One solution each', art: sudokuArt(generate('medium', 'og').givens) },
    },
    ...DIFFICULTIES.map((d) => ({
      params: { key: `sudoku-${d}` },
      props: { title: `${SUDOKU_NAMES[d]} Sudoku`, subtitle: SUDOKU_SUBTITLES[d], art: sudokuArt(generate(d, 'og').givens) },
    })),
    { params: { key: 'minesweeper' }, props: { title: 'Free Minesweeper', subtitle: 'Safe first click · 3 levels', art: minesArt(minesField()) } },
    ...LEVEL_IDS.map((id) => ({
      params: { key: `minesweeper-${id}` },
      props: {
        title: `Minesweeper ${LEVELS[id].name}`,
        subtitle: `${LEVELS[id].width}×${LEVELS[id].height} · ${LEVELS[id].mines} mines · Play free`,
        art: minesArt(minesField()),
      },
    })),
    {
      params: { key: 'solitaire-freecell' },
      props: { title: 'FreeCell', subtitle: 'Classic numbered deals · Play free', art: cardFanArt([['A', 'c'], ['A', 'd'], ['A', 'h'], ['A', 's'], ['K', 'h']]) },
    },
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const png = svgToPng(ogCardSvg(props as Parameters<typeof ogCardSvg>[0]), 1200);
  return new Response(png as BodyInit, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
