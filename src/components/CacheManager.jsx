// CacheManager.jsx
// Optional component for settings/admin page to manage offline cache

import { useState, useEffect } from 'react';
import { getCacheStats, clearAllCaches } from './serviceWorkerUtils';

export default function CacheManager() {
  const [cacheStats, setCacheStats] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    loadCacheStats();

    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  const loadCacheStats = async () => {
    const stats = await getCacheStats();
    setCacheStats(stats);
  };

  const handleClearCache = async () => {
    if (window.confirm('Clear all offline data? You\'ll need internet to reload songs and PDFs.')) {
      setIsClearing(true);
      clearAllCaches();
      
      // Wait for cache clear message from service worker
      setTimeout(() => {
        setIsClearing(false);
        setCacheStats(null);
      }, 1000);
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>📦 Offline Storage</h3>
      
      <div style={styles.statusCard}>
        <div style={styles.statusRow}>
          <span style={styles.statusLabel}>Connection:</span>
          <span style={{ ...styles.statusValue, color: isOnline ? '#10b981' : '#f59e0b' }}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
        
        {cacheStats && (
          <>
            <div style={styles.statusRow}>
              <span style={styles.statusLabel}>Cached PDFs:</span>
              <span style={styles.statusValue}>{cacheStats.pdfs} files</span>
            </div>
            <div style={styles.statusRow}>
              <span style={styles.statusLabel}>Cached Data:</span>
              <span style={styles.statusValue}>{cacheStats.supabase} items</span>
            </div>
            <div style={styles.statusRow}>
              <span style={styles.statusLabel}>Total Cached:</span>
              <span style={styles.statusValue}>{cacheStats.total} items</span>
            </div>
          </>
        )}
      </div>

      <div style={styles.infoBox}>
        <p style={styles.infoText}>
          ℹ️ Your recently viewed songs and PDFs are automatically saved for offline access.
          This lets you practice even without internet!
        </p>
      </div>

      <button
        onClick={handleClearCache}
        disabled={isClearing}
        style={{
          ...styles.clearButton,
          opacity: isClearing ? 0.5 : 1,
          cursor: isClearing ? 'not-allowed' : 'pointer'
        }}
      >
        {isClearing ? '🔄 Clearing...' : '🗑️ Clear Offline Data'}
      </button>

      <button
        onClick={loadCacheStats}
        style={styles.refreshButton}
      >
        🔄 Refresh Stats
      </button>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '500px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#1f2937',
  },
  statusCard: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #e5e7eb',
  },
  statusLabel: {
    color: '#6b7280',
    fontSize: '14px',
  },
  statusValue: {
    fontWeight: '600',
    fontSize: '14px',
    color: '#1f2937',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
  },
  infoText: {
    margin: 0,
    fontSize: '13px',
    color: '#1e40af',
    lineHeight: '1.5',
  },
  clearButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '8px',
    transition: 'background-color 0.2s',
  },
  refreshButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};
