// EnhancedOfflineIndicator.jsx
// Enhanced version with better UI and sync status
function App() {
  return (
    <>
      {/* PWA Components */}
      <EnhancedOfflineIndicator />
      <PWAInstallPrompt />
      <IOSInstallPrompt />
      <PWAUpdateNotification />
      
      {/* Your existing app content */}
      {/* ... rest of your app */}
    </>
  )
}

import { useState, useEffect } from 'react';

export default function EnhancedOfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [message, setMessage] = useState('');
  const [lastOnlineTime, setLastOnlineTime] = useState(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setMessage('Back online! Syncing latest data...');
      setShowBanner(true);
      
      // Hide banner after 4 seconds
      setTimeout(() => {
        setShowBanner(false);
      }, 4000);

      // Clear last offline time
      setLastOnlineTime(null);
      localStorage.removeItem('lastOnlineTime');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setMessage('You\'re offline. Using cached content.');
      setShowBanner(true);
      
      // Record when we went offline
      const now = Date.now();
      setLastOnlineTime(now);
      localStorage.setItem('lastOnlineTime', now.toString());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if we were offline on page load
    const savedOfflineTime = localStorage.getItem('lastOnlineTime');
    if (!navigator.onLine && savedOfflineTime) {
      setLastOnlineTime(parseInt(savedOfflineTime));
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Calculate how long we've been offline
  const getOfflineDuration = () => {
    if (!lastOnlineTime) return null;
    
    const minutes = Math.floor((Date.now() - lastOnlineTime) / (1000 * 60));
    
    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 minute';
    if (minutes < 60) return `${minutes} minutes`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour';
    return `${hours} hours`;
  };

  const offlineDuration = getOfflineDuration();

  // Don't show if online and banner is hidden
  if (isOnline && !showBanner) {
    return null;
  }

  return (
    <>
      {/* Main banner */}
      <div
        style={{
          ...styles.banner,
          backgroundColor: isOnline ? '#10b981' : '#f59e0b',
        }}
      >
        <div style={styles.content}>
          <span style={styles.icon}>
            {isOnline ? '🟢' : '🔴'}
          </span>
          <span style={styles.message}>{message}</span>
          {!isOnline && offlineDuration && (
            <span style={styles.duration}>({offlineDuration})</span>
          )}
        </div>
        {!isOnline && (
          <button 
            onClick={() => setShowBanner(false)} 
            style={styles.closeButton}
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>

      {/* Persistent offline indicator (when banner is dismissed) */}
      {!isOnline && !showBanner && (
        <div style={styles.persistentIndicator}>
          <span style={styles.persistentIcon}>🔴</span>
          <span style={styles.persistentText}>Offline</span>
        </div>
      )}
    </>
  );
}

const styles = {
  banner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    padding: '12px 16px',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    animation: 'slideDown 0.3s ease-out',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '500',
  },
  icon: {
    fontSize: '16px',
  },
  message: {
    flex: 1,
  },
  duration: {
    fontSize: '12px',
    opacity: 0.9,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 8px',
    opacity: 0.8,
    transition: 'opacity 0.2s',
  },
  persistentIndicator: {
    position: 'fixed',
    top: '16px',
    right: '16px',
    backgroundColor: '#f59e0b',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: '600',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    zIndex: 9998,
    animation: 'fadeIn 0.3s ease-out',
  },
  persistentIcon: {
    fontSize: '14px',
  },
  persistentText: {
    letterSpacing: '0.5px',
  },
};

// Add these to your global CSS:
/*
@keyframes slideDown {
  from {
    transform: translateY(-100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

button:hover {
  opacity: 1 !important;
}
*/
