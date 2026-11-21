import { generateKiller, type KillerLevel, type KillerPuzzle } from './killer';

// The cage helpers are already in the page bundle, so the fallback can use the generator directly.
const onMainThread = (level: KillerLevel, seed: string) => Promise.resolve().then(() => generateKiller(level, seed));

/** Hands out Killer Sudoku puzzles from a Web Worker (main thread as a fallback), cached by level and seed. */
export class KillerSource {
  private worker: Worker | null = null;
  private failed = false;
  private nextId = 0;
  private waiting = new Map<number, { level: KillerLevel; seed: string; resolve: (p: KillerPuzzle) => void }>();
  private cache = new Map<string, Promise<KillerPuzzle>>();

  get(level: KillerLevel, seed: string): Promise<KillerPuzzle> {
    const key = `${level}:${seed}`;
    let p = this.cache.get(key);
    if (!p) {
      p = this.request(level, seed);
      this.cache.set(key, p);
      if (this.cache.size > 4) this.cache.delete(this.cache.keys().next().value!);
    }
    return p;
  }

  private request(level: KillerLevel, seed: string): Promise<KillerPuzzle> {
    const w = this.ensureWorker();
    if (!w) return onMainThread(level, seed);
    return new Promise((resolve) => {
      const id = this.nextId++;
      this.waiting.set(id, { level, seed, resolve });
      w.postMessage({ id, level, seed });
    });
  }

  private ensureWorker(): Worker | null {
    if (this.worker || this.failed) return this.worker;
    try {
      const w = new Worker(new URL('./killer-worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ id: number; puzzle: KillerPuzzle }>) => {
        this.waiting.get(e.data.id)?.resolve(e.data.puzzle);
        this.waiting.delete(e.data.id);
      };
      w.onerror = () => {
        this.failed = true;
        w.terminate();
        this.worker = null;
        for (const r of this.waiting.values()) void onMainThread(r.level, r.seed).then(r.resolve);
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
