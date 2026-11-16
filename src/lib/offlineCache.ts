// Offline Data Pre-cacher
// Call this after login to pre-cache user's essential data


export async function preCacheUserData(supabase, churchId) {
  if (!navigator.onLine) return;
  
  const CACHE_KEY = 'choirhub_offline_data';
  
  try {
    // Fetch essential data
    const [songsRes, churchSongsRes, eventsRes, membersRes, messagesRes, churchRes] = await Promise.all([
      fetchAllSongs(supabase), // whole library (paged past PostgREST's 1000-row cap) — was .limit(500)
      supabase.from('church_song_status').select('*').eq('church_id', churchId).limit(500),
      supabase.from('events').select('*').eq('church_id', churchId).limit(500),
      supabase.from('members').select('*').eq('church_id', churchId).limit(500),
      supabase.from('messages').select('*').eq('church_id', churchId).order('created_at', { ascending: false }).limit(50),
      supabase.from('churches').select('*').eq('id', churchId).single(),
    ]);

    const offlineData = {
      songs: songsRes, // fetchAllSongs throws on error → whole pre-cache skipped, old snapshot kept
      churchSongStatus: churchSongsRes.data || [],
      events: eventsRes.data || [],
      members: membersRes.data || [],
      messages: messagesRes.data || [],
      church: churchRes.data || null,
      cachedAt: new Date().toISOString(),
      churchId,
    };

    // Store in IndexedDB for larger storage
    await saveToIndexedDB(offlineData);
    
  } catch (err) {
    console.warn('[Offline] Pre-cache failed:', err);
  }
}

// IndexedDB helpers
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChoirHubOffline', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToIndexedDB(data) {
  const db = await openDB();
  const tx = db.transaction('data', 'readwrite');
  const store = tx.objectStore('data');
  
  // Store each table separately for efficient retrieval
  store.put({ key: 'songs', value: data.songs, cachedAt: data.cachedAt });
  store.put({ key: 'churchSongStatus', value: data.churchSongStatus, cachedAt: data.cachedAt });
  store.put({ key: 'events', value: data.events, cachedAt: data.cachedAt });
  store.put({ key: 'members', value: data.members, cachedAt: data.cachedAt });
  store.put({ key: 'messages', value: data.messages, cachedAt: data.cachedAt });
  store.put({ key: 'church', value: data.church, cachedAt: data.cachedAt });
  store.put({ key: 'meta', value: { churchId: data.churchId, cachedAt: data.cachedAt } });
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineData(key) {
  try {
    const db = await openDB();
    const tx = db.transaction('data', 'readonly');
    const store = tx.objectStore('data');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function getOfflineMeta() {
  return getOfflineData('meta');
}

/** Store one value in the offline IndexedDB (same store as preCacheUserData). */
export async function putOfflineData(key: string, value: unknown) {
  const db = (await openDB()) as IDBDatabase;
  const tx = db.transaction('data', 'readwrite');
  tx.objectStore('data').put({ key, value, cachedAt: new Date().toISOString() });
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Every song row, paged in 1000-row chunks (PostgREST caps a response at 1000).
 * Throws on error so callers never overwrite a good snapshot with a partial one.
 */
export async function fetchAllSongs(supabase: any): Promise<any[]> {
  const PAGE = 1000;
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('songs').select('*').order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) return all;
  }
}
