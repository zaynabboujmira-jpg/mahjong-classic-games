/** Copy and FAQ for /sudoku/printable/, shared by the page, the sitemap and llms.txt. */
export const PRINTABLE_PATH = '/sudoku/printable/';
export const PRINTABLE_UPDATED = new Date('2026-11-21');

export const PRINTABLE = {
  title: 'Printable Sudoku – Free Puzzles, Easy to Expert',
  h1: 'Printable Sudoku – free puzzles to print, Easy to Expert',
  description:
    'Free printable Sudoku puzzles: choose Easy, Medium, Hard or Expert and print 1 or 4 per page, with an optional answer key. Every puzzle has one solution.',
  summary: 'Free Sudoku sheets to print: four levels, 1 or 4 puzzles per page and an optional answer key.',
  howTo: [
    { name: 'Choose a level', text: 'Pick Easy, Medium, Hard or Expert. New puzzles are made for that level straight away.' },
    { name: 'Choose a layout', text: 'Print 4 puzzles on one page, or 1 large puzzle per page.' },
    { name: 'Add the answers', text: 'Tick Include answer key to add a page with the four solutions.' },
    { name: 'Print', text: 'Press Print and choose your printer, or save the sheets as a PDF. Letter and A4 paper both fit.' },
  ],
  faq: [
    {
      q: 'Are these Sudoku puzzles free to print?',
      a: 'Yes. Every sheet is free to print, as many times as you like. Press New puzzles for a fresh set whenever you need one.',
    },
    {
      q: 'Does every printable Sudoku have one solution?',
      a: 'Yes. The puzzles come from the same generator as the online game: each one is solved by a logic engine before you see it, so it has exactly one solution and never needs a guess.',
    },
    {
      q: 'How do I print 4 Sudoku puzzles on one page?',
      a: 'Choose 4 per page, then press Print. The four grids fit on one sheet of Letter or A4 paper, and the answer key prints on its own page.',
    },
    {
      q: 'Which level should a beginner or a child print?',
      a: 'Easy. Every Easy puzzle can be finished by finding cells with only one possible digit, so it is a gentle way to learn. Move up to Medium when Easy feels quick.',
    },
    {
      q: 'Can I print the answers?',
      a: 'Yes. Tick Include answer key and the solutions to all four puzzles print on a separate page, so you can hand out the puzzles and keep the answers.',
    },
  ],
} as const;
