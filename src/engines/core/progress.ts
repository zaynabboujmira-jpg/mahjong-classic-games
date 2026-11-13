import { dayNumber } from './day';
import { listKeys, readJson, removeKey, writeJson } from './storage';

/*
 * Cross-game progress, kept only in the player's browser: wins per game, the
 * daily challenges and the daily streak. Everything goes through a tiny
 * key-value interface so the logic can be unit tested without a browser.
 */
export interface KV {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  keys(): string[];
  remove(key: string): void;
}

/** The browser's localStorage (via the safe wrappers in storage.ts). */
export const browserKV: KV = { get: readJson, set: writeJson, keys: listKeys, remove: removeKey };

/** A KV kept in memory, for tests and previews. */
export function memoryKV(seed: Record<string, unknown> = {}): KV {
  const m = new Map(Object.entries(seed));
  return {
    get: <T>(k: string, f: T) => (m.has(k) ? (m.get(k) as T) : f),
    set: (k, v) => void m.set(k, v),
    keys: () => [...m.keys()],
    remove: (k) => void m.delete(k),
  };
}

export const DAILY_GAMES = ['word-guess', 'sudoku', 'klondike', 'mahjong'] as const;
export type DailyGame = (typeof DAILY_GAMES)[number];
export const DAILY_NAMES: Record<DailyGame, string> = { 'word-guess': 'Word Guess', sudoku: 'Sudoku', klondike: 'Klondike', mahjong: 'Mahjong' };

/** The seed every player gets for a game on a given day. */
export const dailySeed = (day: number) => `daily${day}`;

/** Where each daily challenge is played (the seed makes it the same deal for everyone). */
export function dailyLink(game: DailyGame, day: number): string {
  switch (game) {
    case 'word-guess':
      return '/word-guess/?mode=daily';
    case 'sudoku':
      return `/sudoku/medium/?puzzle=${dailySeed(day)}`;
    case 'klondike':
      return `/solitaire/klondike/?seed=${dailySeed(day)}&draw=1`;
    case 'mahjong':
      return `/mahjong/turtle/?seed=${dailySeed(day)}`;
  }
}

export interface Progress {
  /** Wins per game id. */
  wins: Record<string, number>;
  /** Daily results: day number → game → result (and guesses for Word Guess). */
  daily: Record<string, Partial<Record<DailyGame, { won: boolean; guesses?: number }>>>;
}

const KEY = 'progress';
export const emptyProgress = (): Progress => ({ wins: {}, daily: {} });
export const readProgress = (kv: KV = browserKV): Progress => {
  const p = kv.get<Progress>(KEY, emptyProgress());
  return { wins: p.wins ?? {}, daily: p.daily ?? {} };
};

/**
 * Records a win. When the game was played from today's daily seed it also
 * completes that daily challenge.
 */
export function recordWin(game: string, seed: string | null = null, now = new Date(), kv: KV = browserKV): Progress {
  const p = readProgress(kv);
  p.wins[game] = (p.wins[game] ?? 0) + 1;
  kv.set(KEY, p);
  const dailyGame = game === 'mahjong-solitaire' ? 'mahjong' : game;
  if (seed && seed === dailySeed(dayNumber(now)) && (DAILY_GAMES as readonly string[]).includes(dailyGame)) {
    return recordDaily(dailyGame as DailyGame, true, undefined, now, kv);
  }
  return p;
}

/** Records the result of a daily challenge (the first result of the day stands, except a later win). */
export function recordDaily(game: DailyGame, won: boolean, guesses?: number, now = new Date(), kv: KV = browserKV): Progress {
  const p = readProgress(kv);
  const day = String(dayNumber(now));
  const today = (p.daily[day] ??= {});
  if (!today[game] || (!today[game]!.won && won)) today[game] = { won, ...(guesses ? { guesses } : {}) };
  kv.set(KEY, p);
  return p;
}

/** Days with at least one daily challenge won. */
const wonDays = (p: Progress) =>
  Object.entries(p.daily)
    .filter(([, games]) => Object.values(games).some((r) => r?.won))
    .map(([d]) => Number(d))
    .sort((a, b) => a - b);

/**
 * The daily streak: consecutive days with at least one daily challenge won.
 * It is still alive today if yesterday counted and today is not played yet.
 */
export function dailyStreak(p: Progress, today: number): { current: number; best: number } {
  const days = wonDays(p);
  let best = 0;
  let run = 0;
  let prev = -Infinity;
  for (const d of days) {
    run = d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const set = new Set(days);
  let current = 0;
  for (let d = set.has(today) ? today : today - 1; set.has(d); d--) current++;
  return { current, best };
}

/** Wipes every saved score, setting and streak (the Reset button on /stats/). */
export function resetAll(kv: KV = browserKV) {
  for (const k of kv.keys()) kv.remove(k);
}
