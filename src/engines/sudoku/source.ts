import type { Difficulty, Puzzle } from './generator';

interface Request {
  difficulty: Difficulty;
  seed: string;
  resolve: (p: Puzzle) => void;
}

const onMainThread = (difficulty: Difficulty, seed: string) => import('./generator').then((m) => m.generate(difficulty, seed));

/**
 * Hands out puzzles from a Web Worker (falling back to the main thread where
 * workers are unavailable) and caches them by seed, so the next puzzle can be
 * prepared in the background while the current one is played.
 */
export class PuzzleSource {
  private worker: Worker | null = null;
  private failed = false;
  private nextId = 0;
  private waiting = new Map<number, Request>();
  private cache = new Map<string, Promise<Puzzle>>();

  get(difficulty: Difficulty, seed: string): Promise<Puzzle> {
    const key = `${difficulty}:${seed}`;
    let p = this.cache.get(key);
    if (!p) {
      p = this.request(difficulty, seed);
      this.cache.set(key, p);
      // Keep the cache small: the current puzzle and a prefetched one or two.
      if (this.cache.size > 4) this.cache.delete(this.cache.keys().next().value!);
    }
    return p;
  }

  private request(difficulty: Difficulty, seed: string): Promise<Puzzle> {
    const w = this.ensureWorker();
    if (!w) return onMainThread(difficulty, seed);
    return new Promise((resolve) => {
      const id = this.nextId++;
      this.waiting.set(id, { difficulty, seed, resolve });
      w.postMessage({ id, difficulty, seed });
    });
  }

  private ensureWorker(): Worker | null {
    if (this.worker || this.failed) return this.worker;
    try {
      const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ id: number; puzzle: Puzzle }>) => {
        this.waiting.get(e.data.id)?.resolve(e.data.puzzle);
        this.waiting.delete(e.data.id);
      };
      w.onerror = () => {
        // The worker could not load or crashed: finish its requests here instead.
        this.failed = true;
        w.terminate();
        this.worker = null;
        for (const r of this.waiting.values()) void onMainThread(r.difficulty, r.seed).then(r.resolve);
        this.waiting.clear();
      };
      this.worker = w;
    } catch {
      this.failed = true;
    }
    return this.worker;
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
}
