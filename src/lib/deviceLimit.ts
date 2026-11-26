// Device limit — client side. See supabase/migrations/20261126000000_device_limit.sql.
//
// Each browser / installed app keeps one random device id. It is sent to the
// `device_check` RPC after every sign-in and on app start (online); the server
// records it against the Auth session, replaces this device's older sessions,
// and refuses a NEW device when the account's limit of other devices is in use.
//
// Storage: localStorage, mirrored to a long-lived first-party cookie so either
// one can restore the other. Note: on iOS, Safari and a home-screen app have
// separate storage, so they are two devices; Safari may also clear script
// storage after 7 days without use — the server then falls back to matching
// the user agent of an idle (> 65 min) session of the same account.

import { supabase } from './supabase';

const KEY = 'egmc_device_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // browsers cap at ~400 days

const readCookie = (): string | null => {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + KEY + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
};

const valid = (v: string | null | undefined): v is string => !!v && /^[A-Za-z0-9-]{8,100}$/.test(v);

export function getDeviceId(): string | null {
  try {
    let id: string | null = null;
    try { id = localStorage.getItem(KEY); } catch { /* blocked */ }
    if (!valid(id)) id = readCookie();
    if (!valid(id)) {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('-');
    }
    try { localStorage.setItem(KEY, id); } catch { /* blocked */ }
    try { document.cookie = `${KEY}=${encodeURIComponent(id)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; } catch { /* blocked */ }
    return valid(id) ? id : null;
  } catch {
    return null;
  }
}

export type DeviceCheck =
  | { ok: true; enforced?: boolean; limit?: number | null; devices?: number; skipped?: string }
  | { ok: false; reason: 'device_limit' | 'session_revoked'; limit?: number; devices?: number; message?: string };

export const DEVICE_LIMIT_FALLBACK_MESSAGE =
  'This account is already in use on 2 devices. Sign out on one of them, or ask your choir admin.';

/**
 * Ask the server whether this device may stay signed in. Never throws: a
 * network error or a missing RPC (old database) counts as "ok" so an outage
 * can't lock people out.
 */
export async function checkDevice(supabase: any): Promise<DeviceCheck> {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: true, skipped: 'offline' };
    if (typeof supabase?.rpc !== 'function') return { ok: true, skipped: 'no_rpc' };
    const { data, error } = await supabase.rpc('device_check', { p_device_id: getDeviceId() });
    if (error || !data) return { ok: true, skipped: 'error' };
    return data as DeviceCheck;
  } catch {
    return { ok: true, skipped: 'error' };
  }
}

export function deviceRefusalMessage(r: DeviceCheck): string | null {
  if (r.ok) return null;
  if (r.reason === 'device_limit') return r.message || DEVICE_LIMIT_FALLBACK_MESSAGE;
  return 'You were signed out on this device.';
}

/** RPC on the active client; the Neon failover client has none → "unavailable". */
export async function deviceRpc(fn: string, args?: Record<string, unknown>): Promise<{ data: any; error: { message: string } | null }> {
  const client = supabase as any;
  if (typeof client?.rpc !== 'function') return { data: null, error: { message: 'Not available right now' } };
  const { data, error } = await client.rpc(fn, args);
  return { data, error: error ? { message: error.message } : null };
}
