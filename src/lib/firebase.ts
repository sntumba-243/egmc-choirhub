import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get messaging instance
export const messaging = getMessaging(app);

// Request notification permission
export async function requestNotificationPermission() {
  try {
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

// Register service worker and pass Firebase config
if ('serviceWorker' in navigator) {
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
  });
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
