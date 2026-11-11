import { freeSlots } from './board';
import { randomInt, shuffleInPlace, type Rng } from '../core/rng';
import { standardPairs } from './tiles';
import type { Face, Topology } from './types';

export interface Deal {
  /** Face per slot index; null for slots that are not part of this deal. */
  readonly faces: (Face | null)[];
  /** One known winning sequence of pair removals, first move first. */
  readonly solution: readonly (readonly [number, number])[];
}

export class GenerationError extends Error {}

/**
 * Builds a deal that is guaranteed to be solvable.
 *
 * It plays a game before any faces exist: starting from the full board it
 * repeatedly removes two tiles that are free at that moment, then gives each
 * removed pair a matching pair of faces. That removal order is a valid
 * winning line, so every deal has at least one solution. If the random removal order paints
 * itself into a corner (fewer than two free tiles while tiles remain) it
 * retries with a fresh order.
 *
 * @param pairs Faces to place, one entry per pair. Defaults to a random
 *   selection from the standard 144-tile set.
 * @param present Which slots take part (used by shuffle to re-deal only the
 *   tiles still on the board). Defaults to every slot.
 */
export function generateDeal(
  topo: Topology,
  rng: Rng,
  options: { pairs?: [Face, Face][]; present?: readonly boolean[]; maxAttempts?: number } = {},
): Deal {
  const n = topo.slots.length;
  const startPresent = options.present ?? new Array<boolean>(n).fill(true);
  const count = startPresent.reduce((c, p) => c + (p ? 1 : 0), 0);
  if (count % 2 !== 0) throw new GenerationError(`cannot deal an odd number of tiles (${count})`);

  const pairs = options.pairs ?? shuffleInPlace(standardPairs(), rng).slice(0, count / 2);
  if (pairs.length !== count / 2) {
    throw new GenerationError(`need ${count / 2} pairs, got ${pairs.length}`);
  }

  const maxAttempts = options.maxAttempts ?? 400;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const order = removalOrder(topo, startPresent, count, rng);
    if (!order) continue;

    const faces: (Face | null)[] = new Array<Face | null>(n).fill(null);
    const shuffledPairs = shuffleInPlace(pairs.slice(), rng);
    order.forEach(([a, b], k) => {
      const [fa, fb] = shuffledPairs[k]!;
      faces[a] = fa;
      faces[b] = fb;
    });
    // Each pair was free on the board as it stood when it was taken, starting
    // from the full board, so the removal order is already a forward solution.
    return { faces, solution: order };
  }
  throw new GenerationError(`no solvable deal found after ${maxAttempts} attempts`);
}

/**
 * Random sequence of pairs that empties the board, each pair free at the
 * moment it is taken. Returns null on a dead end.
 */
function removalOrder(
  topo: Topology,
  startPresent: readonly boolean[],
  count: number,
  rng: Rng,
): [number, number][] | null {
  const present = startPresent.slice();
  const order: [number, number][] = [];
  for (let left = count; left > 0; left -= 2) {
    const free = freeSlots(topo, present);
    if (free.length < 2) return null;
    const a = free.splice(randomInt(rng, free.length), 1)[0]!;
    const b = free[randomInt(rng, free.length)]!;
    present[a] = false;
    present[b] = false;
    order.push([a, b]);
  }
  return order;
}
