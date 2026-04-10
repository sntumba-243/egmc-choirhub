import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const VERCEL_URL = 'https://egmc-git-main-seths-projects-40f8d276.vercel.app';
// Injected at build time by vite define — falls back to '0' on web
const BUILD_VERSION = __APP_BUILD_VERSION__;

export function NativeUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    async function checkForUpdate() {
      try {
        const res = await fetch(`${VERCEL_URL}/version.json?t=${Date.now()}`);
        const { version: latestVersion } = await res.json();
        if (latestVersion && latestVersion > BUILD_VERSION) {
          setUpdateAvailable(true);
        }
      } catch {
        // Silently ignore — user may be offline
      }
    }

    checkForUpdate();
  }, []);

  if (!updateAvailable) return null;

  async function handleUpdate() {
    await Browser.open({ url: VERCEL_URL });
  }

  return (
    <button
      onClick={handleUpdate}
      className="fixed top-0 left-0 right-0 z-[10010] bg-blue-600 text-white text-center text-sm font-medium py-2.5 px-4 active:bg-blue-700 transition-colors"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}
    >
      New version available — tap to update
    </button>
  );
}
