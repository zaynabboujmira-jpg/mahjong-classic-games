/** Copy, how-to and FAQ for /minesweeper/infinite/, shared by the page, the sitemap and llms.txt. */
export const INFINITE_PATH = '/minesweeper/infinite/';
export const INFINITE_UPDATED = new Date('2026-11-21');

export const INFINITE = {
  level: 'infinite',
  name: 'Infinite',
  title: 'Infinite Minesweeper – Free Endless Board',
  h1: 'Infinite Minesweeper – an endless minefield, free online',
  description:
    'Play Infinite Minesweeper free: an endless board you can explore in every direction. Clear safe squares for points, with 1 or 3 lives and three mine densities.',
  summary: 'Minesweeper with no edges: explore an endless minefield and see how many safe squares you can open.',
  keywords: ['infinite minesweeper', 'endless minesweeper', 'minesweeper infinite board', 'infinite minesweeper online', 'minesweeper no limit'],
  howTo: [
    { name: 'Start in the middle', text: 'Click or tap a square near the centre. The middle of the field is always clear, so the first click opens an area.' },
    { name: 'Read the numbers', text: 'Each number says how many of the eight squares around it hide a mine. Use them to work out which squares are safe.' },
    { name: 'Flag and explore', text: 'Right-click, long-press or switch to Flag to mark a mine. Drag the field, use the arrow keys or scroll to explore in any direction.' },
    { name: 'Score as high as you can', text: 'Every safe square you open scores a point. With 1 life the game ends at the first mine; with 3 lives you can survive two mistakes.' },
  ],
  faq: [
    {
      q: 'What is Infinite Minesweeper?',
      a: 'Minesweeper without edges. The field goes on forever in every direction, so instead of clearing a fixed board you try to open as many safe squares as possible before you hit a mine.',
    },
    {
      q: 'How does the scoring work?',
      a: 'Your score is the number of safe squares you have opened. Your best score is saved separately for each mine density and for 1 life and 3 lives.',
    },
    {
      q: 'Is the board really infinite?',
      a: 'Yes. Mines are placed by a formula from the game number and each square’s position, so new squares appear as you explore and the field never runs out, without storing anything until you open it.',
    },
    {
      q: 'What do Easy, Normal and Hard change?',
      a: 'The share of squares that hide a mine: about 12% on Easy, 17% on Normal and 22% on Hard. Higher density means more numbers to read and fewer big open areas.',
    },
    {
      q: 'How do I flag a mine on a phone?',
      a: 'Long-press a square, or switch the Dig/Flag control to Flag and tap. Tapping an opened number whose mines are all flagged opens the rest of its neighbours, like chording on a computer.',
    },
    {
      q: 'Is my field saved?',
      a: 'Yes. Your opened squares, flags, lives and position are saved in your browser, so you can close the page and keep exploring the same field later.',
    },
  ],
} as const;
