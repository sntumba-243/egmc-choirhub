import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getOfflineMeta } from '../lib/offlineCache';

export const OfflineBanner = () => {
  const { isOnline } = useOfflineStatus();
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnline) {
      getOfflineMeta().then(meta => {
        if (meta?.cachedAt) {
          setCachedAt(new Date(meta.cachedAt).toLocaleString());
        }
      });
    }
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg">
      <WifiOff className="w-4 h-4" />
      <span>You're offline — viewing cached data</span>
      {cachedAt && (
        <span className="text-amber-100 text-xs ml-1">(last synced: {cachedAt})</span>
      )}
    </div>
  );
};
