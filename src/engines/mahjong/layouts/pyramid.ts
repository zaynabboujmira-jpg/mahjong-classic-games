import { block, defineLayout } from './define';

/** Stepped pyramid: 104 tiles, 3 layers. A gentler board for new players. */
export const pyramid = defineLayout('pyramid', 'Pyramid', [
  ...block(0, 0, 0, 10, 6),
  ...block(2, 2, 1, 8, 4),
  ...block(4, 4, 2, 6, 2),
]);
