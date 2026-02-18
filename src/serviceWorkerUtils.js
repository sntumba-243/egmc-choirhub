let APP_VERSION = null;

async function getInitialVersion() {
  try {
    const res = await fetch('/version.json?_t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      APP_VERSION = data.version;
    }
  } catch (e) {}
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register('/service-worker.js')
    .then((registration) => {
      console.log('SW registered:', registration.scope);

      setInterval(() => { registration.update(); }, 30 * 1000);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update();
      });

      window.addEventListener('focus', () => { registration.update(); });

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New version available!');
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    })
    .catch((error) => {
      console.error('SW registration failed:', error);
    });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('New service worker activated, reloading...');
      window.location.reload();
    }
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'CACHE_CLEARED') {
      console.log('Cache cleared');
      window.location.reload();
    }
  });
}

export function startVersionPolling() {
  getInitialVersion().then(() => {
    setInterval(checkVersion, 2 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkVersion();
    });
  });
}

async function checkVersion() {
  if (!APP_VERSION) return;
  try {
    const res = await fetch('/version.json?_t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.version && data.version !== APP_VERSION) {
      console.log('Version mismatch: app=' + APP_VERSION + ', server=' + data.version);
      APP_VERSION = data.version;
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
      window.location.reload();
    }
  } catch (e) {}
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
