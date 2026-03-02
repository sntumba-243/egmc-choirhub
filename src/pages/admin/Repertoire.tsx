import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Music, Search, Edit, Trash2, Star, Calendar, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../contexts/ChurchContext';

interface Song {
  id: string;
  title: string;
  composer: string;
  language: string;
  sheet_music_url?: string;
  created_at?: string;
}

interface SongWithStatus extends Song {
  learning_status: 'learned' | 'learning' | 'not_started';
}

interface Event {
  id: string;
  title: string;
  date: string;
  type: string;
}

export const AdminRepertoire = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { church } = useChurch();
  const [songs, setSongs] = useState<SongWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [showEventModal, setShowEventModal] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [sortBy, setSortBy] = useState<'a-z' | 'z-a' | 'recent'>('a-z');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'learned' | 'learning' | 'not_started'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const isSuperAdmin = user?.is_super_admin === true;

  useEffect(() => {
    if (church?.id) {
      fetchSongs();
      fetchFavorites();
      fetchUpcomingEvents();
    }
  }, [church?.id]);

  const getAuthUid = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  };

  const fetchSongs = async () => {
    if (!church?.id) return;
    try {
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .order('title', { ascending: true });
      if (songsError) throw songsError;

      const { data: statusData, error: statusError } = await supabase
        .from('church_song_status')
        .select('song_id, status')
        .eq('church_id', church.id);
      if (statusError) throw statusError;

      const statusMap = new Map<string, 'learned' | 'learning' | 'not_started'>();
      (statusData || []).forEach((s: any) => statusMap.set(s.song_id, s.status));

      setSongs((songsData || []).map((song: Song) => ({
        ...song,
        learning_status: statusMap.get(song.id) || 'not_started',
      })));
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    if (!user) return;
    try {
      const authUid = await getAuthUid();
      if (!authUid) return;
      const { data, error } = await supabase.from('user_favorites').select('song_id').eq('user_id', authUid);
      if (error) throw error;
      setFavorites(new Set(data?.map(f => f.song_id) || []));
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const fetchUpcomingEvents = async () => {
    if (!church?.id) return;
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, date, type')
        .eq('church_id', church.id)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(20);
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const toggleFavorite = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const authUid = await getAuthUid();
    if (!authUid) return;
    const isFav = favorites.has(songId);
    try {
      if (isFav) {
        await supabase.from('user_favorites').delete().eq('user_id', authUid).eq('song_id', songId);
        const nf = new Set(favorites); nf.delete(songId); setFavorites(nf);
        toast.success('Removed from favorites');
      } else {
        await supabase.from('user_favorites').insert({ user_id: authUid, song_id: songId });
        const nf = new Set(favorites); nf.add(songId); setFavorites(nf);
        toast.success('Added to favorites');
      }
    } catch (error) {
      toast.error('Failed to update favorite');
    }
  };

  const handleStatusCycle = async (songId: string, currentStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!church?.id) return;
    const cycle: Record<string, 'learned' | 'learning' | 'not_started'> = {
      not_started: 'learning', learning: 'learned', learned: 'not_started',
    };
    const nextStatus = cycle[currentStatus] || 'learning';
    try {
      const { error } = await supabase
        .from('church_song_status')
        .upsert({ church_id: church.id, song_id: songId, status: nextStatus, updated_at: new Date().toISOString() }, { onConflict: 'church_id,song_id' });
      if (error) throw error;
      setSongs(songs.map(s => s.id === songId ? { ...s, learning_status: nextStatus } : s));
      toast.success(`→ ${nextStatus === 'learned' ? 'Learned' : nextStatus === 'learning' ? 'Learning' : 'Not Started'}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const toggleSongSelection = (songId: string) => {
    const ns = new Set(selectedSongs);
    ns.has(songId) ? ns.delete(songId) : ns.add(songId);
    setSelectedSongs(ns);
  };

  const addSongsToEvent = async (eventId: string) => {
    if (selectedSongs.size === 0) return;
    try {
      const { error } = await supabase.from('event_songs').insert(
        Array.from(selectedSongs).map(songId => ({ event_id: eventId, song_id: songId, created_at: new Date().toISOString() }))
      );
      if (error) throw error;
      toast.success(`Added ${selectedSongs.size} songs to event`);
      setSelectedSongs(new Set());
      setShowEventModal(false);
    } catch (error: any) {
      toast.error(error.message?.includes('duplicate') ? 'Some songs already in this event' : 'Failed to add songs');
    }
  };

  const handleBulkStatusUpdate = async (status: 'learned' | 'learning' | 'not_started') => {
    if (selectedSongs.size === 0 || !church?.id) return;
    try {
      const { error } = await supabase.from('church_song_status').upsert(
        Array.from(selectedSongs).map(songId => ({ church_id: church.id, song_id: songId, status, updated_at: new Date().toISOString() })),
        { onConflict: 'church_id,song_id' }
      );
      if (error) throw error;
      toast.success(`${selectedSongs.size} song(s) updated`);
      setSelectedSongs(new Set());
      fetchSongs();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSuperAdmin || !confirm('Delete this song?')) return;
    try {
      await supabase.from('songs').delete().eq('id', id);
      setSongs(songs.filter(s => s.id !== id));
      toast.success('Song deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const handleViewPDF = (song: Song) => {
    if (song.sheet_music_url) navigate('/pdf-viewer', { state: { url: song.sheet_music_url, title: song.title } });
  };

  const getLangColor = (lang: string) => {
    const c: Record<string, string> = { English: 'bg-blue-500', French: 'bg-purple-500', Lingala: 'bg-green-500', Tshiluba: 'bg-yellow-500', Swahili: 'bg-teal-500', Kikongo: 'bg-orange-500', Portuguese: 'bg-pink-500' };
    return c[lang] || 'bg-gray-400';
  };

  const filteredSongs = songs.filter(song => {
    if (languageFilter !== 'all' && song.language?.toLowerCase() !== languageFilter) return false;
    if (statusFilter !== 'all' && song.learning_status !== statusFilter) return false;
    const s = searchTerm.toLowerCase();
    const m = song.title.toLowerCase().includes(s) || song.composer?.toLowerCase().includes(s);
    return showFavoritesOnly ? m && favorites.has(song.id) : m;
  }).sort((a, b) => {
    if (sortBy === 'z-a') return b.title.localeCompare(a.title);
    if (sortBy === 'recent') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    return a.title.localeCompare(b.title);
  });

  const stats = {
    total: songs.length,
    learned: songs.filter(s => s.learning_status === 'learned').length,
    learning: songs.filter(s => s.learning_status === 'learning').length,
    notStarted: songs.filter(s => s.learning_status === 'not_started').length,
  };
  const masteryRate = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );

  return (
    <div className="space-y-3 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-baseline">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Repertoire</h1>
          <p className="text-sm text-gray-500">{filteredSongs.length} of {songs.length}</p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => navigate('new')} className="text-sm text-indigo-600 font-semibold">+ Add</button>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all' as const, label: 'Total', value: stats.total, cls: '' },
          { key: 'learned' as const, label: '✅', value: stats.learned, cls: 'bg-green-50 border-green-200' },
          { key: 'learning' as const, label: '📚', value: stats.learning, cls: 'bg-yellow-50 border-yellow-200' },
          { key: 'not_started' as const, label: '⏳', value: stats.notStarted, cls: 'bg-gray-50' },
        ].map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            className={`flex-1 rounded-lg border p-1.5 text-center transition ${s.cls} ${statusFilter === s.key ? 'ring-2 ring-indigo-500' : 'border-gray-200'}`}>
            <div className="text-sm font-bold">{s.value}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </button>
        ))}
        <div className="flex-1 rounded-lg border border-indigo-200 bg-indigo-50 p-1.5 text-center">
          <div className="text-sm font-bold text-indigo-700">{masteryRate}%</div>
          <div className="text-sm text-gray-500">Rate</div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-1.5">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 w-3.5 h-3.5" />
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm ${showFavoritesOnly ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-white border-gray-200'}`}>
          <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-white' : 'text-gray-400'}`} />
        </button>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`w-10 h-10 flex items-center justify-center rounded-lg border text-sm font-bold ${showFilters ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
          ⚙
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-2 flex gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-400 uppercase">Sort</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="w-full mt-0.5 px-3 py-2 text-sm border border-gray-200 rounded bg-white">
              <option value="a-z">A → Z</option><option value="z-a">Z → A</option><option value="recent">Recent</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-400 uppercase">Language</label>
            <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)} className="w-full mt-0.5 px-3 py-2 text-sm border border-gray-200 rounded bg-white">
              <option value="all">All</option><option value="english">English</option><option value="french">French</option><option value="portuguese">Portuguese</option><option value="lingala">Lingala</option><option value="tshiluba">Tshiluba</option><option value="kikongo">Kikongo</option><option value="swahili">Swahili</option>
            </select>
          </div>
        </div>
      )}

      {/* Bulk bar */}
      {selectedSongs.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-indigo-900">{selectedSongs.size} selected</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowEventModal(true)} className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded text-sm font-semibold">
              <Calendar className="w-3 h-3" /> Event
            </button>
            <select value="" onChange={(e) => { if (e.target.value) handleBulkStatusUpdate(e.target.value as any); }}
              className="px-3 py-2 text-sm border border-indigo-300 rounded bg-white font-medium">
              <option value="">Mark as...</option><option value="learned">✅ Learned</option><option value="learning">📚 Learning</option><option value="not_started">⏳ Not Started</option>
            </select>
            <button onClick={() => setSelectedSongs(new Set())} className="text-sm text-gray-500 px-1">✕</button>
          </div>
        </div>
      )}

      {/* Select all */}
      <div className="flex justify-end">
        <button onClick={selectedSongs.size > 0 ? () => setSelectedSongs(new Set()) : () => { setSelectedSongs(new Set(filteredSongs.map(s => s.id))); toast.success(`Selected ${filteredSongs.length}`); }}
          className={`px-3 py-2 text-sm rounded font-semibold ${selectedSongs.size > 0 ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
          {selectedSongs.size > 0 ? `Deselect (${selectedSongs.size})` : 'Select All'}
        </button>
      </div>

      {/* Songs */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredSongs.length === 0 ? (
          <div className="text-center py-10">
            <Music className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-gray-900">No songs found</h3>
            <p className="text-sm text-gray-400">Try adjusting your filters</p>
          </div>
        ) : filteredSongs.map((song) => {
          const isFav = favorites.has(song.id);
          const isSel = selectedSongs.has(song.id);
          return (
            <div key={song.id}
              className={`flex items-center gap-3 px-3 py-3 border-b border-gray-100 last:border-b-0 transition ${isSel ? 'bg-indigo-50' : ''}`}>
              <input type="checkbox" checked={isSel} onChange={() => toggleSongSelection(song.id)} className="w-3.5 h-3.5 flex-shrink-0 accent-indigo-600" />
              <button onClick={(e) => toggleFavorite(song.id, e)} className="flex-shrink-0 text-base leading-none">
                <span className={isFav ? 'text-yellow-500' : 'text-gray-300'}>{isFav ? '★' : '☆'}</span>
              </button>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => song.sheet_music_url && handleViewPDF(song)}>
                <div className={`text-base font-semibold truncate ${song.sheet_music_url ? 'text-gray-900 hover:text-indigo-600' : 'text-gray-900'}`}>{song.title}</div>
                <div className="text-sm text-gray-400 truncate">{song.composer}</div>
              </div>
              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold text-white flex-shrink-0 ${getLangColor(song.language)}`}>
                {(song.language || '?').slice(0, 1)}
              </span>
              <button onClick={(e) => handleStatusCycle(song.id, song.learning_status, e)}
                className="flex-shrink-0 text-base leading-none hover:scale-125 active:scale-90 transition-transform"
                title="Tap to change status">
                {song.learning_status === 'learned' ? '✅' : song.learning_status === 'learning' ? '📚' : '⏳'}
              </button>
              {isSuperAdmin && (
                <div className="flex flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); navigate(`${song.id}/edit`); }} className="w-[22px] h-[22px] flex items-center justify-center rounded text-blue-500 hover:bg-blue-50"><Edit className="w-3 h-3" /></button>
                  <button onClick={(e) => handleDelete(song.id, e)} className="w-[22px] h-[22px] flex items-center justify-center rounded text-red-400 hover:bg-red-50"><Trash2 className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-sm w-full max-h-[70vh] flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-bold">Add to Event ({selectedSongs.size})</h2>
              <button onClick={() => setShowEventModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {events.length === 0 ? (
                <div className="text-center py-6">
                  <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-2">No upcoming events</p>
                  <button onClick={() => { setShowEventModal(false); navigate('../events/new'); }} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded">Create Event</button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {events.map((event) => (
                    <button key={event.id} onClick={() => addSongsToEvent(event.id)} className="w-full text-left p-2 rounded-lg border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 transition">
                      <div className="font-semibold text-xs">{event.title}</div>
                      <div className="text-sm text-gray-500">{new Date(event.date).toLocaleDateString()}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t">
              <button onClick={() => setShowEventModal(false)} className="w-full px-3 py-1.5 text-xs bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
