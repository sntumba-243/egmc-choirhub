import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { subscribeCacheProgress, type CacheProgress } from '../lib/backgroundCache';

// Small, non-blocking status while sheet music is being saved for offline use
// (the automatic full-library download, or updates to changed files). Hidden
// the rest of the time. Full details + Resume/Retry live on the Profile page.
export default function OfflineSaveStatus() {
  const [p, setP] = useState<CacheProgress | null>(null);
  useEffect(() => subscribeCacheProgress(setP), []);

  // Hidden while waiting for Wi-Fi: nothing is being saved (Profile explains why).
  if (!p || !p.downloading || p.waitingForWifi || p.total === 0 || p.cached >= p.total) return null;

  // Top right, under the mobile header (the install prompt occupies the bottom
  // on first visits — exactly when the first download runs).
  return (
    <div
      role="status"
      aria-live="polite"
      translate="no"
      className="fixed z-40 right-4 top-[calc(env(safe-area-inset-top)+72px)] lg:top-4 flex items-center gap-2 rounded-full bg-gray-900/90 text-white text-xs font-medium px-3 py-2 shadow-lg pointer-events-none"
    >
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span>Saving songs for offline… {p.cached} of {p.total}</span>
    </div>
  );
}
