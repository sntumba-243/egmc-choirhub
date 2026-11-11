// Offline sheet music: automatic full-library download + keeping it current.
//
// On every app open (member portal) while online, this:
//   1. fetches, in ONE request each: the song list, the bucket manifest
//      (partition_manifest(): file name + etag), upcoming events + their
//      setlists, and the member's favorites;
//   2. drops saved copies of songs that no longer exist (or whose sheet moved);
//   3. downloads what is missing or out of date, in this order:
//        event songs (ALL upcoming events the member can see) → favorites → rest.
// The first full download starts by itself after sign-in (no prompt). If it is
// interrupted it resumes on the next online open — saved files are skipped, so
// it never restarts from zero. Where the browser reports a cellular connection
// (Android Chrome), the rest of the library waits for Wi-Fi until the first
// full download has completed once; event songs and favorites go right away.
// iPhone/iPad don't report the connection type, so they download anyway.
//
// CHANGE DETECTION: songs are usually fixed by replacing the PDF in the bucket
// under the SAME name without touching the songs row, so the cache key (URL +
// songs.updated_at, see SheetMusicViewer.getDirectUrl) doesn't change. Each
// saved PDF therefore carries the bucket etag it was downloaded at (header
// X-ChoirHub-ETag on the cached copy); a different etag in the manifest means
// "re-download". Storage doesn't expose its ETag header to the browser, which
// is why the etag comes from the manifest and is stored by us.
//
// The cache key MUST match SheetMusicViewer.getDirectUrl exactly so the copies
// this writes are the ones the viewer requests offline.

import { supabase } from './supabase';
import { fetchAllSongs, getOfflineData, putOfflineData } from './offlineCache';
import { storageGet, storageSet } from './safeStorage';

// ── Types ──
export interface CacheProgress {
  total: number;
  cached: number;
  failed: number;          // failed this run (network/HTTP error) — retried on the next open
  downloading: boolean;
  waitingForWifi: boolean; // first full download paused on a cellular connection
}

interface Song {
  id: string;
  title: string;
  sheet_music_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface Item {
  song: Song;
  key: string;           // cache key = viewer URL
  etag: string | null;   // bucket etag; null when the manifest is unavailable (offline)
  gated: boolean;        // may wait for Wi-Fi (rest-of-library tier, first full download only)
}

interface Plan {
  event: Item[];
  fav: Item[];
  rest: Item[];
  online: boolean;       // song list AND manifest came from the network (safe to prune)
}

export interface BackgroundCacheOpts {
  userId?: string;
  churchId?: string;
}

// ── Constants ──
// STABLE name shared with public/service-worker.js (PDF_CACHE).
const PDF_CACHE = 'egmc-pdfs';
export const ETAG_HEADER = 'X-ChoirHub-ETag';
// Set once the whole library has been saved on this device (ends the Wi-Fi wait).
const FULL_DONE_KEY = 'choirhub_offline_full_done';
const BUCKET_PATH = '/storage/v1/object/public/choirhub_partitions/';
const FETCH_TIMEOUT_MS = 60000;
const START_DELAY_MS = 4000;
const BATCH_SIZE = 2;
const BATCH_PAUSE_MS = 300;
const CACHES_OK = typeof caches !== 'undefined';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Progress store (tiny emitter) ──
let progress: CacheProgress = { total: 0, cached: 0, failed: 0, downloading: false, waitingForWifi: false };
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
// Same string SheetMusicViewer.getDirectUrl builds, normalised the way the
// Cache API normalises request URLs (so keys compare equal when pruning).
function cacheUrl(sheetUrl: string, version?: string | null): string {
  const raw = sheetUrl + (sheetUrl.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(version || '');
  try { return new URL(raw).href; } catch { return raw; }
}

// Download URL: same file, with `_dl=<etag>` so that
//  • the service worker passes it straight to the network (it would otherwise
//    store an un-tagged copy), and
//  • each file VERSION has its own URL. Storage sits behind a CDN that caches
//    every URL for an hour and purges a replaced file only after a short delay;
//    re-using the viewer URL right after a replacement could fetch the OLD
//    bytes and store them under the NEW etag — stale forever. A URL that
//    contains the new etag can't be answered from the old version's CDN entry.
const downloadUrl = (it: Item) =>
  it.key + '&_dl=' + encodeURIComponent((it.etag || '').replace(/"/g, '') || String(Date.now()));

function objectName(sheetUrl: string): string | null {
  const i = sheetUrl.indexOf(BUCKET_PATH);
  if (i < 0) return null;
  const path = sheetUrl.slice(i + BUCKET_PATH.length).split(/[?#]/)[0];
  try { return decodeURIComponent(path); } catch { return path; }
}

function localYmd(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
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

// Android Chrome reports the connection type; iOS Safari / desktop don't (→ not cellular).
function onCellular(): boolean {
  const type = (navigator as any).connection?.type;
  return type === 'cellular' || type === 'bluetooth' || type === 'wimax';
}

let wifiOverride = false; // the member tapped Download/Resume/Retry: don't wait for Wi-Fi

async function waitForWifi(): Promise<void> {
  if (!onCellular() || wifiOverride) return;
  setProgress({ waitingForWifi: true });
  while (onCellular() && !wifiOverride) await sleep(2000);
  setProgress({ waitingForWifi: false });
}

const isFullDone = () => storageGet(FULL_DONE_KEY) === '1';

// ── Data for the plan (one request per kind, never one per song) ──
async function fetchManifest(): Promise<Map<string, string> | null> {
  // The exported client can be the Neon failover client, which has no rpc():
  // then there's no manifest and saved copies are simply kept as they are.
  const client = supabase as any;
  if (typeof client.rpc !== 'function') return null;
  try {
    const { data, error } = await client.rpc('partition_manifest');
    if (error || !Array.isArray(data)) return null;
    return new Map((data as Array<{ name: string; etag: string | null }>).map((o) => [o.name, o.etag || '']));
  } catch {
    return null;
  }
}

// Songs on the setlists of ALL upcoming events the member can see. RLS on
// `events` already limits this to their church's events + global events
// targeted at their church (and event visibility rules). Ordered by event date,
// then setlist order.
async function upcomingEventSongIds(): Promise<string[]> {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, date')
    .gte('last_date', localYmd())
    .order('date', { ascending: true })
    .limit(500);
  if (error || !events?.length) return [];
  const rank = new Map((events as any[]).map((e, i) => [e.id, i]));
  const { data: rows, error: e2 } = await supabase
    .from('event_songs')
    .select('event_id, song_id, song_order')
    .in('event_id', [...rank.keys()]);
  if (e2 || !rows) return [];
  return (rows as any[])
    .sort((a, b) => (rank.get(a.event_id)! - rank.get(b.event_id)!) || ((a.song_order ?? 0) - (b.song_order ?? 0)))
    .map((r) => r.song_id);
}

async function favoriteSongIds(userId?: string): Promise<string[]> {
  if (!userId) return [];
  const { data, error } = await supabase.from('user_favorites').select('song_id').eq('user_id', userId);
  if (error || !data) return [];
  return (data as any[]).map((f) => f.song_id);
}

// ── Build the prioritized, de-duplicated plan ──
async function buildPlan(opts: BackgroundCacheOpts): Promise<Plan> {
  // Whole library, newest first. Online: also refresh the offline list snapshot
  // (what Repertoire renders offline). Offline: use that snapshot.
  let allSongs: Song[] | null = null;
  let songsOnline = false;
  try {
    allSongs = await fetchAllSongs(supabase);
    songsOnline = true;
    putOfflineData('songs', allSongs).catch(() => {});
  } catch {
    allSongs = (await getOfflineData('songs').catch(() => null)) as Song[] | null;
  }
  if (!allSongs) return { event: [], fav: [], rest: [], online: false };

  const [manifest, eventIds, favIds] = await Promise.all([
    fetchManifest(),
    upcomingEventSongIds().catch(() => [] as string[]),
    favoriteSongIds(opts.userId).catch(() => [] as string[]),
  ]);

  const toItem = (s: Song): Item | null => {
    if (!s.sheet_music_url?.trim()) return null;
    let etag: string | null = null;
    if (manifest) {
      const name = objectName(s.sheet_music_url);
      // Online and the file isn't in the bucket: nothing to download (it would fail every time).
      if (name !== null) {
        if (!manifest.has(name)) return null;
        etag = manifest.get(name)!;
      }
    }
    return { song: s, key: cacheUrl(s.sheet_music_url, s.updated_at), etag, gated: false };
  };

  const byId = new Map<string, Item>();
  for (const s of allSongs) {
    const it = toItem(s);
    if (it) byId.set(s.id, it);
  }

  const seen = new Set<string>();
  const take = (ids: string[]) => {
    const out: Item[] = [];
    for (const id of ids) {
      const it = byId.get(id);
      if (it && !seen.has(id)) { seen.add(id); out.push(it); }
    }
    return out;
  };
  const event = take(eventIds);
  const fav = take(favIds);
  const rest = [...byId.values()].filter((it) => !seen.has(it.song.id)).map((it) => ({ ...it, gated: true }));
  return { event, fav, rest, online: songsOnline && !!manifest };
}

// ── Saved-copy state ──
type State = 'current' | 'stale' | 'missing';

async function stateOf(cache: Cache, it: Item): Promise<State> {
  const r = await cache.match(it.key, { ignoreVary: true });
  if (!r) return 'missing';
  if (it.etag === null) return 'current'; // offline: can't compare, the saved copy is what we have
  return r.headers.get(ETAG_HEADER) === it.etag ? 'current' : 'stale';
}

// Remove saved copies that no song points to any more (song deleted, sheet
// moved, songs.updated_at changed → new key). Only with a complete online plan.
async function prune(cache: Cache, plan: Plan): Promise<number> {
  if (!plan.online) return 0;
  const keep = new Set([...plan.event, ...plan.fav, ...plan.rest].map((it) => it.key));
  let removed = 0;
  for (const req of await cache.keys()) {
    if (!keep.has(req.url)) {
      await cache.delete(req, { ignoreVary: true });
      removed++;
    }
  }
  return removed;
}

// ── Queue runner (concurrency BATCH_SIZE, paused while offline) ──
let running = false;

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try { return await fetch(url, { signal: ctrl.signal, cache: 'no-store' }); } finally { window.clearTimeout(t); }
}

async function downloadOne(cache: Cache, it: Item): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(downloadUrl(it));
    if (res.status !== 200) return false;
    const body = await res.blob();
    await cache.put(it.key, new Response(body, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/pdf',
        [ETAG_HEADER]: it.etag || '',
      },
    }));
    return true;
  } catch {
    return false;
  }
}

export interface RunResult { total: number; cached: number; failed: number }

async function runQueue(queue: Item[], gateForWifi: boolean): Promise<RunResult> {
  const cache = await caches.open(PDF_CACHE);
  let pending: Item[] = [];
  let cached = 0;
  for (const it of queue) {
    if ((await stateOf(cache, it)) === 'current') cached++;
    else pending.push(it);
  }
  setProgress({ total: queue.length, cached, failed: 0, downloading: pending.length > 0 });

  // Two passes: anything that failed in pass 1 (blip, timeout) is retried once.
  for (let pass = 0; pass < 2 && pending.length; pass++) {
    const failed: Item[] = [];
    for (let i = 0; i < pending.length; ) {
      await waitWhileOffline(); // pause while offline, resume on 'online'
      // A batch never mixes event songs/favorites with rest-of-library songs:
      // otherwise an event song paired with a gated song would wait for Wi-Fi too.
      let end = i + 1;
      while (end < pending.length && end - i < BATCH_SIZE && pending[end].gated === pending[i].gated) end++;
      const batch = pending.slice(i, end);
      if (gateForWifi && batch[0].gated) await waitForWifi();
      const ok = await Promise.all(batch.map((it) => downloadOne(cache, it)));
      ok.forEach((good, k) => (good ? setProgress({ cached: progress.cached + 1 }) : failed.push(batch[k])));
      i = end;
      if (i < pending.length) await sleep(BATCH_PAUSE_MS);
    }
    pending = failed;
    setProgress({ failed: failed.length });
  }
  return { total: progress.total, cached: progress.cached, failed: progress.failed };
}

async function sync(opts: BackgroundCacheOpts, gateForWifi: boolean): Promise<RunResult> {
  if (!CACHES_OK) return { total: 0, cached: 0, failed: 0 };
  while (running) await sleep(500);
  running = true;
  try {
    const plan = await buildPlan(opts);
    const cache = await caches.open(PDF_CACHE);
    await prune(cache, plan);
    const queue = [...plan.event, ...plan.fav, ...plan.rest];
    if (!queue.length) return { total: 0, cached: 0, failed: 0 };
    const result = await runQueue(queue, gateForWifi && !isFullDone());
    if (plan.online && result.total > 0 && result.cached >= result.total) storageSet(FULL_DONE_KEY, '1');
    return result;
  } finally {
    setProgress({ downloading: false, waitingForWifi: false });
    running = false;
  }
}

// ── Public API ──
let autoStarted = false;

/**
 * Called by the member layout once the member is signed in. Once per app open:
 * waits until online, then syncs (prune → download missing/changed, priority
 * order). The first run on a device downloads the whole library automatically.
 */
export function startBackgroundCache(opts: BackgroundCacheOpts = {}): void {
  if (autoStarted || !CACHES_OK) return;
  autoStarted = true;
  // Ask the browser not to evict ~500 sheets under storage pressure.
  try { navigator.storage?.persist?.(); } catch { /* best-effort */ }
  window.setTimeout(async () => {
    try {
      await waitWhileOffline();
      await sync(opts, true);
    } catch {
      /* never surface background errors to the user */
    }
  }, START_DELAY_MS);
}

/**
 * Profile "Download all now / Resume / Retry": run now, without waiting for Wi-Fi
 * (the member asked for it explicitly).
 */
export async function downloadAllNow(opts: BackgroundCacheOpts = {}): Promise<RunResult> {
  if (!CACHES_OK) throw new Error('Offline storage is not available in this browser');
  wifiOverride = true;
  try { await navigator.storage?.persist?.(); } catch { /* best-effort */ }
  return sync(opts, false);
}

/**
 * READ-ONLY status for the Profile page: how many sheets are saved AND current,
 * for upcoming-event songs and for the whole library. No downloads.
 */
export async function getCacheStatus(
  opts: BackgroundCacheOpts = {}
): Promise<{ priority: { cached: number; total: number }; full: { cached: number; total: number } }> {
  const empty = { priority: { cached: 0, total: 0 }, full: { cached: 0, total: 0 } };
  if (!CACHES_OK) return empty;
  const plan = await buildPlan(opts);
  const cache = await caches.open(PDF_CACHE);
  const count = async (items: Item[]) => {
    let n = 0;
    for (const it of items) if ((await stateOf(cache, it)) === 'current') n++;
    return n;
  };
  const all = [...plan.event, ...plan.fav, ...plan.rest];
  return {
    priority: { cached: await count(plan.event), total: plan.event.length }, // "Event songs ready"
    full: { cached: await count(all), total: all.length },
  };
}
