import { getOfflineData } from './offlineCache';

// Wrapper that tries Supabase first, falls back to IndexedDB
export async function fetchWithOfflineFallback(
  supabaseQuery: () => Promise<{ data: any; error: any }>,
  offlineKey: string
): Promise<{ data: any; error: any; isOffline: boolean }> {
  try {
    const result = await supabaseQuery();
    if (result.error) throw result.error;
    return { data: result.data, error: null, isOffline: false };
  } catch (err) {
    // Try offline cache
    const cached = await getOfflineData(offlineKey);
    if (cached) {
      console.log(`[Offline] Using cached ${offlineKey}`);
      return { data: cached, error: null, isOffline: true };
    }
    return { data: null, error: err, isOffline: true };
  }
}
