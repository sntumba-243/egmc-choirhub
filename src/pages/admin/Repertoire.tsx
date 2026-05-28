import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Music, Search, Star, Calendar, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../contexts/ChurchContext';

const PAGE_SIZE = 20;

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
  const [pageLoading, setPageLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [showEventModal, setShowEventModal] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [sortBy, setSortBy] = useState<'a-z' | 'z-a' | 'recent'>('a-z');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'learned' | 'learning' | 'not_started'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [viewingSong, setViewingSong] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [songStats, setSongStats] = useState({ total: 0, learned: 0, learning: 0, notStarted: 0 });
  const [statusMap, setStatusMap] = useState<Map<string, 'learned' | 'learning' | 'not_started'>>(new Map());
  const [loadAll, setLoadAll] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);

  // Close action menu on any outside click
  useEffect(() => {
    const close = () => setActiveActionMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const isSuperAdmin = user?.is_super_admin === true;

  const isPaginated = !loadAll && !debouncedSearch.trim() && statusFilter === 'all' && !showFavoritesOnly;
  const totalPages = isPaginated ? Math.ceil(totalCount / PAGE_SIZE) : 1;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Initial data load
  useEffect(() => {
    if (church?.id) {
      initData();
      fetchFavorites();
      fetchUpcomingEvents();
    }
  }, [church?.id]);

  // Refetch when page or filters change
  useEffect(() => {
    if (!church?.id || loading) return;
    fetchSongs(currentPage);
  }, [currentPage, debouncedSearch, languageFilter, sortBy, statusFilter, showFavoritesOnly, loadAll]);

  const initData = async () => {
    const sm = await fetchStatsAndStatuses();
    await fetchSongs(1, sm);
  };

  const fetchStatsAndStatuses = async () => {
    if (!church?.id) return new Map<string, 'learned' | 'learning' | 'not_started'>();
    try {
      const [countResult, statusResult] = await Promise.all([
        supabase.from('songs').select('*', { count: 'exact', head: true }),
        supabase.from('church_song_status').select('song_id, status').eq('church_id', church.id),
      ]);
      const total = countResult.count || 0;
      const statuses = statusResult.data || [];
      const map = new Map<string, 'learned' | 'learning' | 'not_started'>();
      statuses.forEach((s: any) => map.set(s.song_id, s.status));
      setStatusMap(map);
      const learned = statuses.filter(s => s.status === 'learned').length;
      const learning = statuses.filter(s => s.status === 'learning').length;
      setSongStats({ total, learned, learning, notStarted: total - learned - learning });
      return map;
    } catch (error) {
      console.error('Error fetching stats:', error);
      return new Map<string, 'learned' | 'learning' | 'not_started'>();
    }
  };

  const fetchSongs = async (page: number, statuses?: Map<string, 'learned' | 'learning' | 'not_started'>) => {
    if (!church?.id) return;
    setPageLoading(true);
    try {
      const orderCol = sortBy === 'recent' ? 'created_at' : 'title';
      const ascending = sortBy === 'recent' ? false : sortBy !== 'z-a';

      let query = supabase
        .from('songs')
        .select('*', { count: 'exact' })
        .order(orderCol, { ascending });

      if (languageFilter !== 'all') {
        query = query.ilike('language', languageFilter);
      }

      const search = debouncedSearch.trim();
      if (search) {
        query = query.or(`title.ilike.%${search}%,composer.ilike.%${search}%`);
      }

      const shouldPaginate = !loadAll && !search && statusFilter === 'all' && !showFavoritesOnly;
      if (shouldPaginate) {
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        query = query.range(from, to);
      }

      const { data: songsData, error, count } = await query;
      if (error) throw error;

      const sm = statuses || statusMap;
      setTotalCount(count || 0);

      let result: SongWithStatus[] = (songsData || []).map((song: Song) => ({
        ...song,
        learning_status: sm.get(song.id) || 'not_started',
      }));

      if (statusFilter !== 'all') {
        result = result.filter(s => s.learning_status === statusFilter);
      }
      if (showFavoritesOnly) {
        result = result.filter(s => favorites.has(s.id));
      }

      setSongs(result);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load songs');
    } finally {
      setPageLoading(false);
      setLoading(false);
    }
  };

  const getAuthUid = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
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

      const oldStatus = (statusMap.get(songId) || 'not_started') as string;
      const newMap = new Map(statusMap);
      newMap.set(songId, nextStatus);
      setStatusMap(newMap);
      setSongStats(prev => {
        const s = { ...prev };
        if (oldStatus === 'learned') s.learned--;
        else if (oldStatus === 'learning') s.learning--;
        else s.notStarted--;
        if (nextStatus === 'learned') s.learned++;
        else if (nextStatus === 'learning') s.learning++;
        else s.notStarted++;
        return s;
      });

      toast.success(`\u2192 ${nextStatus === 'learned' ? 'Learned' : nextStatus === 'learning' ? 'Learning' : 'Not Started'}`);
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
      await fetchStatsAndStatuses();
      await fetchSongs(currentPage);
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
      setTotalCount(prev => prev - 1);
      const oldStatus = (statusMap.get(id) || 'not_started') as string;
      setSongStats(prev => {
        const s = { ...prev, total: prev.total - 1 };
        if (oldStatus === 'learned') s.learned--;
        else if (oldStatus === 'learning') s.learning--;
        else s.notStarted--;
        return s;
      });
      toast.success('Song deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const handleViewPDF = (song: Song) => {
    if (song.sheet_music_url) setViewingSong(song);
  };

  const getLangColor = (lang: string) => {
    const c: Record<string, string> = { English: 'bg-blue-500', French: 'bg-purple-500', Lingala: 'bg-green-500', Tshiluba: 'bg-yellow-500', Swahili: 'bg-teal-500', Kikongo: 'bg-orange-500', Portuguese: 'bg-pink-500' };
    return c[lang] || 'bg-gray-400';
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const masteryRate = songStats.total > 0 ? Math.round((songStats.learned / songStats.total) * 100) : 0;

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );

  return (
    <>
    <div className="space-y-3 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-baseline">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Repertoire</h1>
          <p className="text-sm text-gray-500">
            {isPaginated ? `${totalCount} songs` : `${songs.length} of ${totalCount}`}
          </p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => navigate('new')} className="text-sm text-indigo-600 font-semibold min-h-[44px] px-4 inline-flex items-center">+ Add</button>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all' as const, label: 'Total', value: songStats.total, cls: '' },
          { key: 'learned' as const, label: '\u2705', value: songStats.learned, cls: 'bg-green-50 border-green-200' },
          { key: 'learning' as const, label: '\uD83D\uDCDA', value: songStats.learning, cls: 'bg-yellow-50 border-yellow-200' },
          { key: 'not_started' as const, label: '\u23F3', value: songStats.notStarted, cls: 'bg-gray-50' },
        ].map(s => (
          <button key={s.key} onClick={() => { setStatusFilter(s.key); setCurrentPage(1); }}
            className={`flex-1 rounded-lg border p-1.5 text-center transition min-h-[44px] ${s.cls} ${statusFilter === s.key ? 'ring-2 ring-indigo-500' : 'border-gray-200'}`}>
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
            className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[44px]" />
        </div>
        <button onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setCurrentPage(1); }}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border text-sm ${showFavoritesOnly ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-white border-gray-200'}`}>
          <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-white' : 'text-gray-400'}`} />
        </button>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border text-sm font-bold ${showFilters ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
          {'\u2699'}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-2 flex gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-400 uppercase">Sort</label>
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as any); setCurrentPage(1); }} className="w-full mt-0.5 px-3 py-2 text-sm border border-gray-200 rounded bg-white min-h-[44px]">
              <option value="a-z">A &rarr; Z</option><option value="z-a">Z &rarr; A</option><option value="recent">Recent</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-400 uppercase">Language</label>
            <select value={languageFilter} onChange={(e) => { setLanguageFilter(e.target.value); setCurrentPage(1); }} className="w-full mt-0.5 px-3 py-2 text-sm border border-gray-200 rounded bg-white min-h-[44px]">
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
            <button onClick={() => setShowEventModal(true)} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded text-sm font-semibold min-h-[44px]">
              <Calendar className="w-3 h-3" /> Event
            </button>
            <select value="" onChange={(e) => { if (e.target.value) handleBulkStatusUpdate(e.target.value as any); }}
              className="px-3 py-2 text-sm border border-indigo-300 rounded bg-white font-medium min-h-[44px]">
              <option value="">Mark as...</option><option value="learned">{'\u2705'} Learned</option><option value="learning">{'\uD83D\uDCDA'} Learning</option><option value="not_started">{'\u23F3'} Not Started</option>
            </select>
            <button onClick={() => setSelectedSongs(new Set())} className="text-sm text-gray-500 min-w-[44px] min-h-[44px] flex items-center justify-center">{'\u2715'}</button>
          </div>
        </div>
      )}

      {/* Select all + Load all */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {!loadAll && isPaginated && totalPages > 1 && (
            <button onClick={() => { setLoadAll(true); setCurrentPage(1); }}
              className="px-4 py-2 text-sm rounded font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 min-h-[44px]">
              Load all songs
            </button>
          )}
          {loadAll && (
            <button onClick={() => { setLoadAll(false); setCurrentPage(1); }}
              className="px-4 py-2 text-sm rounded font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 min-h-[44px]">
              Back to pages
            </button>
          )}
        </div>
        <button onClick={selectedSongs.size > 0 ? () => setSelectedSongs(new Set()) : () => { setSelectedSongs(new Set(songs.map(s => s.id))); toast.success(`Selected ${songs.length}`); }}
          className={`px-4 py-2 text-sm rounded font-semibold min-h-[44px] ${selectedSongs.size > 0 ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
          {selectedSongs.size > 0 ? `Deselect (${selectedSongs.size})` : 'Select All'}
        </button>
      </div>

      {/* Songs */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden relative">
        {pageLoading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        )}
        {songs.length === 0 && !pageLoading ? (
          <div className="text-center py-10">
            <Music className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-gray-900">No songs found</h3>
            <p className="text-sm text-gray-400">Try adjusting your filters</p>
          </div>
        ) : songs.map((song) => {
          const isFav = favorites.has(song.id);
          const isSel = selectedSongs.has(song.id);
          return (
            <div
              key={song.id}
              className={`flex items-center gap-3 px-3 py-3 border-b border-gray-100 last:border-b-0 transition ${isSel ? 'bg-indigo-50' : ''}`}
            >
              {/* Checkbox \u2014 admin only */}
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => toggleSongSelection(song.id)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 flex-shrink-0 accent-indigo-600"
              />

              {/* Star/favorite \u2014 matches member portal */}
              <button onClick={(e) => toggleFavorite(song.id, e)} className="flex-shrink-0 text-base leading-none">
                <span className={isFav ? 'text-yellow-500' : 'text-gray-300'}>{isFav ? '\u2605' : '\u2606'}</span>
              </button>

              {/* Title + composer \u2014 matches member portal */}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => song.sheet_music_url && handleViewPDF(song)}>
                <div className={`text-sm font-semibold ${song.sheet_music_url ? 'text-gray-900 active:text-orange-600' : 'text-gray-900'}`} style={{ whiteSpace: 'normal', overflow: 'visible' }}>{song.title}</div>
                <div className="text-sm text-gray-400" style={{ whiteSpace: 'normal', overflow: 'visible' }}>{song.composer}</div>
              </div>

              {/* Language badge \u2014 matches member portal */}
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold text-white flex-shrink-0 ${getLangColor(song.language)}`}>
                {(song.language || '?').slice(0, 1)}
              </span>

              {/* Status \u2014 admin: tappable to cycle (uses existing handleStatusCycle which persists to church_song_status) */}
              <button
                onClick={(e) => handleStatusCycle(song.id, song.learning_status, e)}
                className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-base leading-none hover:scale-110 active:scale-95 transition-transform"
                title="Tap to change status"
              >
                {song.learning_status === 'learned' ? '\u2705' : song.learning_status === 'learning' ? '\uD83D\uDCDA' : '\u23F3'}
              </button>

              {/* 3-dot menu \u2014 super admin only */}
              {isSuperAdmin && (
                <div className="relative flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveActionMenu(activeActionMenu === song.id ? null : song.id);
                    }}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-300 hover:text-gray-500"
                    aria-label="Song options"
                  >
                    <svg width="4" height="16" viewBox="0 0 4 16" fill="currentColor">
                      <circle cx="2" cy="2" r="1.5" />
                      <circle cx="2" cy="8" r="1.5" />
                      <circle cx="2" cy="14" r="1.5" />
                    </svg>
                  </button>
                  {activeActionMenu === song.id && (
                    <div
                      className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden min-w-[180px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setActiveActionMenu(null); navigate(`${song.id}/edit`); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 min-h-[44px] text-left"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Edit song
                      </button>
                      <button
                        onClick={(e) => { handleDelete(song.id, e); setActiveActionMenu(null); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 min-h-[44px] text-left border-t border-gray-100"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3,6 5,6 21,6" />
                          <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6" />
                          <path d="M10,11v6" />
                          <path d="M14,11v6" />
                          <path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {isPaginated && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-white rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-sm text-gray-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}&ndash;{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} songs
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
              className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 min-h-[44px]">
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
              className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 min-h-[44px]">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-sm w-full max-h-[70vh] flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-bold">Add to Event ({selectedSongs.size})</h2>
              <button onClick={() => setShowEventModal(false)} className="p-2 min-h-[44px] min-w-[44px] hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
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
                      <div className="text-sm text-gray-500">{new Date(event.date + 'T00:00:00').toLocaleDateString()}</div>
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

    {/* PDF Modal Overlay */}
    {viewingSong && viewingSong.sheet_music_url && (
      <div className="fixed inset-0 z-[9999] bg-white">
        <button onClick={() => setViewingSong(null)}
          className="fixed top-3 left-3 z-[10000] px-4 py-2 text-sm font-semibold text-gray-700 bg-white/90 backdrop-blur border border-gray-200 rounded-full shadow-sm hover:bg-gray-100 transition">
          &larr; Back
        </button>
        <iframe
          src={(() => {
            const url = viewingSong.sheet_music_url || '';
            const match = url.match(/\/d\/([^/]+)/);
            if (match) return `https://drive.google.com/file/d/${match[1]}/preview?rm=minimal`;
            return url;
          })()}
          className="w-full h-full border-0"
          allow="autoplay"
        />
      </div>
    )}
  </>
  );
};
