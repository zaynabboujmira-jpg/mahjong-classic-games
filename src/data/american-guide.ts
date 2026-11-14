/**
 * Content for the American Mahjong guide & printable scorecard page
 * (/mahjong/american-mahjong-guide/), shared with llms.txt and llms-full.txt.
 *
 * The National Mah Jongg League's card is copyrighted and changes every year,
 * so none of its hands appear here. Seven example hands come from this site's
 * own card (src/engines/mahjong-table/american.ts, linked by cardId); the Year
 * and 369 examples are original illustrations written for this guide.
 */

export const GUIDE_PATH = '/mahjong/american-mahjong-guide/';
export const GUIDE_UPDATED = new Date('2026-11-14');
export const SCORECARD_PDF = '/downloads/printable-mahjong-scorecard.pdf';
/** Size of the PDF in public/downloads, shown on the download button. */
export const SCORECARD_PDF_KB = 815;
export const SCORECARD_IMAGES = {
  small: { src: '/images/mahjong-guide/printable-mahjong-scorecard-800.webp', width: 800, height: 618 },
  large: { src: '/images/mahjong-guide/printable-mahjong-scorecard-1600.webp', width: 1600, height: 1236 },
} as const;

export const GUIDE_TITLE = 'American Mahjong Guide & Printable Scorecard (2026)';
export const GUIDE_DESCRIPTION =
  'Free American Mahjong visual guide: the 9 hand categories, X vs C hands, the no-joker rule and 25 to 75 point values, plus a printable scorecard PDF.';
export const GUIDE_SUMMARY =
  'A one-page reference to the 9 American Mahjong hand categories, exposed and concealed hands, jokers and point values, with a free printable scorecard (PDF).';

export interface GuideCategory {
  id: string;
  name: string;
  /** What the section's hands are built from. */
  idea: string;
  /** An example hand of exactly 14 tiles, written the usual way (FF = two flowers, D = dragon, 0 = White Dragon). */
  example: string;
  /** Which suits the example uses. */
  suits: string;
  exposure: 'X' | 'C';
  value: number;
  /** The matching hand on this site's own card, when the example comes from it. */
  cardId?: string;
  tip: string;
}

export const CATEGORIES: readonly GuideCategory[] = [
  {
    id: 'year',
    name: '2026 (Year hands)',
    idea: 'The digits of the year, with the White Dragon standing in for 0',
    example: 'NNN 2026 2026 SSS',
    suits: 'Any 2 suits',
    exposure: 'X',
    value: 25,
    tip: 'The 2, 0, 2 and 6 in a year group are single tiles, so jokers cannot replace them. Keep your White Dragons early.',
  },
  {
    id: '2468',
    name: '2468',
    idea: 'Even numbers only: 2, 4, 6 and 8',
    example: 'FF 222 444 666 888',
    suits: 'Any 2 suits (2s and 4s in one, 6s and 8s in the other)',
    exposure: 'X',
    value: 25,
    cardId: 'even-2',
    tip: 'A strong choice when the deal gives you many even tiles. Pass odd numbers away in the Charleston.',
  },
  {
    id: 'like-numbers',
    name: 'Any Like Numbers',
    idea: 'The same number repeated in different suits',
    example: 'FF 7777 7777 7777',
    suits: 'All 3 suits, any one number',
    exposure: 'X',
    value: 25,
    cardId: 'like-1',
    tip: 'Pick the number you already hold most of. Jokers fill kongs easily here.',
  },
  {
    id: 'quints',
    name: 'Quints',
    idea: 'Groups of five identical tiles, which always need at least one joker',
    example: 'FFFF 55555 DDDDD',
    suits: 'Any 1 suit with its matching dragon',
    exposure: 'X',
    value: 40,
    cardId: 'quint-1',
    tip: 'Only four of each tile exist, so a quint is impossible without jokers. Go for it when you are dealt two or more.',
  },
  {
    id: 'consecutive-run',
    name: 'Consecutive Run',
    idea: 'Numbers that follow each other, such as 1-2-3-4 or 5-6-7-8',
    example: 'FF 111 222 333 444',
    suits: 'Any 1 suit, any 4 consecutive numbers',
    exposure: 'X',
    value: 25,
    cardId: 'run-1',
    tip: 'Runs can usually start on any number that fits, which makes this section the most flexible on most cards.',
  },
  {
    id: '13579',
    name: '13579',
    idea: 'Odd numbers only: 1, 3, 5, 7 and 9',
    example: 'FFFF 1111 5555 99',
    suits: 'All 3 suits (1s, 5s and 9s in different suits)',
    exposure: 'X',
    value: 30,
    cardId: 'odd-3',
    tip: 'The mirror of 2468: keep odd tiles, pass the even ones.',
  },
  {
    id: 'winds-dragons',
    name: 'Winds & Dragons',
    idea: 'Honor tiles: North, East, West, South and the three dragons',
    example: 'FF DDDD DDDD DDDD',
    suits: 'Red, Green and White Dragons (no suit tiles)',
    exposure: 'X',
    value: 30,
    cardId: 'wind-2',
    tip: 'Honors are useless for most other hands, so a handful of winds and dragons points straight at this section.',
  },
  {
    id: '369',
    name: '369',
    idea: 'Multiples of three only: 3, 6 and 9',
    example: 'FF 333 6666 999 DD',
    suits: 'Any 1 suit with its matching dragon',
    exposure: 'X',
    value: 25,
    tip: 'Like 2468 and 13579, this section rewards a hand that is already heavy in a few numbers.',
  },
  {
    id: 'singles-pairs',
    name: 'Singles & Pairs',
    idea: 'Only pairs and single tiles, so jokers can never be used',
    example: 'FF 11 22 33 44 55 66',
    suits: 'Any 1 suit, 6 consecutive pairs',
    exposure: 'C',
    value: 50,
    cardId: 'pairs-2',
    tip: 'Always concealed and always jokerless, which is why these hands pay the most. You may only call the tile that wins.',
  },
];

export const NOTATION: readonly { term: string; meaning: string }[] = [
  { term: 'F / FF', meaning: 'Flower tiles. Any flowers count, and FF means two of them.' },
  { term: '1111', meaning: 'A kong: four identical tiles. 111 is a pung (three) and 11111 a quint (five).' },
  { term: 'D', meaning: 'A dragon. Each suit has its own: Red goes with Craks, Green with Bams and White (Soap) with Dots.' },
  { term: '0', meaning: 'In a year hand, the White Dragon stands in for the zero.' },
  { term: 'N E W S', meaning: 'The four winds: North, East, West and South.' },
  { term: 'Colours', meaning: 'Groups printed in different colours must be in different suits; the same colour means the same suit.' },
  { term: 'X', meaning: 'Exposed hand: you may call discards to complete pungs, kongs and quints and lay them face up.' },
  { term: 'C', meaning: 'Concealed hand: keep every tile in your rack. The only discard you may call is the one that wins.' },
  { term: '★ (star)', meaning: 'A starred tile or group may not be replaced by a joker. Singles and pairs never take jokers anyway.' },
];

export const POINT_VALUES: readonly { value: number; typical: string }[] = [
  { value: 25, typical: 'Most exposed hands: even, odd, like-number and run hands' },
  { value: 30, typical: 'Harder exposed hands, often with more honors or kongs' },
  { value: 35, typical: 'Exposed or concealed hands with awkward numbers' },
  { value: 40, typical: 'Quint hands' },
  { value: 45, typical: 'Quints in consecutive numbers' },
  { value: 50, typical: 'Concealed Singles & Pairs hands' },
  { value: 75, typical: 'The rarest concealed hands (often a year hand made of singles)' },
];

export const HOW_TO: readonly { name: string; text: string }[] = [
  {
    name: 'Print the scorecard',
    text: 'Download the free scorecard PDF or press Print Scorecard. It fits on a single US Letter or A4 sheet.',
  },
  {
    name: 'Write in the players',
    text: 'Put up to seven names in the Name column, one per row. Use one sheet per table or per session.',
  },
  {
    name: 'Score each game',
    text: 'After each of the four games, write the points each player won or paid in that game’s column. The point guide on the sheet lists the usual values, from 25 to 75.',
  },
  {
    name: 'Add up the totals',
    text: 'Add the four games for each player in the Total column and write the highest scorer in the Winner box.',
  },
];

export const FAQ: readonly { q: string; a: string }[] = [
  {
    q: 'What are the hand categories in American Mahjong?',
    a: 'Most cards group their hands into about nine sections: a hand for the current year (2026), 2468, Any Like Numbers, Quints, Consecutive Run, 13579, Winds & Dragons, 369, and Singles & Pairs. Every hand has exactly 14 tiles and must be matched exactly.',
  },
  {
    q: 'What do X and C mean on an American Mahjong card?',
    a: 'X means the hand may be exposed: you can call discards to complete pungs, kongs and quints. C means concealed: you keep every tile in your rack and may only call the discard that wins the game.',
  },
  {
    q: 'What does a star mean next to a tile?',
    a: 'A star marks tiles that cannot be replaced by a joker. Jokers only ever stand in for a tile in a group of three or more, so singles and pairs are always jokerless.',
  },
  {
    q: 'How many points is an American Mahjong hand worth?',
    a: 'Hands are usually worth 25 to 50 points, and a few rare concealed hands are worth 75. The player who discarded the winning tile pays double and the other two pay the hand’s value; a self-drawn win is paid double by everyone. A hand completed without jokers usually doubles too.',
  },
  {
    q: 'Is this the official 2026 National Mah Jongg League card?',
    a: 'No. This guide is an independent educational reference and is not affiliated with or endorsed by the National Mah Jongg League. The League’s card is copyrighted and changes every year, so none of its hands are reproduced here. Buy the official card from the League to play in clubs and tournaments.',
  },
  {
    q: 'Is the printable scorecard free?',
    a: 'Yes. The scorecard PDF is free to download, print and copy for your own games, club or class. There is no sign-up.',
  },
  {
    q: 'Where can I practise American Mahjong online?',
    a: 'Play 4-player American Mahjong free on this site against three computer players, with the Charleston, jokers and exposures. The game uses its own card of 20 hands in seven of the nine sections above (it has no Year or 369 hands yet).',
  },
];
