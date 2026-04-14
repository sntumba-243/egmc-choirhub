importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js');

const firebaseConfig = {
  apiKey: "AIzaSyDPZRkBEJVmd6dU1a7e3w9Ln5GCy6ylrBE",
  authDomain: "egmc-choirhub-d712a.firebaseapp.com",
  projectId: "egmc-choirhub-d712a",
  storageBucket: "egmc-choirhub-d712a.firebasestorage.app",
  messagingSenderId: "330400833344",
  appId: "1:330400833344:web:b2850c69b3345857fae4a5",
  measurementId: "G-VGZVEFB1ED"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
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
