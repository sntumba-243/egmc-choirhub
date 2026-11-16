import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { getCacheStatus, downloadAllNow, subscribeCacheProgress, isFullLibraryEnabled } from '../lib/backgroundCache';

// Offline sheet music status + "Download all now" — the same card on the member
// Profile, admin Settings and super-admin Settings.
//
// READ-ONLY on mount: reports how many songs are saved and current, then tracks
// live progress. Event songs + favorites are saved automatically by each portal's
// layout (lib/backgroundCache); the FULL library only after the button is tapped
// ("Download all now"), then Resume/Retry if it is interrupted.
export const OfflineSongsCard: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState({ priority: { cached: 0, total: 0 }, full: { cached: 0, total: 0 } });
  const [progress, setProgress] = useState({ cached: 0, total: 0, failed: 0, waitingForWifi: false }); // live count of the running download
  const [lastFailed, setLastFailed] = useState(0); // songs that failed in the last full download
  const [downloadingAll, setDownloadingAll] = useState(false);
  const prevDownloadingRef = useRef(false);

  const opts = () => ({ userId: user?.id, churchId: (user as any)?.church_id });

  useEffect(() => {
    getCacheStatus(opts()).then(setStatus).catch(() => {});
    const unsub = subscribeCacheProgress((p) => {
      setProgress({ cached: p.cached, total: p.total, failed: p.failed, waitingForWifi: p.waitingForWifi });
      setDownloadingAll(p.downloading);
      // When any download (button or background) finishes, refresh the counts.
      if (prevDownloadingRef.current && !p.downloading) {
        getCacheStatus(opts()).then(setStatus).catch(() => {});
      }
      prevDownloadingRef.current = p.downloading;
    });
    return () => unsub();
  }, [user?.id]);

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      const result = await downloadAllNow(opts());
      const fresh = await getCacheStatus(opts());
      setStatus(fresh);
      setLastFailed(result.failed);
      // Honest outcome: only claim success when every sheet is actually stored.
      if (fresh.full.total > 0 && fresh.full.cached >= fresh.full.total) {
        toast.success(`All ${fresh.full.total} songs available offline`);
      } else {
        toast.error(`${fresh.full.cached}/${fresh.full.total} songs saved — ${fresh.full.total - fresh.full.cached} couldn't download. Tap Retry when your connection is better.`);
      }
    } catch {
      toast.error('Could not download all songs');
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
          <Download className="w-3.5 h-3.5 text-gray-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Offline songs</p>
          <p className="text-xs text-gray-400">
            {downloadingAll && progress.waitingForWifi
              ? `Saved ${progress.cached}/${progress.total} — the rest will download on Wi-Fi (tap Resume to continue now)`
              : downloadingAll && progress.total > 0
              ? `Saving ${progress.cached}/${progress.total} (${Math.round((progress.cached / progress.total) * 100)}%) — you can keep using the app`
              : status.full.total > 0 && status.full.cached >= status.full.total
              ? `✓ All ${status.full.total} songs available offline · Event songs ready: ${status.priority.cached}/${status.priority.total}`
              : `Full library: ${status.full.cached}/${status.full.total} offline${lastFailed > 0 ? ` · ${lastFailed} failed` : ''} · Event songs ready: ${status.priority.cached}/${status.priority.total}`}
          </p>
          {downloadingAll && progress.total > 0 && (
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(progress.cached / progress.total) * 100}%`, background: '#E85D26' }} />
            </div>
          )}
        </div>
      </div>
      <button
        onClick={handleDownloadAll}
        disabled={(downloadingAll && !progress.waitingForWifi) || status.full.total === 0 || status.full.cached >= status.full.total}
        className="px-4 min-h-[44px] rounded-lg text-white text-xs font-semibold disabled:opacity-50 flex-shrink-0 flex items-center gap-1.5"
        style={{ background: 'linear-gradient(135deg, #FF8C42, #E85D26)' }}
      >
        {downloadingAll && !progress.waitingForWifi && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {downloadingAll && progress.waitingForWifi
          ? 'Resume'
          : downloadingAll
          ? `Downloading… ${progress.cached}/${progress.total}`
          : status.full.total > 0 && status.full.cached >= status.full.total
          ? 'All saved'
          : isFullLibraryEnabled()
          ? (lastFailed > 0 ? 'Retry' : 'Resume')
          : 'Download all now'}
      </button>
    </div>
  );
};
