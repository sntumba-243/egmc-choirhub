import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "***REMOVED***",
  authDomain: "***REMOVED***.firebaseapp.com",
  projectId: "***REMOVED***",
  storageBucket: "***REMOVED***.firebasestorage.app",
  messagingSenderId: "***REMOVED***",
  appId: "1:***REMOVED***:web:b2850c69b3345857fae4a5",
  measurementId: "***REMOVED***"
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
      console.log('This browser does not support notifications');
      return null;
    }

    // If already denied, don't ask again
    if (Notification.permission === 'denied') {
      console.log('Notifications denied by user');
      return null;
    }

    // If already granted, get token
    if (Notification.permission === 'granted') {
      return await getToken(messaging, {
        vapidKey: '***REMOVED***'
      });
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      return await getToken(messaging, {
        vapidKey: '***REMOVED***'
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
    console.log('Message received:', payload);
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
