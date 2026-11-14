import { LEVELS } from '../engines/minesweeper/game';
import { ANSWERS } from '../engines/word/answers';
import { CATALOG } from './catalog';

/**
 * Comparison tables shown under the games (and on hubs). Each one states
 * facts the engines enforce, in a form answer engines can quote directly.
 */
export interface Comparison {
  title: string;
  head: readonly string[];
  rows: readonly { cells: readonly string[]; href?: string }[];
}

export const SUDOKU_COMPARE: Comparison = {
  title: 'Sudoku levels compared',
  head: ['Level', 'Hardest technique needed', 'Typical clues', 'Guessing needed'],
  rows: [
    { cells: ['Easy', 'Naked singles only', 'About 38', 'Never'], href: '/sudoku/easy/' },
    { cells: ['Medium', 'Hidden singles', 'About 30', 'Never'], href: '/sudoku/medium/' },
    { cells: ['Hard', 'Locked candidates, pairs or triples', '24-29', 'Never'], href: '/sudoku/hard/' },
    { cells: ['Expert', 'X-Wing, XY-Wing or Swordfish', '23-30', 'Never'], href: '/sudoku/expert/' },
  ],
};

export const MINESWEEPER_COMPARE: Comparison = {
  title: 'Minesweeper levels compared',
  head: ['Level', 'Board', 'Mines', 'Mine density', 'First click'],
  rows: Object.values(LEVELS).map((l) => ({
    cells: [l.name, `${l.width} × ${l.height}`, String(l.mines), `${Math.round((l.mines / (l.width * l.height)) * 100)}%`, 'Always safe, opens an area'],
    href: `/minesweeper/${l.id}/`,
  })),
};

export const TABLE_MAHJONG_COMPARE: Comparison = {
  title: '4-player Mahjong rule sets compared',
  head: ['Rules', 'Tiles', 'Flowers', 'Jokers', 'Chow', 'To win'],
  rows: [
    { cells: ['Hong Kong', '144', 'Bonus tiles (score faan)', 'No', 'Yes', 'Four sets and a pair worth at least 3 faan'], href: '/mahjong/hong-kong/' },
    { cells: ['Chinese Classic', '136', 'Not used', 'No', 'Yes', 'Any four sets and a pair (no minimum)'], href: '/mahjong/chinese/' },
    { cells: ['American', '152', '8, used in hands', '8', 'No', 'An exact hand from the card; Charleston before play'], href: '/mahjong/american/' },
  ],
};

export const SOLITAIRE_COMPARE: Comparison = {
  title: 'Solitaire games compared',
  head: ['Game', 'Cards', 'Columns', 'Hidden cards', 'Options', 'Mostly'],
  rows: [
    { cells: ['Klondike', '52', '7', 'Yes', 'Draw 1 or Draw 3', 'Skill and luck'], href: '/solitaire/klondike/' },
    { cells: ['Spider', '104 (two decks)', '10', 'Yes', '1, 2 or 4 suits', 'Skill and luck'], href: '/solitaire/spider/' },
    { cells: ['FreeCell', '52', '8 + 4 free cells', 'No, all face up', 'Numbered deals', 'Skill'], href: '/solitaire/freecell/' },
    { cells: ['Pyramid', '52', '7 rows (28 cards) + stock', 'No, but covered', '3 passes or unlimited', 'Luck and planning'], href: '/solitaire/pyramid/' },
  ],
};

/** Accepted-guess counts of public/words/N.txt (a unit test keeps these in sync). */
export const DICTIONARY_SIZES = { 4: 3903, 5: 8636, 6: 15232 } as const;

export const WORD_COMPARE: Comparison = {
  title: 'Word lengths compared',
  head: ['Length', 'Guesses allowed', 'Accepted words', 'Possible answers', 'Daily word'],
  rows: ([4, 5, 6] as const).map((n) => ({
    cells: [`${n} letters`, '6', DICTIONARY_SIZES[n].toLocaleString('en-US'), String(ANSWERS[n].length), 'Yes, plus unlimited'],
    href: n === 5 ? '/word-guess/' : `/word-guess/${n}-letters/`,
  })),
};

export const ARCADE_COMPARE: Comparison = {
  title: 'Arcade games compared',
  head: ['Game', 'Type', 'Modes', 'Controls'],
  rows: CATALOG.filter((g) => g.category === 'arcade').map((g) => ({
    cells: [g.name, g.facts.type, g.facts.modes, g.facts.controls],
    href: g.play,
  })),
};

export const PUZZLE_COMPARE: Comparison = {
  title: 'Puzzle and word games compared',
  head: ['Game', 'Type', 'Modes', 'Controls'],
  rows: CATALOG.filter((g) => g.category === 'puzzles').map((g) => ({
    cells: [g.name, g.facts.type, g.facts.modes, g.facts.controls],
    href: g.play,
  })),
};

export const BOARD_COMPARE: Comparison = {
  title: 'Board games compared',
  head: ['Game', 'Type', 'Modes', 'Controls'],
  rows: CATALOG.filter((g) => g.category === 'board').map((g) => ({
    cells: [g.name, g.facts.type, g.facts.modes, g.facts.controls],
    href: g.play,
  })),
};

export const CARDS_COMPARE: Comparison = {
  title: 'Mahjong and card games compared',
  head: ['Game', 'Type', 'Modes', 'Players'],
  rows: CATALOG.filter((g) => g.category === 'mahjong-cards').map((g) => ({
    cells: [g.name, g.facts.type, g.facts.modes, g.facts.players],
    href: g.play,
  })),
};
