/// <reference lib="webworker" />
import { generate, type Difficulty } from './generator';

/** Generates puzzles off the main thread so Expert never freezes the page. */
self.onmessage = (e: MessageEvent<{ id: number; difficulty: Difficulty; seed: string }>) => {
  const { id, difficulty, seed } = e.data;
  const p = generate(difficulty, seed);
  (self as unknown as Worker).postMessage({ id, puzzle: p });
};
