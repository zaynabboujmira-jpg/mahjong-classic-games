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

/** Every saved key (without the prefix). */
export function listKeys(): string[] {
  const s = store();
  if (!s) return [];
  const out: string[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
    }
  } catch {
    /* blocked storage */
  }
  return out;
}

export function removeKey(key: string): void {
  try {
    store()?.removeItem(PREFIX + key);
  } catch {
    /* blocked storage */
  }
}
