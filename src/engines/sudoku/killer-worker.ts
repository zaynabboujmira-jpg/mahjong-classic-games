/// <reference lib="webworker" />
import { generateKiller, type KillerLevel } from './killer';

/** Builds Killer Sudoku puzzles off the main thread: proving a cage layout unique can take a moment. */
self.onmessage = (e: MessageEvent<{ id: number; level: KillerLevel; seed: string }>) => {
  const { id, level, seed } = e.data;
  (self as unknown as Worker).postMessage({ id, puzzle: generateKiller(level, seed) });
};
