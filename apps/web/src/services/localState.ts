export function readLocal<T>(key: string, storage: 'localStorage' | 'sessionStorage' = 'localStorage'): T | undefined {
  if (!key) return undefined;
  try { return JSON.parse(window[storage].getItem(key) ?? 'null') ?? undefined; }
  catch { return undefined; }
}

export function writeLocal(key: string, value: unknown, storage: 'localStorage' | 'sessionStorage' = 'localStorage') {
  if (!key) return false;
  try {
    if (value === undefined) window[storage].removeItem(key);
    else window[storage].setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}
