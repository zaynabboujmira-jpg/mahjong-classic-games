/**
 * FreeCell deals that get their own static page (/solitaire/freecell/deal/[n]/).
 * Any deal 1-1,000,000 is playable via /solitaire/freecell/?deal=n; only this
 * curated set is pre-rendered, so every indexed page has a reason to exist.
 * Notes must stay factual: they are shown on the page and in its description.
 */
export const FAMOUS_DEALS: readonly { deal: number; note: string }[] = [
  { deal: 1, note: 'The first game in the original Microsoft numbering, and the one many players start with.' },
  { deal: 2, note: 'The second classic deal, a good warm-up after game #1.' },
  { deal: 3, note: 'Deal #3 from the original set of 32,000 numbered games.' },
  { deal: 4, note: 'Deal #4 from the original set of 32,000 numbered games.' },
  { deal: 5, note: 'Deal #5 from the original set of 32,000 numbered games.' },
  { deal: 10, note: 'Deal #10 from the original set of 32,000 numbered games.' },
  { deal: 100, note: 'Deal #100, a round number from the original set.' },
  { deal: 617, note: 'Deal #617 from the original set of 32,000 numbered games.' },
  { deal: 1000, note: 'Deal #1000 from the original set of 32,000 numbered games.' },
  {
    deal: 11982,
    note: 'The one deal among the original 32,000 that is known to have no solution. Try it and see how far you get.',
  },
  { deal: 32000, note: 'The last of the original 32,000 numbered deals.' },
];
