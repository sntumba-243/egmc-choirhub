// Background PDF pre-caching for ChoirHub member portal.
//
// Quietly downloads song sheet-music PDFs (via /api/pdf-proxy) into the
// service worker's PDF cache while the member is online, so previously
// unopened songs still work offline. Invisible during normal use — the only
// surface is the "Offline songs" row on the member Profile page.
//
// NOTE: the service worker does not have a dedicated /api/pdf-proxy caching
// rule (its generic branch would store proxy responses in the app cache, not
// egmc-pdfs), so this module writes responses into the egmc-pdfs-* cache
// itself. The SW's generic branch serves them back offline via caches.match().

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
const DRIVE_RE = /drive\.google\.com\/file\/d\/([^/]+)/;
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
function fileIdOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(DRIVE_RE);
  return m ? m[1] : null;
}

// Must match SheetMusicViewer.getDirectUrl exactly so the pre-cached key is the
// one the viewer later requests (append version only when present).
function proxyUrl(fileId: string, version?: string | null): string {
  const base = '/api/pdf-proxy?fileId=' + fileId;
  return version ? base + '&v=' + encodeURIComponent(version) : base;
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

function isCellular(): boolean {
  // navigator.connection is absent on iOS Safari — treat unknown as non-cellular
  // and proceed (the Capacitor native build can refine this later).
  const c = (navigator as any).connection;
  return !!(c && c.type === 'cellular');
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

  const withDrive = (allSongs as Song[]).filter((s) => fileIdOf(s.sheet_music_url));
  const byId = new Map(withDrive.map((s) => [s.id, s]));

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
  const p3 = withDrive.filter((s) => !seen.has(s.id));
  return { p12: priority, p3 };
}

async function countCached(cache: Cache, songs: Song[]): Promise<number> {
  let n = 0;
  for (const s of songs) {
    const id = fileIdOf(s.sheet_music_url);
    if (id && (await cache.match(proxyUrl(id, s.updated_at)))) n++;
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
      const id = fileIdOf(song.sheet_music_url)!;
      if (await cache.match(proxyUrl(id, song.updated_at))) cached++;
      else pending.push(song);
    }
    setProgress({ total: queue.length, cached, downloading: pending.length > 0 });

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      await waitWhileOffline(); // pause immediately when offline, resume on online
      const batch = pending.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (song) => {
          const id = fileIdOf(song.sheet_music_url)!;
          const url = proxyUrl(id, song.updated_at);
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
 * Auto background caching. Starts 8s after app load, online only. On cellular
 * connections it caches only priority tiers 1–2 (upcoming events + favorites)
 * and stops before tier 3. Safe to call repeatedly — runs at most once/session.
 */
export function startBackgroundCache(opts: BackgroundCacheOpts = {}): void {
  if (autoStarted || !CACHES_OK) return;
  autoStarted = true;
  window.setTimeout(async () => {
    if (!navigator.onLine) return; // try again on the next app load
    try {
      const { p12, p3 } = await buildQueue(opts);
      const queue = isCellular() ? p12 : [...p12, ...p3];
      await runQueue(queue);
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
 * Compute how many queued songs are already available offline, without
 * downloading anything. Used by the Profile "X of Y" display.
 */
export async function computeOfflineStatus(
  opts: BackgroundCacheOpts = {}
): Promise<{ total: number; cached: number }> {
  if (!CACHES_OK) return { total: 0, cached: 0 };
  const { p12, p3 } = await buildQueue(opts);
  const all = [...p12, ...p3];
  const cache = await getPdfCache();
  return { total: all.length, cached: await countCached(cache, all) };
}
