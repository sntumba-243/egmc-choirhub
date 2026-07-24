import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Firebase Cloud Messaging is OPTIONAL. If the VITE_FIREBASE_* config is absent
// (e.g. local dev, or a misconfigured deploy) or init fails, the app must still
// render — push notifications simply no-op. getMessaging() throws on missing
// projectId, which previously white-screened the whole app at import time.
const hasFirebaseConfig = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

let app: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;

if (hasFirebaseConfig) {
  try {
    app = initializeApp(firebaseConfig);
    messagingInstance = getMessaging(app);
  } catch (error) {
    console.warn('[firebase] initialization failed — push notifications disabled:', error);
    app = null;
    messagingInstance = null;
  }
} else {
  console.warn('[firebase] VITE_FIREBASE_* config missing — push notifications disabled.');
}

export const messaging = messagingInstance;

// Request notification permission
export async function requestNotificationPermission() {
  try {
    // No messaging instance (config missing/init failed) → nothing to do.
    if (!messaging) return null;

    // Check if notifications are supported
    if (!('Notification' in window)) {
      return null;
    }

    // If already denied, don't ask again
    if (Notification.permission === 'denied') {
      return null;
    }

    // If already granted, get token
    if (Notification.permission === 'granted') {
      return await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      return await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });
    }

    return null;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
}

// Listen for incoming messages
export function setupMessageListener(callback: (payload: any) => void) {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    callback(payload);
    
    // Show notification if in foreground
    if (payload.notification) {
      new Notification(payload.notification.title || 'EGMC Choir Hub', {
        body: payload.notification.body,
        icon: payload.notification.icon,
        tag: payload.notification.tag
      });
    }
  });
}

// Register the FCM service worker and pass config — only when Firebase is
// configured, so a missing config never triggers import-time side effects/errors.
if (hasFirebaseConfig && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js').then((registration) => {
    registration.active?.postMessage({
      type: 'FIREBASE_CONFIG',
      config: firebaseConfig,
    });
    // Also post when the SW activates (first install)
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', (e) => {
        if ((e.target as ServiceWorker).state === 'activated') {
          registration.active?.postMessage({
            type: 'FIREBASE_CONFIG',
            config: firebaseConfig,
          });
        }
      });
    });
  }).catch((e) => console.warn('[firebase] messaging SW registration failed:', e));
}

// Store device token in database
export async function storeDeviceToken(userId: string, token: string) {
  try {
    const response = await fetch('/api/notifications/register-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token })
    });
    
    if (!response.ok) throw new Error('Failed to store device token');
    return await response.json();
  } catch (error) {
    console.error('❌ Error storing device token:', error);
  }
}
