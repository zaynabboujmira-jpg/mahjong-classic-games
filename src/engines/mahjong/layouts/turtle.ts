import { block, defineLayout, row } from './define';
import type { Slot } from '../types';

/**
 * Classic Turtle (Shanghai) layout: 144 tiles, 5 layers.
 * Coordinates in half-tile units; a tile is 2 x 2.
 */
const slots: Slot[] = [
  // Layer 0: the body. Columns 1..12 are x = 2..24.
  ...row(2, 0, 0, 12),
  ...row(6, 2, 0, 8),
  ...row(4, 4, 0, 10),
  ...row(2, 6, 0, 12),
  ...row(2, 8, 0, 12),
  ...row(4, 10, 0, 10),
  ...row(6, 12, 0, 8),
  ...row(2, 14, 0, 12),
  // Layer 0 ears: left tile and two right tiles vertically centred between rows 3 and 4 (y = 7).
  { x: 0, y: 7, z: 0 },
  { x: 26, y: 7, z: 0 },
  { x: 28, y: 7, z: 0 },
  // Layer 1: 6 x 6
  ...block(8, 2, 1, 6, 6),
  // Layer 2: 4 x 4
  ...block(10, 4, 2, 4, 4),
  // Layer 3: 2 x 2
  ...block(12, 6, 3, 2, 2),
  // Layer 4: crown, centred over the 2 x 2
  { x: 13, y: 7, z: 4 },
];

export const turtle = defineLayout('turtle', 'Turtle', slots);
