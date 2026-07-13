// Background PDF pre-caching for ChoirHub member portal.
//
// Quietly downloads song sheet-music PDFs (directly from their Supabase Storage
// URL) into the service worker's PDF cache while the member is online, so
// previously unopened songs still work offline. Invisible during normal use —
// the only surface is the "Offline songs" row on the member Profile page.
//
// The cache key MUST match SheetMusicViewer.getDirectUrl exactly (Storage URL +
// version param) so the entries this writes are the ones the viewer requests.

import { supabase } from './supabase';

// ── Types ──
export interface CacheProgress {
  total: number;
  cached: number;
  downloading: boolean;
}

interface Song {
  id: string;
  title: string;
  sheet_music_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BackgroundCacheOpts {
  userId?: string;
  churchId?: string;
}

// ── Constants ──
// Fallback must track SW_VERSION in public/service-worker.js; getPdfCache()
// prefers any existing egmc-pdfs-* cache so a version bump doesn't orphan data.
const PDF_CACHE_FALLBACK = 'egmc-pdfs-2.0.0';
const START_DELAY_MS = 8000;
const BATCH_SIZE = 2;
const BATCH_PAUSE_MS = 500;
const CACHES_OK = typeof caches !== 'undefined';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Progress store (tiny emitter) ──
let progress: CacheProgress = { total: 0, cached: 0, downloading: false };
const listeners = new Set<(p: CacheProgress) => void>();

function setProgress(next: Partial<CacheProgress>) {
  progress = { ...progress, ...next };
  const snapshot = { ...progress };
  listeners.forEach((fn) => {
    try { fn(snapshot); } catch { /* listener errors must not break caching */ }
  });
}

export function getCacheProgress(): CacheProgress {
  return { ...progress };
}

export function subscribeCacheProgress(fn: (p: CacheProgress) => void): () => void {
  listeners.add(fn);
  fn({ ...progress });
  return () => { listeners.delete(fn); };
}

// ── Helpers ──
// Must match SheetMusicViewer.getDirectUrl exactly so the pre-cached key is the
// one the viewer later requests (Storage URL + version param).
function cacheUrl(sheetUrl: string, version?: string | null): string {
  return sheetUrl + (sheetUrl.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(version || '');
}

async function getPdfCache(): Promise<Cache> {
  // Prefer an existing egmc-pdfs-* cache (robust to SW version bumps).
  try {
    const keys = await caches.keys();
    const existing = keys.find((k) => k.startsWith('egmc-pdfs-'));
    return caches.open(existing || PDF_CACHE_FALLBACK);
  } catch {
    return caches.open(PDF_CACHE_FALLBACK);
  }
}

function waitWhileOffline(): Promise<void> {
  if (navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => {
    const onOnline = () => {
      window.removeEventListener('online', onOnline);
      resolve();
    };
    window.addEventListener('online', onOnline);
  });
}

// ── Priority 1: songs in local setlists tied to events in the next 14 days ──
// Setlists live in localStorage (no event_songs DB table), so this tier is
// best-effort and silently empty when the device has no local setlists.
async function upcomingEventSongIds(opts: BackgroundCacheOpts): Promise<string[]> {
  let setlists: Array<{ eventId?: string; songIds?: string[] }> = [];
  try {
    const raw = localStorage.getItem('choir_setlists');
    setlists = raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
  const withEvent = setlists.filter(
    (s) => s.eventId && Array.isArray(s.songIds) && s.songIds.length > 0
  );
  if (!withEvent.length) return [];

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const in14Str = new Date(now.getTime() + 14 * 864e5).toISOString().slice(0, 10);

  let query = supabase.from('events').select('id, date').gte('date', todayStr).lte('date', in14Str);
  if (opts.churchId) query = query.or(`church_id.eq.${opts.churchId},is_global.eq.true`);
  const { data: events } = await query;

  const upcoming = new Set((events || []).map((e: any) => e.id));
  const ids: string[] = [];
  withEvent.forEach((s) => {
    if (s.eventId && upcoming.has(s.eventId)) ids.push(...(s.songIds || []));
  });
  return ids;
}

// ── Build the prioritized, de-duplicated queue ──
async function buildQueue(
  opts: BackgroundCacheOpts
): Promise<{ p12: Song[]; p3: Song[] }> {
  const { data: allSongs, error } = await supabase
    .from('songs')
    .select('id, title, sheet_music_url, created_at, updated_at')
    .not('sheet_music_url', 'is', null)
    .order('created_at', { ascending: false }); // Priority 3: newest first
  if (error || !allSongs) return { p12: [], p3: [] };

  const withSheet = (allSongs as Song[]).filter((s) => !!(s.sheet_music_url && s.sheet_music_url.trim()));
  const byId = new Map(withSheet.map((s) => [s.id, s]));

  const seen = new Set<string>();
  const priority: Song[] = [];
  const push = (id: string) => {
    const song = byId.get(id);
    if (song && !seen.has(id)) {
      seen.add(id);
      priority.push(song);
    }
  };

  // Priority 1 — upcoming-event songs
  try {
    (await upcomingEventSongIds(opts)).forEach(push);
  } catch {
    /* skip tier on any failure */
  }

  // Priority 2 — member favorites
  if (opts.userId) {
    try {
      const { data: favs } = await supabase
        .from('user_favorites')
        .select('song_id')
        .eq('user_id', opts.userId);
      (favs || []).forEach((f: any) => push(f.song_id));
    } catch {
      /* skip tier */
    }
  }

  // Priority 3 — everything else (already newest-first)
  const p3 = withSheet.filter((s) => !seen.has(s.id));
  return { p12: priority, p3 };
}

async function countCached(
  cache: Cache,
  songs: Array<{ sheet_music_url: string | null; updated_at?: string | null }>
): Promise<number> {
  let n = 0;
  for (const s of songs) {
    if (s.sheet_music_url && (await cache.match(cacheUrl(s.sheet_music_url, s.updated_at)))) n++;
  }
  return n;
}

// ── Queue runner (concurrency BATCH_SIZE, paused while offline) ──
let running = false;

async function runQueue(queue: Song[]): Promise<void> {
  if (running || !CACHES_OK || queue.length === 0) return;
  running = true;
  try {
    const cache = await getPdfCache();

    const pending: Song[] = [];
    let cached = 0;
    for (const song of queue) {
      if (await cache.match(cacheUrl(song.sheet_music_url!, song.updated_at))) cached++;
      else pending.push(song);
    }
    setProgress({ total: queue.length, cached, downloading: pending.length > 0 });

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      await waitWhileOffline(); // pause immediately when offline, resume on online
      const batch = pending.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (song) => {
          const url = cacheUrl(song.sheet_music_url!, song.updated_at);
          try {
            if (await cache.match(url)) {
              setProgress({ cached: progress.cached + 1 });
              return;
            }
            const res = await fetch(url);
            if (res.ok) {
              await cache.put(url, res.clone());
              setProgress({ cached: progress.cached + 1 });
            }
          } catch {
            /* leave uncached; retried next session */
          }
        })
      );
      if (i + BATCH_SIZE < pending.length) await sleep(BATCH_PAUSE_MS);
    }
  } finally {
    setProgress({ downloading: false });
    running = false;
  }
}

// ── Public API ──
let autoStarted = false;

/**
 * Auto background caching. Starts 8s after app load, online only. Caches ONLY
 * priority tiers 1–2 (upcoming-event setlist + favorites), regardless of
 * connection type — the full library is opt-in via the Profile "Download all
 * now" button. Safe to call repeatedly — runs at most once/session.
 */
export function startBackgroundCache(opts: BackgroundCacheOpts = {}): void {
  if (autoStarted || !CACHES_OK) return;
  autoStarted = true;
  window.setTimeout(async () => {
    if (!navigator.onLine) return; // try again on the next app load
    try {
      const { p12 } = await buildQueue(opts);
      await runQueue(p12); // tiers 1-2 only
    } catch {
      /* never surface background errors to the user */
    }
  }, START_DELAY_MS);
}

/**
 * Force-download the entire queue regardless of connection type. Backs the
 * "Download all now" button on the member Profile page.
 */
export async function downloadAllNow(opts: BackgroundCacheOpts = {}): Promise<void> {
  if (!CACHES_OK) return;
  const { p12, p3 } = await buildQueue(opts);
  await runQueue([...p12, ...p3]);
}

/**
 * READ-ONLY offline status: how many songs are already in the PDF cache, out of
 * the total that have a sheet. Opens the cache and runs cache.match only — ZERO
 * fetches, ZERO downloads. Safe to call on page mount (e.g. the Profile page).
 */
export async function getCacheStatus(
  opts: BackgroundCacheOpts = {}
): Promise<{ priority: { cached: number; total: number }; full: { cached: number; total: number } }> {
  const empty = { priority: { cached: 0, total: 0 }, full: { cached: 0, total: 0 } };
  if (!CACHES_OK) return empty;
  const { p12, p3 } = await buildQueue(opts); // read-only (DB reads); no fetches
  const all = [...p12, ...p3];
  const cache = await getPdfCache();
  return {
    priority: { cached: await countCached(cache, p12), total: p12.length }, // Sunday-ready (tiers 1-2)
    full: { cached: await countCached(cache, all), total: all.length },     // whole library
  };
}
