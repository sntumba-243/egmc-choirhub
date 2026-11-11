// EGMC Choir App - Service Worker for Offline Support
//
// Version + precache list are INJECTED AT BUILD by the `sw-precache` plugin in
// vite.config.ts (every build gets a unique version, so the SW byte-changes on
// every deploy and the in-app update flow fires). Do not hand-edit these two
// lines; in `vite dev` they keep their placeholder values and nothing is precached.
const SW_VERSION = 'dev';
const PRECACHE_URLS = /*__PRECACHE_MANIFEST__*/[];

// App shell: versioned — replaced wholesale on each deploy (hashed assets).
const SHELL_CACHE = `egmc-shell-${SW_VERSION}`;
// Member data: STABLE names — must survive deploys. (Versioning these was what
// silently wiped every downloaded sheet each time SW_VERSION was bumped.)
const PDF_CACHE = 'egmc-pdfs';
const DATA_CACHE = 'egmc-data';

// Network-first falls back to cache after this long when a cached copy exists,
// so weak church Wi-Fi ("lie-fi") doesn't hang the UI. The network request
// still completes in the background and refreshes the cache.
const NETWORK_TIMEOUT_MS = 4000;

// Synthetic offline responses carry this header so the app can tell
// "device offline" apart from "server down" (see autoFailover).
const OFFLINE_HEADER = 'X-ChoirHub-Offline';

// ── Install: precache the WHOLE app shell (index.html + every built asset) ──
// Without this, a first visit cached only index.html: the JS/CSS bundles were
// requested before the SW controlled the page, and production serves them with
// `max-age=0, must-revalidate`, so the HTTP cache can't help offline either →
// white screen. addAll is atomic: if any asset fails the install fails and the
// previous SW keeps serving (better than activating a half-cached shell).
// Do NOT skipWaiting here: the update banner activates via SKIP_WAITING.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(['/index.html', ...PRECACHE_URLS].map((url) => new Request(url, { cache: 'reload' })))
    )
  );
});

// ── Activate: drop old SHELL caches, migrate legacy versioned data caches ──
async function migrateInto(targetName, prefix) {
  const names = (await caches.keys()).filter((n) => n.startsWith(prefix));
  if (!names.length) return;
  const target = await caches.open(targetName);
  for (const name of names) {
    const old = await caches.open(name);
    for (const req of await old.keys()) {
      if (!(await target.match(req, { ignoreVary: true }))) {
        const res = await old.match(req, { ignoreVary: true });
        if (res) await target.put(req, res);
      }
    }
    await caches.delete(name);
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Older SWs used egmc-pdfs-<ver> / egmc-supabase-<ver> (and the app wrote
    // egmc-pdfs-2.0.0). Fold them into the stable caches instead of deleting.
    await migrateInto(PDF_CACHE, 'egmc-pdfs-');
    await migrateInto(DATA_CACHE, 'egmc-supabase-');
    const keep = new Set([SHELL_CACHE, PDF_CACHE, DATA_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !keep.has(n) && (n.startsWith('egmc-choir-') || n.startsWith('egmc-shell-'))).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Network-first with a timeout fallback to cache. Only plain 200s are stored
// (a 206 range response cannot be cache.put()).
function networkFirst(event, cacheName, offlineFallback) {
  const { request } = event;
  const network = fetch(request).then((response) => {
    if (response.status === 200) {
      const clone = response.clone();
      event.waitUntil(caches.open(cacheName).then((c) => c.put(request, clone)).catch(() => {}));
    }
    return response;
  });
  const cached = () => caches.match(request, { ignoreVary: true });

  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (!settled && r) { settled = true; resolve(r); return true; } return false; };
    const timer = setTimeout(() => { cached().then((r) => done(r)); }, NETWORK_TIMEOUT_MS);
    network
      .then((r) => { clearTimeout(timer); done(r); })
      .catch(async () => {
        clearTimeout(timer);
        if (!done(await cached())) done(offlineFallback());
      });
  });
}

const offlineJson = () => new Response(
  JSON.stringify({ message: 'Offline - no cached data available' }),
  { status: 503, headers: { 'Content-Type': 'application/json', [OFFLINE_HEADER]: '1' } }
);
const offlineError = () => Response.error();

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // POST/PATCH/HEAD etc. go straight to network
  const url = new URL(request.url);

  // Sheet-music PDFs in Supabase Storage → network-first (an edited sheet must
  // show fresh online; the ?v= param also changes on edit), cache for offline.
  // A Range request bypasses the SW entirely (the viewer disables ranges).
  if (url.pathname.includes('/storage/v1/object/public/choirhub_partitions')) {
    if (request.headers.has('range')) return;
    event.respondWith(networkFirst(event, PDF_CACHE, offlineError));
    return;
  }

  // Supabase REST reads → network-first, cached so lists render offline.
  // Auth endpoints are never cached (they carry tokens).
  if (url.hostname.includes('supabase') && url.pathname.startsWith('/rest/v1/')) {
    event.respondWith(networkFirst(event, DATA_CACHE, offlineJson));
    return;
  }

  if (url.origin !== self.location.origin) return; // other third parties: untouched

  // Version poll must always hit the network (and never pile up cache entries).
  if (url.pathname === '/version.json' || url.pathname.startsWith('/api/')) return;

  // Navigations (any route, incl. deep links like /member/repertoire) → network,
  // falling back to the precached index.html of THIS SW's build so the shell
  // and its hashed assets always match.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(SHELL_CACHE).then((c) => c.match('/index.html')).then((r) => r || caches.match('/index.html'))
      )
    );
    return;
  }

  // Hashed build assets are immutable → cache-first from the precache.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.put(request, clone)));
        }
        return response;
      }))
    );
    return;
  }

  // Other same-origin files (icons, manifest): network-first, cache fallback.
  event.respondWith(networkFirst(event, SHELL_CACHE, offlineError));
});

// Message handler
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(SHELL_CACHE),
        caches.delete(DATA_CACHE),
        caches.delete(PDF_CACHE)
      ]).then(() => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'CACHE_CLEARED' }));
        });
      })
    );
  }

  // Logout: cached API responses are keyed by URL only, so drop them so the
  // next person on a shared device can't read them offline. PDFs are public.
  if (event.data?.type === 'CLEAR_DATA_CACHE') {
    event.waitUntil(caches.delete(DATA_CACHE));
  }

  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
  }
});
