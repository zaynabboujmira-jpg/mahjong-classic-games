import { block, defineLayout, row } from './define';

/**
 * Fortress: 140 tiles, 4 layers. A walled square with raised corner towers and a keep.
 */
export const fortress = defineLayout('fortress', 'Fortress', [
  // Outer wall ring on layer 0: 14 x 10 ring, 2 tiles thick on top/bottom, 1 thick sides.
  ...block(0, 0, 0, 14, 2), // top wall 28
  ...block(0, 16, 0, 14, 2), // bottom wall 28
  ...block(0, 4, 0, 2, 6), // left wall 12
  ...block(24, 4, 0, 2, 6), // right wall 12
  // Inner courtyard block on layer 0
  ...block(6, 6, 0, 8, 3), // 24
  // Corner towers layer 1
  ...block(0, 0, 1, 2, 2), // 4
  ...block(24, 0, 1, 2, 2), // 4
  ...block(0, 16, 1, 2, 2), // 4
  ...block(24, 16, 1, 2, 2), // 4
  // Keep layers
  ...block(8, 6, 1, 6, 3), // 18
  ...row(12, 8, 2, 2), // 2
]);
