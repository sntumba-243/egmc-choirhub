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
import { fetchAllSongs, getOfflineData, putOfflineData } from './offlineCache';
import { storageGet, storageSet } from './safeStorage';

// ── Types ──
export interface CacheProgress {
  total: number;
  cached: number;
  failed: number;       // fetch failed this run (offline/network/HTTP error) — retried on resume
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
// STABLE name shared with public/service-worker.js (PDF_CACHE). It used to be
// versioned (egmc-pdfs-<SW_VERSION>), so every SW bump deleted every downloaded
// sheet; the SW now migrates any legacy egmc-pdfs-* into this one on activate.
const PDF_CACHE = 'egmc-pdfs';
// Set when the member taps "Download all": every later app launch resumes the
// full-library download (new/edited songs, anything that failed) automatically.
const FULL_LIBRARY_KEY = 'choirhub_offline_full_library';
const FETCH_TIMEOUT_MS = 60000;
const START_DELAY_MS = 8000;
const BATCH_SIZE = 2;
const BATCH_PAUSE_MS = 500;
const CACHES_OK = typeof caches !== 'undefined';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Progress store (tiny emitter) ──
let progress: CacheProgress = { total: 0, cached: 0, failed: 0, downloading: false };
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

function getPdfCache(): Promise<Cache> {
  return caches.open(PDF_CACHE);
}

// cache.match ignoring Vary so a Storage `Vary: Origin` can't hide an entry.
const has = async (cache: Cache, url: string) => !!(await cache.match(url, { ignoreVary: true }));

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

  let query = supabase.from('events').select('id, date').gte('last_date', todayStr).lte('date', in14Str);
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
  // Whole library, newest first (priority 3 order). Online: fetch it and refresh
  // the offline list snapshot (what Repertoire renders offline). Offline: use
  // that snapshot, so status counts still work with no network.
  let allSongs: Song[] | null = null;
  try {
    allSongs = await fetchAllSongs(supabase);
    putOfflineData('songs', allSongs).catch(() => {});
  } catch {
    allSongs = (await getOfflineData('songs').catch(() => null)) as Song[] | null;
  }
  if (!allSongs) return { p12: [], p3: [] };

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
    if (s.sheet_music_url && (await has(cache, cacheUrl(s.sheet_music_url, s.updated_at)))) n++;
  }
  return n;
}

// ── Queue runner (concurrency BATCH_SIZE, paused while offline) ──
let running = false;

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try { return await fetch(url, { signal: ctrl.signal }); } finally { window.clearTimeout(t); }
}

async function downloadOne(cache: Cache, song: Song): Promise<boolean> {
  const url = cacheUrl(song.sheet_music_url!, song.updated_at);
  try {
    if (await has(cache, url)) return true;
    const res = await fetchWithTimeout(url);
    if (res.status !== 200) return false;
    // The SW also stores it (network-first branch); writing here makes this
    // independent of whether a SW controls the page.
    await cache.put(url, res);
    return true;
  } catch {
    return false;
  }
}

export interface RunResult { total: number; cached: number; failed: number }

async function runQueue(queue: Song[]): Promise<RunResult> {
  if (running || !CACHES_OK || queue.length === 0) return { ...progress };
  running = true;
  try {
    const cache = await getPdfCache();

    let pending: Song[] = [];
    let cached = 0;
    for (const song of queue) {
      if (await has(cache, cacheUrl(song.sheet_music_url!, song.updated_at))) cached++;
      else pending.push(song);
    }
    setProgress({ total: queue.length, cached, failed: 0, downloading: pending.length > 0 });

    // Two passes: anything that failed in pass 1 (blip, timeout) is retried once.
    for (let pass = 0; pass < 2 && pending.length; pass++) {
      const failed: Song[] = [];
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        await waitWhileOffline(); // pause while offline, resume on 'online'
        const batch = pending.slice(i, i + BATCH_SIZE);
        const ok = await Promise.all(batch.map((song) => downloadOne(cache, song)));
        ok.forEach((good, k) => (good ? setProgress({ cached: progress.cached + 1 }) : failed.push(batch[k])));
        if (i + BATCH_SIZE < pending.length) await sleep(BATCH_PAUSE_MS);
      }
      pending = failed;
      setProgress({ failed: failed.length });
    }
    return { total: progress.total, cached: progress.cached, failed: progress.failed };
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
      const { p12, p3 } = await buildQueue(opts);
      // Member opted into the full library → resume it (new songs, edited
      // sheets, earlier failures). Otherwise tiers 1-2 only.
      await runQueue(isFullLibraryEnabled() ? [...p12, ...p3] : p12);
    } catch {
      /* never surface background errors to the user */
    }
  }, START_DELAY_MS);
}

/**
 * Force-download the entire queue regardless of connection type. Backs the
 * "Download all now" button on the member Profile page.
 */
export async function downloadAllNow(opts: BackgroundCacheOpts = {}): Promise<RunResult> {
  if (!CACHES_OK) throw new Error('Offline storage is not available in this browser');
  storageSet(FULL_LIBRARY_KEY, '1');
  // Ask the browser not to evict ~500 sheets under storage pressure.
  try { await navigator.storage?.persist?.(); } catch { /* best-effort */ }
  // A background run may be in flight (auto tiers 1-2): let it finish, then run
  // the full queue — otherwise runQueue would no-op and report stale numbers.
  while (running) await sleep(500);
  const { p12, p3 } = await buildQueue(opts);
  return runQueue([...p12, ...p3]);
}

export function isFullLibraryEnabled(): boolean {
  return storageGet(FULL_LIBRARY_KEY) === '1';
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
