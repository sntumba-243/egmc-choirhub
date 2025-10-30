// IOSInstallPrompt.jsx
// Special prompt for iOS users (Safari doesn't support beforeinstallprompt)

import { useState, useEffect } from 'react';

export default function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if iOS and not installed
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isIOS && !isInStandaloneMode) {
      // Check if user dismissed recently
      const dismissedTime = localStorage.getItem('iosInstallDismissed');
      if (dismissedTime) {
        const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) {
          return;
        }
      }

      // Show prompt after delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('iosInstallDismissed', Date.now().toString());
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div style={styles.overlay} onClick={handleDismiss}>
      <div style={styles.container} onClick={(e) => e.stopPropagation()}>
        <button onClick={handleDismiss} style={styles.closeButton}>
          ✕
        </button>
        
        <div style={styles.content}>
          <div style={styles.icon}>📱</div>
          
          <h3 style={styles.title}>Install ChoirHub</h3>
          
          <p style={styles.description}>
            Install this app on your iPhone for quick access and offline use!
          </p>

          <div style={styles.steps}>
            <div style={styles.step}>
              <div style={styles.stepNumber}>1</div>
              <div style={styles.stepContent}>
                <p style={styles.stepText}>
                  Tap the <strong>Share</strong> button
                  <span style={styles.shareIcon}>
                    <svg width="20" height="24" viewBox="0 0 20 24" fill="#007AFF">
                      <path d="M10 0L10 16M10 0L6 4M10 0L14 4M2 8V22C2 23.1 2.9 24 4 24H16C17.1 24 18 23.1 18 22V8" 
                            stroke="#007AFF" 
                            strokeWidth="2" 
                            fill="none"/>
                    </svg>
                  </span>
                </p>
              </div>
            </div>

            <div style={styles.step}>
              <div style={styles.stepNumber}>2</div>
              <div style={styles.stepContent}>
                <p style={styles.stepText}>
                  Scroll down and tap <strong>"Add to Home Screen"</strong>
                </p>
              </div>
            </div>

            <div style={styles.step}>
              <div style={styles.stepNumber}>3</div>
              <div style={styles.stepContent}>
                <p style={styles.stepText}>
                  Tap <strong>"Add"</strong> in the top right corner
                </p>
              </div>
            </div>
          </div>

          <button onClick={handleDismiss} style={styles.gotItButton}>
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    animation: 'fadeIn 0.3s ease-out',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: '16px',
    maxWidth: '400px',
    width: '100%',
    position: 'relative',
    animation: 'slideUp 0.3s ease-out',
  },
  closeButton: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '4px',
    lineHeight: 1,
  },
  content: {
    padding: '32px 24px 24px',
  },
  icon: {
    fontSize: '48px',
    textAlign: 'center',
    marginBottom: '16px',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '22px',
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  description: {
    margin: '0 0 24px 0',
    fontSize: '15px',
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: '1.5',
  },
  steps: {
    marginBottom: '24px',
  },
  step: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    margin: 0,
    fontSize: '14px',
    color: '#374151',
    lineHeight: '1.5',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  shareIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '4px',
  },
  gotItButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};

// Add to global CSS:
/*
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
*/
