/**
 * Tiny, defensive localStorage wrapper. Every read/write is try/catch'd because
 * storage can be unavailable (private mode, blocked, quota) and the game must still run.
 */
export interface Settings {
  theme: 'system' | 'light' | 'dark';
  highContrast: boolean;
  largeTiles: boolean;
  reducedMotion: boolean;
  highlightFree: boolean;
  sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  highContrast: false,
  largeTiles: false,
  reducedMotion: false,
  highlightFree: true,
  sound: false,
};

const SETTINGS_KEY = 'og:settings';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const loadSettings = (): Settings => read(SETTINGS_KEY, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings): void => write(SETTINGS_KEY, s);

export interface BestRecord {
  bestTimeMs: number | null;
  wins: number;
  plays: number;
}

const bestKey = (game: string, variant: string) => `og:best:${game}:${variant}`;

export const loadBest = (game: string, variant: string): BestRecord =>
  read(bestKey(game, variant), { bestTimeMs: null, wins: 0, plays: 0 });

export function recordPlay(game: string, variant: string): void {
  const b = loadBest(game, variant);
  write(bestKey(game, variant), { ...b, plays: b.plays + 1 });
}

export function recordWin(game: string, variant: string, timeMs: number): BestRecord {
  const b = loadBest(game, variant);
  const next: BestRecord = {
    plays: b.plays,
    wins: b.wins + 1,
    bestTimeMs: b.bestTimeMs === null ? timeMs : Math.min(b.bestTimeMs, timeMs),
  };
  write(bestKey(game, variant), next);
  return next;
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
