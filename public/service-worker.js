// EGMC Choir App - Service Worker for Offline Support
// IMPORTANT: Bump this version string on every deploy
const SW_VERSION = '2.3.0';
const CACHE_NAME = `egmc-choir-${SW_VERSION}`;
const SUPABASE_CACHE = `egmc-supabase-${SW_VERSION}`;
const PDF_CACHE = `egmc-pdfs-${SW_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install - cache static assets. Do NOT skipWaiting here: a new SW now WAITS so
// the app can prompt the user; it activates only on SKIP_WAITING (Update button)
// or when all tabs close. (First-ever install still activates immediately since
// there is no controller to replace.)
self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(
        STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' }))
      ).catch(err => {
        console.warn('[SW] Failed to cache some assets:', err);
      });
    })
  );
});

// Activate - delete ALL old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activating...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== SUPABASE_CACHE && name !== PDF_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch - NETWORK FIRST for navigation and JS/CSS, cache-first for media
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Sheet-music PDFs in Supabase Storage: NETWORK-FIRST. Storage serves these
  // with `cache-control: no-cache`, and an edited/replaced sheet must show fresh
  // on the next online open — so we fetch from the network (the browser HTTP
  // cache revalidates via etag: cheap 304 when unchanged, fresh 200 when changed)
  // and update PDF_CACHE for offline. Only when the network fails (offline) do we
  // fall back to the cached copy. (CacheFirst here served stale bytes whenever the
  // ?v= key hadn't changed — the cause of "edited song shows the old PDF".)
  // Must come BEFORE the general Supabase branch so it wins for storage PDFs.
  if (url.pathname.includes('/storage/v1/object/public/choirhub_partitions')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(PDF_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Supabase API: Network first
  if (url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (request.method === 'GET' && response.ok) {
            const clone = response.clone();
            caches.open(SUPABASE_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cached => {
            return cached || new Response(
              JSON.stringify({ error: 'Offline - no cached data available' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // KEY FIX: Navigation requests & JS/CSS/HTML → NETWORK FIRST
  if (request.mode === 'navigate' || 
      request.url.match(/\.(js|css|html)(\?.*)?$/)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Everything else (images, fonts): Cache first
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  }
});

// Message handler
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(CACHE_NAME),
        caches.delete(SUPABASE_CACHE),
        caches.delete(PDF_CACHE)
      ]).then(() => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'CACHE_CLEARED' }));
        });
      })
    );
  }

  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
  }
});




