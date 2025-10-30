// EGMC Choir App - Service Worker for Offline Support
// Version: 1.0.0

const CACHE_NAME = 'egmc-choir-v1';
const SUPABASE_CACHE = 'egmc-supabase-v1';
const PDF_CACHE = 'egmc-pdfs-v1';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
        .catch(err => {
          console.warn('[Service Worker] Failed to cache some assets:', err);
          // Don't fail installation if some assets can't be cached
        });
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name !== CACHE_NAME && 
                   name !== SUPABASE_CACHE && 
                   name !== PDF_CACHE;
          })
          .map((name) => {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim(); // Take control immediately
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Strategy 1: Supabase API calls (Network First, fallback to Cache)
  if (url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response before caching
          const responseClone = response.clone();
          
          // Cache successful GET requests
          if (request.method === 'GET' && response.ok) {
            caches.open(SUPABASE_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[Service Worker] Serving Supabase data from cache');
              return cachedResponse;
            }
            // Return a basic error response
            return new Response(
              JSON.stringify({ error: 'Offline - no cached data available' }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // Strategy 2: PDF files (Cache First, fallback to Network)
  if (request.url.endsWith('.pdf') || url.pathname.includes('/storage/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[Service Worker] Serving PDF from cache:', request.url);
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request).then((response) => {
          // Clone and cache if successful
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(PDF_CACHE).then((cache) => {
              cache.put(request, responseClone);
              console.log('[Service Worker] Cached PDF:', request.url);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Strategy 3: Static assets (Cache First, fallback to Network)
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          // Cache successful responses for static assets
          if (response.ok && 
              (request.url.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|ttf)$/) ||
               request.url === url.origin + '/')) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(CACHE_NAME),
        caches.delete(SUPABASE_CACHE),
        caches.delete(PDF_CACHE)
      ]).then(() => {
        console.log('[Service Worker] All caches cleared');
        // Notify all clients
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'CACHE_CLEARED' });
          });
        });
      })
    );
  }

  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      Promise.all([
        caches.open(CACHE_NAME).then(cache => cache.keys()),
        caches.open(SUPABASE_CACHE).then(cache => cache.keys()),
        caches.open(PDF_CACHE).then(cache => cache.keys())
      ]).then(([staticKeys, supabaseKeys, pdfKeys]) => {
        const stats = {
          static: staticKeys.length,
          supabase: supabaseKeys.length,
          pdfs: pdfKeys.length,
          total: staticKeys.length + supabaseKeys.length + pdfKeys.length
        };
        
        // Send back to the requesting client
        event.source.postMessage({
          type: 'CACHE_SIZE_RESPONSE',
          stats
        });
      })
    );
  }
});
