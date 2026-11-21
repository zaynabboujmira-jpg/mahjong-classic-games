/** Copy, how-to and FAQ for /mahjong/connect/, shared by the page, the sitemap and llms.txt. */
export const CONNECT_PATH = '/mahjong/connect/';
export const CONNECT_UPDATED = new Date('2026-11-21');

export const CONNECT = {
  level: 'connect',
  name: 'Connect',
  title: 'Mahjong Connect – Free Tile Matching Game',
  h1: 'Mahjong Connect – link matching tiles, free online',
  description:
    'Play Mahjong Connect free: join two matching tiles with a line of up to two bends to clear them. Three board sizes, hints, shuffles, undo and a timer.',
  summary: 'Link pairs of matching Mahjong tiles with a line that bends at most twice, until the board is clear.',
  keywords: ['mahjong connect', 'mahjong connect free', 'mahjong connect classic', 'connect tiles game', 'tile link game'],
  howTo: [
    { name: 'Find a matching pair', text: 'Look for two tiles with the same picture. Flowers match any flower and seasons match any season, as in Mahjong Solitaire.' },
    { name: 'Check the line', text: 'The two tiles must be joined by a line of at most three straight parts (two bends) that only crosses empty spaces. The line may run around the outside of the board.' },
    { name: 'Tap both tiles', text: 'Tap the first tile, then the second. If they connect, the line flashes and both tiles disappear.' },
    { name: 'Clear the board', text: 'Remove every pair to win. Hint shows a pair that connects, Shuffle rearranges the tiles (three times per game), and Undo puts the last pair back.' },
  ],
  faq: [
    {
      q: 'How do you play Mahjong Connect?',
      a: 'Tap two matching tiles that can be linked by a line with no more than two bends, passing only through empty spaces or around the edge of the board. Both tiles are removed. Clear all the tiles to win.',
    },
    {
      q: 'What happens if there are no moves left?',
      a: 'The game reshuffles the remaining tiles for you, free of charge, so there is always a move and every game can be finished. You also have three shuffles of your own to use whenever you like.',
    },
    {
      q: 'How is it different from Mahjong Solitaire?',
      a: 'Mahjong Solitaire stacks tiles in layers and frees them from the sides. Mahjong Connect lays every tile flat in a grid, and a pair can be removed only if a line with at most two bends can join them. It is faster and more visual.',
    },
    {
      q: 'What are the board sizes?',
      a: 'Easy has 48 tiles on an 8 by 6 grid, Medium 96 tiles on 12 by 8, and Hard the full 144-tile set on 16 by 9. On a phone held upright the board turns on its side so the tiles stay large.',
    },
    {
      q: 'Is my progress saved?',
      a: 'Yes. The board, your time and your shuffles are saved in your browser after every move, and your best time for each size is kept on your stats page.',
    },
  ],
} as const;
