importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js');

// Firebase config is injected at build time via the main app.
// The main thread posts the config to the service worker.
let firebaseInitialized = false;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    if (!firebaseInitialized) {
      firebase.initializeApp(event.data.config);
      const messaging = firebase.messaging();

      messaging.onBackgroundMessage((payload) => {
        console.log('Background message received:', payload);

        const notificationTitle = payload.notification.title || 'EGMC Choir Hub';
        const notificationOptions = {
          body: payload.notification.body,
          icon: payload.notification.icon || '/logo.png',
          badge: '/logo.png',
          tag: payload.notification.tag || 'notification',
          requireInteraction: true,
          data: payload.data || {}
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
      });

      firebaseInitialized = true;
    }
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Navigate to the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/member/calendar');
      }
    })
  );
});
