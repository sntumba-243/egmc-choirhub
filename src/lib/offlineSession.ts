// Offline session restore.
//
// supabase-js cannot refresh an expired access token without network: offline,
// once the token is >~1h old (i.e. essentially every offline launch),
// auth.getSession() returns { session: null } — it KEEPS the stored session but
// reports none. Our boot treated that as "logged out" and routed to /login,
// which needs network. So: remember the last signed-in profile, and restore it
// while offline as long as supabase still holds a stored session (i.e. the
// member never logged out). Online launches always re-validate normally.

import { storageGet, storageSet, storageRemove } from './safeStorage';
import type { NeonUser } from './neonAuth';

const KEY = 'choirhub_offline_user';
const REMEMBER_KEY = 'choirhub_remember_me';
// Same remember-me choice the supabase auth storage adapter uses (lib/supabase.ts).
const store = () => (storageGet(REMEMBER_KEY) !== 'false' ? 'local' : 'session');

export function saveOfflineUser(user: NeonUser): void {
  storageSet(KEY, JSON.stringify(user), store());
}

export function clearOfflineUser(): void {
  storageRemove(KEY, 'local');
  storageRemove(KEY, 'session');
}

/** True if supabase-js still has a persisted session (sb-<ref>-auth-token). */
function hasStoredSupabaseSession(): boolean {
  for (const s of ['local', 'session'] as const) {
    try {
      const st = s === 'local' ? window.localStorage : window.sessionStorage;
      for (let i = 0; i < st.length; i++) {
        const k = st.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token') && st.getItem(k)) return true;
      }
    } catch { /* storage blocked */ }
  }
  return false;
}

export function loadOfflineUser(): NeonUser | null {
  if (!hasStoredSupabaseSession()) return null;
  try {
    const raw = storageGet(KEY, store());
    return raw ? (JSON.parse(raw) as NeonUser) : null;
  } catch {
    return null;
  }
}

/** Network unavailable: browser says offline, or a supabase call failed at the network layer. */
export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const e = error as { name?: string; status?: number; message?: string } | null;
  return !!e && (e.name === 'AuthRetryableFetchError' || e.status === 503 || /fetch|network/i.test(e.message || ''));
}
