// Service Worker Registration
// Add this to your main.jsx or App.jsx

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope);

          // Check for updates every hour
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                console.log('🆕 New version available! Refresh to update.');
                
                // You can show a toast/notification here
                if (window.showUpdateNotification) {
                  window.showUpdateNotification();
                }
              }
            });
          });
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_CLEARED') {
          console.log('✅ Cache cleared successfully');
          // Optionally reload the page
          window.location.reload();
        }

        if (event.data && event.data.type === 'CACHE_SIZE_RESPONSE') {
          console.log('📦 Cache stats:', event.data.stats);
          // Store or display cache stats
          if (window.updateCacheStats) {
            window.updateCacheStats(event.data.stats);
          }
        }
      });
    });
  }
}

// Utility function to check if online/offline
export function setupOnlineOfflineDetection() {
  const updateOnlineStatus = () => {
    const isOnline = navigator.onLine;
    document.body.classList.toggle('offline', !isOnline);
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('online-status-change', {
      detail: { isOnline }
    }));
    
    console.log(isOnline ? '🟢 Online' : '🔴 Offline');
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Set initial state
  updateOnlineStatus();
}

// Clear all caches (useful for debugging or user-triggered refresh)
export function clearAllCaches() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
  }
}

// Get cache statistics
export function getCacheStats() {
  return new Promise((resolve) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data && event.data.type === 'CACHE_SIZE_RESPONSE') {
          resolve(event.data.stats);
        }
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_CACHE_SIZE' },
        [messageChannel.port2]
      );
    } else {
      resolve(null);
    }
  });
}

// Prefetch PDFs (call this when user views song list)
export function prefetchPDF(pdfUrl) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    // Just fetch it - service worker will cache it
    fetch(pdfUrl)
      .then(() => console.log('✅ Prefetched PDF:', pdfUrl))
      .catch((err) => console.warn('⚠️ Failed to prefetch PDF:', err));
  }
}

// Prefetch multiple PDFs
export function prefetchMultiplePDFs(pdfUrls) {
  pdfUrls.forEach(url => prefetchPDF(url));
}
