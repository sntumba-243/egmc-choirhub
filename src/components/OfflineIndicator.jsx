// OfflineIndicator.jsx
// Drop-in component to show online/offline status

import { useState, useEffect } from 'react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowMessage(true);
      
      // Hide "back online" message after 3 seconds
      setTimeout(() => setShowMessage(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowMessage(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show anything if online and message is hidden
  if (isOnline && !showMessage) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '12px 16px',
        backgroundColor: isOnline ? '#10b981' : '#f59e0b',
        color: 'white',
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      {isOnline ? (
        <>
          <span style={{ marginRight: '8px' }}>🟢</span>
          Back online! Data will sync automatically.
        </>
      ) : (
        <>
          <span style={{ marginRight: '8px' }}>🔴</span>
          You're offline. Viewing cached content.
        </>
      )}
    </div>
  );
}

// Add this to your global CSS:
/*
@keyframes slideDown {
  from {
    transform: translateY(-100%);
  }
  to {
    transform: translateY(0);
  }
}
*/
