// Web Storage that never throws. Some contexts (iOS private/restricted modes,
// in-app browsers, blocked site data) throw on localStorage/sessionStorage
// access or on setItem (QuotaExceededError). Inside an async path — the login
// submit handler, supabase-js session restore — that throw becomes an
// unhandled rejection. Reads fall back to null; writes are best-effort.

type Store = 'local' | 'session';

const pick = (s: Store): Storage => (s === 'local' ? window.localStorage : window.sessionStorage);

export function storageGet(key: string, s: Store = 'local'): string | null {
  try {
    return pick(s).getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string, s: Store = 'local'): void {
  try {
    pick(s).setItem(key, value);
  } catch {
    // best-effort
  }
}

export function storageRemove(key: string, s: Store = 'local'): void {
  try {
    pick(s).removeItem(key);
  } catch {
    // best-effort
  }
}
