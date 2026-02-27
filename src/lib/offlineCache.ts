// Offline Data Pre-cacher
// Call this after login to pre-cache user's essential data

const SUPABASE_URL = '__SUPABASE_URL__'; // replaced at build time

export async function preCacheUserData(supabase, churchId) {
  if (!navigator.onLine) return;
  
  const CACHE_KEY = 'choirhub_offline_data';
  
  try {
    console.log('[Offline] Pre-caching data for offline use...');
    
    // Fetch essential data
    const [songsRes, churchSongsRes, eventsRes, membersRes, messagesRes, churchRes] = await Promise.all([
      supabase.from('songs').select('*'),
      supabase.from('church_song_status').select('*').eq('church_id', churchId),
      supabase.from('events').select('*').eq('church_id', churchId),
      supabase.from('members').select('*').eq('church_id', churchId),
      supabase.from('messages').select('*').eq('church_id', churchId).order('created_at', { ascending: false }).limit(50),
      supabase.from('churches').select('*').eq('id', churchId).single(),
    ]);

    const offlineData = {
      songs: songsRes.data || [],
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
    
    // Also cache PDF sheet music URLs
    await preCachePDFs(offlineData.songs);
    
    console.log(`[Offline] Cached: ${offlineData.songs.length} songs, ${offlineData.events.length} events, ${offlineData.members.length} members`);
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

async function preCachePDFs(songs) {
  const pdfUrls = songs
    .filter(s => s.sheet_music_url && s.sheet_music_url.includes('drive.google.com'))
    .map(s => s.sheet_music_url)
    .slice(0, 50); // Limit to 50 PDFs to avoid excessive storage
  
  if (pdfUrls.length === 0) return;
  
  const cache = await caches.open('egmc-pdfs-2.0.0');
  let cached = 0;
  
  for (const url of pdfUrls) {
    try {
      const existing = await cache.match(url);
      if (!existing) {
        await cache.add(url);
        cached++;
      }
    } catch {
      // Skip failed PDFs
    }
  }
  
  if (cached > 0) {
    console.log(`[Offline] Pre-cached ${cached} new PDFs`);
  }
}
