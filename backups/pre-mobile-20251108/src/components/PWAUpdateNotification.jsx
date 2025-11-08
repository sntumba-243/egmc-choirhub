// PWAUpdateNotification.jsx
// Shows notification when a new version of the app is available

import { useState, useEffect } from 'react';

export default function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        // Check for updates every hour
        setInterval(() => {
          reg.update();
        }, 60 * 60 * 1000);

        // Listen for update found
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available!
                console.log('🆕 New version available!');
                setShowUpdate(true);
              }
            });
          }
        });
      });

      // Listen for controller change (when new SW takes over)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 New service worker activated!');
        // Optionally reload the page
        if (!isUpdating) {
          window.location.reload();
        }
      });
    }

    // Custom event listener for manual update checks
    const handleCheckUpdate = () => {
      if (registration) {
        registration.update();
      }
    };

    window.addEventListener('checkForUpdates', handleCheckUpdate);

    return () => {
      window.removeEventListener('checkForUpdates', handleCheckUpdate);
    };
  }, [isUpdating, registration]);

  const handleUpdate = () => {
    if (!registration || !registration.waiting) return;

    setIsUpdating(true);

    // Tell the waiting service worker to skip waiting
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // The page will reload automatically when the new SW takes control
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.icon}>🎉</div>
        <div style={styles.text}>
          <h3 style={styles.title}>Update Available!</h3>
          <p style={styles.description}>
            A new version of ChoirHub is ready. Update now for the latest features.
          </p>
        </div>
        <div style={styles.buttons}>
          <button 
            onClick={handleUpdate} 
            disabled={isUpdating}
            style={{
              ...styles.updateButton,
              opacity: isUpdating ? 0.6 : 1,
              cursor: isUpdating ? 'not-allowed' : 'pointer'
            }}
          >
            {isUpdating ? '🔄 Updating...' : 'Update Now'}
          </button>
          <button onClick={handleDismiss} style={styles.dismissButton}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: '70px',
    right: '16px',
    zIndex: 9998,
    maxWidth: '400px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
    padding: '20px',
    animation: 'slideIn 0.3s ease-out',
    border: '2px solid #3b82f6',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  icon: {
    fontSize: '32px',
    textAlign: 'center',
  },
  text: {
    textAlign: 'center',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
  },
  description: {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.5',
  },
  buttons: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  updateButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background-color 0.2s',
  },
  dismissButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};

// Add this to your global CSS:
/*
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
*/
