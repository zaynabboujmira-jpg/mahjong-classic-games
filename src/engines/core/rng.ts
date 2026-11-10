/**
 * Deterministic PRNG (mulberry32) seeded from a number or string.
 * Used for shareable seeds and daily challenges: same seed, same board, on any device.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  int(n: number): number;
  /** In-place Fisher-Yates shuffle. */
  shuffle<T>(arr: T[]): T[];
  readonly seed: number;
}

export function hashSeed(input: string | number): number {
  if (typeof input === 'number') return input >>> 0;
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seedInput: string | number): Rng {
  const seed = hashSeed(seedInput);
  let a = seed || 0x9e3779b9;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed,
    next,
    int: (n) => Math.floor(next() * n),
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

/** Human-shareable random seed, e.g. "K7M2Q9". */
export function randomSeedString(len = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** Daily seed: identical for everyone on the same UTC date. */
export function dailySeed(game: string, date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  return `${game}:${d}`;
}
