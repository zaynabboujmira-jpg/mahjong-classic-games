/** Copy, how-to and FAQ for /sudoku/killer/, shared by the page, the sitemap and llms.txt. */
export const KILLER_PATH = '/sudoku/killer/';
export const KILLER_UPDATED = new Date('2026-11-21');

export const KILLER = {
  level: 'killer',
  name: 'Killer',
  title: 'Killer Sudoku Online – Free Daily, Easy and Hard',
  h1: 'Killer Sudoku – free online puzzles, Easy and Hard',
  description:
    'Play Killer Sudoku free online: each dashed cage must add up to its sum with no repeats. Easy and Hard levels plus a daily puzzle, with notes, hints and undo.',
  summary: 'Sudoku with cages: each dashed group of cells must add up to its sum, with no digit repeated inside it.',
  keywords: ['killer sudoku', 'killer sudoku online', 'play killer sudoku free', 'killer sudoku easy', 'killer sudoku hard'],
  howTo: [
    { name: 'Follow the Sudoku rules', text: 'Every row, column and 3×3 box must contain the digits 1 to 9 exactly once, as in normal Sudoku.' },
    { name: 'Read the cages', text: 'Each dashed outline is a cage. The small number in its corner is the total its digits must add up to, and no digit may repeat inside a cage.' },
    { name: 'Start with small and large cages', text: 'A cage of two cells adding up to 3 can only hold 1 and 2; a cage of two adding up to 17 can only hold 8 and 9. Fill those in first.' },
    { name: 'Use notes and the 45 rule', text: 'Every row, column and box adds up to 45. Add up the cages inside a box to work out a cell that sticks out. Fill notes takes the cage sums into account.' },
  ],
  faq: [
    {
      q: 'What is Killer Sudoku?',
      a: 'A Sudoku variant with few or no starting digits. Instead, the grid is divided into cages, groups of cells with a dashed outline and a sum. You follow the normal Sudoku rules, and the digits in each cage must add up to its sum without repeating.',
    },
    {
      q: 'Can a number repeat in a Killer Sudoku cage?',
      a: 'No. The digits in a cage are always different, even when the cage crosses two boxes. The game marks a repeated digit in red, and a full cage whose digits do not add up to its sum.',
    },
    {
      q: 'What is the 45 rule in Killer Sudoku?',
      a: 'The digits 1 to 9 add up to 45, so every row, column and box totals 45. If the cages that lie entirely inside a box add up to 38, the remaining cells of that box must add up to 7. It is the most useful Killer Sudoku technique.',
    },
    {
      q: 'What is the difference between Easy and Hard?',
      a: 'Easy uses small cages of two or three cells and starts with about a dozen digits filled in. Hard uses larger cages of up to five cells and only a few starting digits, so you rely on cage sums and the 45 rule.',
    },
    {
      q: 'Does every Killer Sudoku here have one solution?',
      a: 'Yes. A solver checks every puzzle before you see it. If a cage layout would allow two answers, the game reveals a starting digit until only one answer remains.',
    },
    {
      q: 'Is there a daily Killer Sudoku?',
      a: 'Yes. Every day there is a new Hard Killer Sudoku, the same puzzle for everyone. Open it from the daily challenges page; solving it counts towards your daily streak, and you can share a spoiler-free summary of your day.',
    },
    {
      q: 'Is my progress saved?',
      a: 'Yes. Your grid, notes and time are saved in your browser after every move, separately for Easy and Hard, so you can come back to the same puzzle later.',
    },
  ],
} as const;
