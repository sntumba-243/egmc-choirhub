// Version baked into THIS running bundle at build time (vite `define`).
const APP_VERSION = typeof __APP_BUILD_VERSION__ !== 'undefined' ? __APP_BUILD_VERSION__ : null;
let swRegistration = null;

// Surface "a new version is available" to the UpdateBanner. Never auto-reloads —
// the user decides via the banner's Update button.
function announceUpdate(source) {
  window.dispatchEvent(new CustomEvent('app-update-available', { detail: { source, registration: swRegistration } }));
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Was this page already SW-controlled at load? Used so the controllerchange
  // reload fires only for a real UPDATE, not the first-ever install.
  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker
    .register('/service-worker.js')
    .then((registration) => {
      swRegistration = registration;

      // A worker already installed-and-waiting from a previous visit.
      if (registration.waiting && navigator.serviceWorker.controller) announceUpdate('sw-waiting');

      // Detection path 1 (SW-based): re-check for a new worker on tab-visible
      // and every 15 minutes while open.
      const check = () => { registration.update().catch(() => {}); };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      setInterval(check, 15 * 60 * 1000);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          // Installed with an existing controller => a NEW version is ready.
          // Do NOT auto-skip; wait for the user to tap Update in the banner.
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            announceUpdate('sw-installed');
          }
        });
      });
    })
    .catch((error) => { console.error('SW registration failed:', error); });

  // When the user-approved new SW takes control, reload — but not on first install.
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !refreshing) { refreshing = true; window.location.reload(); }
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'CACHE_CLEARED') window.location.reload();
  });
}

export function startVersionPolling() {
  if (!APP_VERSION) return;
  // Detection path 2 (belt-and-braces for iOS SW quirks): compare the deployed
  // /version.json to the version baked into THIS bundle. Mismatch => new version.
  const check = async () => {
    try {
      const res = await fetch('/version.json?ts=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.version && data.version !== APP_VERSION) announceUpdate('version-json');
    } catch (e) {}
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  setInterval(check, 15 * 60 * 1000);
  check();
}

export function clearAllCaches() {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
  }
}

export function setupOnlineOfflineDetection() {
  const update = () => {
    document.body.classList.toggle('offline', !navigator.onLine);
    window.dispatchEvent(new CustomEvent('online-status-change', { detail: { isOnline: navigator.onLine } }));
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
