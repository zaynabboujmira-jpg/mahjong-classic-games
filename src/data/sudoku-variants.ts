import type { Variant } from '../engines/sudoku/variants';

/** Copy, how-to and FAQ for the four variant pages (/sudoku/6x6/, /diagonal/, /jigsaw/, /16x16/). */
export interface VariantCopy {
  variant: Variant;
  path: string;
  name: string;
  title: string;
  h1: string;
  description: string;
  summary: string;
  keywords: string[];
  intro: string;
  tips: string[];
  howTo: { name: string; text: string }[];
  faq: { q: string; a: string }[];
}

export const VARIANTS_UPDATED = new Date('2026-11-21');

const common = {
  saved: { q: 'Is my progress saved?', a: 'Yes. Your grid, notes and time are saved in your browser after every move, separately for Easy and Medium, and your best times appear on your stats page.' },
  unique: (n: string) => ({
    q: `Does every ${n} have one solution?`,
    a: 'Yes. Each puzzle is checked by a solver that uses logic alone, so it has exactly one solution and never needs a guess. Easy can be finished with naked singles; Medium also needs hidden singles.',
  }),
};

export const VARIANT_PAGES: Record<Variant, VariantCopy> = {
  '6x6': {
    variant: '6x6',
    path: '/sudoku/6x6/',
    name: '6×6',
    title: '6×6 Sudoku for Kids – Free Easy Puzzles',
    h1: '6×6 Sudoku – small puzzles for kids and beginners',
    description: 'Play 6×6 Sudoku free online: the digits 1 to 6 in every row, column and 2×3 box. A gentle first Sudoku for kids and beginners, with hints and undo.',
    summary: 'A small Sudoku with the digits 1 to 6 and 2×3 boxes: the easiest way to learn the rules.',
    keywords: ['6x6 sudoku', 'sudoku for kids', 'easy sudoku for kids', 'mini sudoku', '6 by 6 sudoku'],
    intro: 'A 6×6 Sudoku works exactly like the classic puzzle, but with six digits instead of nine and boxes two rows high and three columns wide. It takes a few minutes, so it is a perfect first Sudoku for children and anyone learning the rules.',
    tips: [
      'Count what is missing: each row needs exactly the digits 1 to 6.',
      'Look at one box at a time and ask which digits are still missing.',
      'If a digit is already in two rows of a box pair, the third place is often obvious.',
      'Use Notes to write small candidates when you are not sure yet.',
    ],
    howTo: [
      { name: 'Learn the grid', text: 'The grid has 6 rows, 6 columns and six boxes of 2 by 3 cells. Some digits are already filled in.' },
      { name: 'Fill in 1 to 6', text: 'Every row, every column and every box must contain the digits 1 to 6 exactly once.' },
      { name: 'Tap and choose', text: 'Tap an empty cell, then tap a digit. Tap the same digit again to clear it.' },
      { name: 'Ask for help', text: 'Hint shows the next cell that can be found by logic and explains why. Undo takes back a move.' },
    ],
    faq: [
      { q: 'What age is 6×6 Sudoku for?', a: 'Children from about six or seven can enjoy it once they can recognise the digits 1 to 6. Easy puzzles can be solved by finding cells where only one digit fits, which is a great way to practise logical thinking.' },
      { q: 'How is 6×6 Sudoku different from normal Sudoku?', a: 'Only the size. The rules are the same, but there are six digits, six rows and six columns, and each box is 2 rows by 3 columns instead of 3 by 3.' },
      common.unique('6×6 Sudoku'),
      common.saved,
    ],
  },
  diagonal: {
    variant: 'diagonal',
    path: '/sudoku/diagonal/',
    name: 'Diagonal',
    title: 'Diagonal Sudoku – Free X Sudoku Online',
    h1: 'Diagonal Sudoku – the two long diagonals need 1 to 9 too',
    description: 'Play Diagonal Sudoku (Sudoku X) free online: classic rules plus both long diagonals must hold 1 to 9 once. Easy and Medium, with notes, hints and undo.',
    summary: 'Classic Sudoku plus one extra rule: each of the two long diagonals holds the digits 1 to 9 once.',
    keywords: ['diagonal sudoku', 'sudoku x', 'x sudoku', 'diagonal sudoku online', 'sudoku with diagonals'],
    intro: 'Diagonal Sudoku, also called Sudoku X, adds two extra units to the classic puzzle: the long diagonals from corner to corner. The shaded cells along each diagonal must also contain 1 to 9 exactly once, which gives you more ways to find digits.',
    tips: [
      'Treat each diagonal as a tenth and eleventh "row" when scanning for a digit.',
      'The centre cell is on both diagonals, so it is often the most constrained cell in the grid.',
      'Cells on a diagonal see more peers than ordinary cells, so they often have fewer candidates.',
      'Use Fill notes to see the diagonal rules applied to every candidate.',
    ],
    howTo: [
      { name: 'Follow the classic rules', text: 'Every row, column and 3×3 box must contain the digits 1 to 9 exactly once.' },
      { name: 'Add the diagonals', text: 'The two long diagonals, shown shaded, must each contain 1 to 9 exactly once as well.' },
      { name: 'Enter digits and notes', text: 'Tap a cell and a number. Turn on Notes to write candidates, or press Fill notes to add them all.' },
      { name: 'Use hints when stuck', text: 'Hint finds the next logical step, including steps that use a diagonal.' },
    ],
    faq: [
      { q: 'What is Sudoku X?', a: 'Another name for Diagonal Sudoku. The X is the shape the two long diagonals make across the grid; each must contain 1 to 9 once, on top of the normal rules.' },
      { q: 'Is Diagonal Sudoku harder than classic Sudoku?', a: 'Not necessarily. The extra rule adds constraints, which can make some digits easier to find. Fewer starting clues are needed for a unique solution, so it feels different rather than harder.' },
      common.unique('Diagonal Sudoku'),
      common.saved,
    ],
  },
  jigsaw: {
    variant: 'jigsaw',
    path: '/sudoku/jigsaw/',
    name: 'Jigsaw',
    title: 'Jigsaw Sudoku – Free Irregular Sudoku Online',
    h1: 'Jigsaw Sudoku – irregular regions instead of square boxes',
    description: 'Play Jigsaw Sudoku free online: nine irregular regions replace the 3×3 boxes, a new layout every puzzle. Easy and Medium levels, with notes, hints and undo.',
    summary: 'Sudoku with nine irregular, jigsaw-shaped regions instead of 3×3 boxes, a new layout every puzzle.',
    keywords: ['jigsaw sudoku', 'irregular sudoku', 'jigsaw sudoku online', 'squiggly sudoku', 'free jigsaw sudoku'],
    intro: 'Jigsaw Sudoku keeps the rows and columns of the classic puzzle but replaces the nine 3×3 boxes with nine irregular regions of nine cells, outlined in bold and tinted in different colours. Every puzzle here has its own region layout, so no two grids look the same.',
    tips: [
      'Each tinted region still needs the digits 1 to 9 exactly once.',
      'A region that reaches into a row or column limits where its digits can go there.',
      'Count with the 45 rule: any row adds up to 45, so a region poking into it often gives a quick deduction.',
      'Scan regions, not just rows: their odd shapes hide many hidden singles.',
    ],
    howTo: [
      { name: 'Find the regions', text: 'Bold lines and soft colours mark nine irregular regions of nine cells each.' },
      { name: 'Follow the rules', text: 'Every row, every column and every region must contain the digits 1 to 9 exactly once.' },
      { name: 'Place digits', text: 'Tap a cell and a number. Notes, Fill notes, Undo and Erase work as in classic Sudoku.' },
      { name: 'Ask for a hint', text: 'Hint finds the next logical step and tells you whether it comes from a row, a column or a region.' },
    ],
    faq: [
      { q: 'What is Jigsaw Sudoku?', a: 'A Sudoku where the 3×3 boxes are replaced by irregular shapes of nine cells. The rows and columns work as usual, and each shape must contain 1 to 9 once.' },
      { q: 'Is it the same as Squiggly Sudoku?', a: 'Yes. Jigsaw, Squiggly, Irregular and Geometry Sudoku are all names for the same idea: irregular regions instead of square boxes.' },
      common.unique('Jigsaw Sudoku'),
      common.saved,
    ],
  },
  '16x16': {
    variant: '16x16',
    path: '/sudoku/16x16/',
    name: '16×16',
    title: '16×16 Sudoku – Free Giant Sudoku Online',
    h1: '16×16 Sudoku – a giant grid with the numbers 1 to 16',
    description: 'Play 16×16 Sudoku free online: the numbers 1 to 16 in every row, column and 4×4 box. Easy and Medium giant puzzles with notes, hints, undo and autosave.',
    summary: 'A giant Sudoku with the numbers 1 to 16 in every row, column and 4×4 box.',
    keywords: ['16x16 sudoku', 'sudoku 16x16', 'giant sudoku', '16 by 16 sudoku', 'large sudoku online'],
    intro: 'A 16×16 Sudoku has 256 cells, sixteen numbers and sixteen 4×4 boxes. The rules are the same as classic Sudoku, but the grid is big enough to make a long, absorbing solve, best enjoyed on a computer, a tablet or in full screen.',
    tips: [
      'Work number by number: pick a number and find every box where it is still missing.',
      'Boxes with many clues are the best place to start.',
      'Fill notes is your friend on a grid this size: it lists every candidate for you.',
      'On the keyboard, type 1 then 0 to 6 quickly to enter 10 to 16.',
    ],
    howTo: [
      { name: 'Know the grid', text: 'The grid has 16 rows, 16 columns and sixteen 4×4 boxes, with the numbers 1 to 16.' },
      { name: 'Fill in 1 to 16', text: 'Every row, column and box must contain each number from 1 to 16 exactly once.' },
      { name: 'Enter numbers', text: 'Tap a cell and a number on the pad. On a keyboard, type 1 then a second digit quickly for 10 to 16.' },
      { name: 'Use notes and hints', text: 'Turn on Notes or press Fill notes for candidates. Hint explains the next logical step.' },
    ],
    faq: [
      { q: 'How long does a 16×16 Sudoku take?', a: 'About as long as three or four classic Sudokus: typically 30 to 60 minutes on Easy and longer on Medium. Your progress is saved, so you can stop and come back.' },
      { q: 'Why numbers 1 to 16 and not letters?', a: 'Some puzzles use 0 to 9 and A to F, but the numbers 1 to 16 are easier to read for most players and work the same way. On the pad each number has its own button.' },
      common.unique('16×16 Sudoku'),
      common.saved,
    ],
  },
};
