import { useEffect, useState } from 'react';

// Small, non-blocking "new version available" banner. Detection runs in
// serviceWorkerUtils (SW updatefound + version.json polling), which dispatches
// an `app-update-available` window event. Mounted once at the App root so it
// covers member / admin / super-admin dashboards.
export default function UpdateBanner() {
  const [show, setShow] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.registration) setReg(detail.registration as ServiceWorkerRegistration);
      setShow(true); // re-shows on every detection; dismiss is session-only (no persistence)
    };
    window.addEventListener('app-update-available', onUpdate as EventListener);
    return () => window.removeEventListener('app-update-available', onUpdate as EventListener);
  }, []);

  const handleUpdate = () => {
    const waiting = reg?.waiting;
    if (waiting) {
      // Activate the waiting SW → controllerchange (serviceWorkerUtils) → reload.
      waiting.postMessage({ type: 'SKIP_WAITING' });
      // Safety for iOS standalone where controllerchange can be flaky.
      setTimeout(() => window.location.reload(), 1500);
    } else {
      window.location.reload();
    }
  };

  if (!show) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[10020] flex items-center justify-between gap-3 px-4 bg-gray-900 text-white shadow-lg"
      style={{ bottom: 0, paddingTop: '10px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}
      role="status"
    >
      <span className="text-sm font-medium">New version available</span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={handleUpdate}
          className="min-h-[44px] px-4 rounded-lg bg-white text-gray-900 text-sm font-semibold"
        >
          Update
        </button>
        <button
          onClick={() => setShow(false)}
          aria-label="Dismiss"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/80 text-lg"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
