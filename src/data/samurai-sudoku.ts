/** Copy, how-to and FAQ for /sudoku/samurai/, shared by the page, the sitemap and llms.txt. */
export const SAMURAI_PATH = '/sudoku/samurai/';
export const SAMURAI_UPDATED = new Date('2026-11-21');

export const SAMURAI = {
  level: 'samurai',
  name: 'Samurai',
  title: 'Samurai Sudoku Online – Free, Easy to Hard',
  h1: 'Samurai Sudoku – five overlapping grids, free online',
  description:
    'Play Samurai Sudoku online free: five overlapping 9×9 grids, Easy, Medium and Hard, with notes, hints, undo and autosave. Every puzzle has one solution.',
  summary: 'Five Sudoku grids in an X: the centre grid shares a corner box with each of the four others.',
  keywords: ['samurai sudoku', 'samurai sudoku online', 'samurai sudoku games', 'free samurai sudoku', 'samurai sudoku easy'],
  howTo: [
    { name: 'Know the layout', text: 'A Samurai Sudoku is five 9×9 grids in an X. The centre grid shares one 3×3 box with each of the four corner grids; the shared boxes are shaded.' },
    { name: 'Follow the normal rules in every grid', text: 'Each grid needs the digits 1 to 9 once in every row, column and box. A digit in a shared box counts for both grids it belongs to.' },
    { name: 'Use the overlaps', text: 'Digits found in one grid fill the shared box of the next. When one grid stalls, work on another and come back through the shared corner.' },
    { name: 'Take notes and hints when you need them', text: 'Tap a cell and a number to place a digit, or turn on notes. Fill notes adds every candidate; Hint shows the next logical step and names the technique.' },
  ],
  faq: [
    {
      q: 'What is Samurai Sudoku?',
      a: 'A puzzle of five overlapping Sudoku grids, arranged like an X. The centre grid shares each of its four corner boxes with another grid, so 369 cells must be filled. Each grid follows the normal Sudoku rules.',
    },
    {
      q: 'How do you solve a Samurai Sudoku?',
      a: 'Solve it like five ordinary Sudokus that help each other. Start with the grid that has the most clues, then carry the digits in each shared box into the next grid. The corner grids often open up the centre, or the other way round.',
    },
    {
      q: 'What is the difference between Easy, Medium and Hard?',
      a: 'Easy can be finished with naked singles alone. Medium needs hidden singles in at least one grid. Hard needs locked candidates, pairs or triples somewhere and starts with fewer clues.',
    },
    {
      q: 'Does every Samurai Sudoku here have one solution?',
      a: 'Yes. Every grid can be solved on its own by logic from its clues, which proves the whole puzzle has exactly one solution. You never need to guess.',
    },
    {
      q: 'How long does a Samurai Sudoku take?',
      a: 'About five ordinary Sudokus: from half an hour on Easy to well over an hour on Hard. Your progress and time are saved after every move, so you can stop and come back.',
    },
    {
      q: 'Is it playable on a phone?',
      a: 'Yes, though the board is large. Use the full screen button for bigger cells. On small screens, notes appear as a dot in the cell and are listed under the board when you select it.',
    },
  ],
} as const;
