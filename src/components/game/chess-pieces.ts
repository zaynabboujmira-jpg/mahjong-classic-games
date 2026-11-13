/**
 * Original chess piece drawings (45 × 45 viewBox), simple filled silhouettes
 * that read well at small sizes. Drawn for this site; no fonts or images.
 */
export const PIECE_PATHS: Record<number, string> = {
  // Pawn: round head on a collar and a wide base.
  1: '<circle cx="22.5" cy="14" r="6"/><path d="M16 22h13l-2.5 3c2.5 3.5 4 8 4.5 12H14c.5-4 2-8.5 4.5-12z"/><rect x="11" y="36" width="23" height="5" rx="2"/>',
  // Knight: a stylised horse head.
  2: '<path d="M14 38c1-6 4-10 8-13-3 0-6 1-8 3l-3-3c2-5 6-9 11-11l1-5 3 4c6 2 10 7 10 16 0 4-1 7-2 9z"/><circle cx="21" cy="15.5" r="1.6" fill="var(--eye)"/><rect x="11" y="36" width="24" height="5" rx="2"/>',
  // Bishop: mitre with a slit, on a stem.
  3: '<circle cx="22.5" cy="8" r="2.6"/><path d="M22.5 10c6 5 8 10 6 15H16.5c-2-5 0-10 6-15z"/><path d="M24 14l-4 6" stroke="var(--eye)" stroke-width="2"/><path d="M18 26h9l2 9H16z"/><rect x="11" y="35" width="23" height="6" rx="2"/>',
  // Rook: castle tower with battlements.
  4: '<path d="M12 8h4v4h4V8h5v4h4V8h4v8l-3 3v14l3 3H12l3-3V19l-3-3z"/><rect x="10" y="36" width="25" height="5" rx="2"/>',
  // Queen: crown of five points with orbs.
  5: '<circle cx="9" cy="11" r="2.5"/><circle cx="16" cy="8" r="2.5"/><circle cx="22.5" cy="7" r="2.5"/><circle cx="29" cy="8" r="2.5"/><circle cx="36" cy="11" r="2.5"/><path d="M9 13l5 14 3-15 5.5 14L28 12l3 15 5-14-3 21H12z"/><rect x="11" y="35" width="23" height="6" rx="2"/>',
  // King: tall body with a cross on top.
  6: '<path d="M21 3h3v4h4v3h-4v4h-3v-4h-4V7h4z"/><path d="M22.5 14c-6 0-10 4-10 9 0 3 2 6 3 10h14c1-4 3-7 3-10 0-5-4-9-10-9z"/><rect x="11" y="34" width="23" height="7" rx="2"/>',
};

export const PIECE_NAMES: Record<number, string> = { 1: 'pawn', 2: 'knight', 3: 'bishop', 4: 'rook', 5: 'queen', 6: 'king' };

export function pieceSvg(type: number, white: boolean): string {
  const fill = white ? '#f8f4ea' : '#2b2b30';
  const stroke = white ? '#3a3a3a' : '#0d0d10';
  const eye = white ? '#3a3a3a' : '#f8f4ea';
  return `<svg viewBox="0 0 45 45" style="--eye:${eye}" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round">${PIECE_PATHS[type]}</svg>`;
}
