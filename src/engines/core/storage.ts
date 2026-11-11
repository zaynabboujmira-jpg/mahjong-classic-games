/**
 * localStorage wrapper that never throws (private mode, blocked storage, SSR)
 * and namespaces every key so games cannot collide.
 */
const PREFIX = 'og:';

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = store()?.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    store()?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: progress simply is not remembered */
  }
}
