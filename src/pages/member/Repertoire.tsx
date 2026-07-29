import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Music, Search, Star, SlidersHorizontal, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../contexts/ChurchContext';
import SheetMusicViewer from '../../components/SheetMusicViewer';
import { createSongSearcher } from '../../lib/smartSearch';

const PAGE_SIZE = 20;

interface Song {
  id: string;
  title: string;
  composer: string;
  language: string;
  sheet_music_url?: string;
  created_at?: string;
  updated_at?: string;
}

interface SongWithStatus extends Song {
  learning_status: 'learned' | 'learning' | 'not_started';
}

interface ChurchSong {
  id: string;
  title: string;
  composer: string;
  partition_url: string | null;
}

export const MemberRepertoire = () => {
  const { user } = useAuth();
  const { church } = useChurch();
  const [songs, setSongs] = useState<SongWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [churchSongs, setChurchSongs] = useState<ChurchSong[]>([]);
  const [churchSongsLoading, setChurchSongsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'a-z' | 'z-a' | 'recent'>('a-z');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'learned' | 'learning' | 'not_started'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [songStats, setSongStats] = useState({ total: 0, learned: 0, learning: 0, notStarted: 0 });
  const [statusMap, setStatusMap] = useState<Map<string, 'learned' | 'learning' | 'not_started'>>(new Map());

  const [searchParams] = useSearchParams();

  const isPaginated = !debouncedSearch.trim() && statusFilter === 'all' && !showFavoritesOnly;
  const totalPages = isPaginated ? Math.ceil(totalCount / PAGE_SIZE) : 1;

  useEffect(() => {
    if (searchParams.get("tab") === "favorites") setShowFavoritesOnly(true);
  }, [searchParams]);

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
    if (church?.id) { initData(); fetchFavorites(); fetchChurchSongs(); }
  }, [church?.id]);

  // Refetch when page or filters change
  useEffect(() => {
    if (!church?.id || loading) return;
    fetchSongs(currentPage);
  }, [currentPage, debouncedSearch, languageFilter, sortBy, statusFilter, showFavoritesOnly]);

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
      // Fuzzy search is client-side (accent/typo-tolerant) — no server ilike here.
      // When search is active, pagination is off below, so ALL songs are fetched
      // for Fuse to rank.

      const shouldPaginate = !search && statusFilter === 'all' && !showFavoritesOnly;
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

      // Fuzzy search first (relevance-ranked, best match first), then the
      // existing filters on its output. Empty search keeps the server sort order.
      if (search) {
        result = createSongSearcher(result)(search);
      }

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

  const fetchChurchSongs = async () => {
    if (!church?.id) return;
    setChurchSongsLoading(true);
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, composer, partition_url')
        .eq('church_id', church.id)
        .order('title', { ascending: true });
      if (error) throw error;
      setChurchSongs(data || []);
    } catch (error) {
      console.error('Error fetching church songs:', error);
    } finally {
      setChurchSongsLoading(false);
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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
    </div>
  );

  return (
    <div className="space-y-2 p-3 max-w-4xl mx-auto pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Repertoire</h1>
        <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {isPaginated ? `${totalCount} songs` : `${songs.length} songs`}
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-1">
        {[
          { key: 'all' as const, label: 'Total', value: songStats.total, cls: '' },
          { key: 'learned' as const, label: '\u2705', value: songStats.learned, cls: 'bg-green-50 border-green-200' },
          { key: 'learning' as const, label: '\uD83D\uDCDA', value: songStats.learning, cls: 'bg-yellow-50 border-yellow-200' },
          { key: 'not_started' as const, label: '\u23F3', value: songStats.notStarted, cls: 'bg-gray-50' },
        ].map(s => (
          <button key={s.key} onClick={() => { setStatusFilter(s.key); setCurrentPage(1); }}
            className={`flex-1 rounded-lg border p-1.5 min-h-[44px] text-center transition ${s.cls} ${statusFilter === s.key ? 'ring-2 ring-orange-500' : 'border-gray-200'}`}>
            <div className="text-base font-bold">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </button>
        ))}
        <div className="flex-1 rounded-lg border border-orange-200 bg-orange-50 p-1.5 text-center">
          <div className="text-sm font-bold text-orange-700">{masteryRate}%</div>
          <div className="text-xs text-gray-500">Rate</div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-1.5">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 w-3.5 h-3.5" />
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 text-base border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
        </div>
        <button onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setCurrentPage(1); }}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border text-sm ${showFavoritesOnly ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-white border-gray-200'}`}>
          <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-white' : 'text-gray-400'}`} />
        </button>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border transition ${showFilters ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-2 flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-400 uppercase">Sort</label>
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as any); setCurrentPage(1); }} className="w-full mt-0.5 px-2 py-2 text-sm border border-gray-200 rounded bg-white">
              <option value="a-z">A &rarr; Z</option><option value="z-a">Z &rarr; A</option><option value="recent">Recent</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-400 uppercase">Language</label>
            <select value={languageFilter} onChange={(e) => { setLanguageFilter(e.target.value); setCurrentPage(1); }} className="w-full mt-0.5 px-2 py-2 text-sm border border-gray-200 rounded bg-white">
              <option value="all">All</option><option value="english">English</option><option value="french">French</option><option value="portuguese">Portuguese</option><option value="lingala">Lingala</option><option value="tshiluba">Tshiluba</option><option value="kikongo">Kikongo</option><option value="swahili">Swahili</option>
            </select>
          </div>
        </div>
      )}

      {/* Active filters */}
      {statusFilter !== 'all' && (
        <div className="flex items-center justify-between bg-orange-50 rounded-lg px-2 py-1.5">
          <span className="text-sm font-medium text-orange-800">
            {statusFilter === 'learned' ? '\u2705 Learned' : statusFilter === 'learning' ? '\uD83D\uDCDA Learning' : '\u23F3 Not Started'}
          </span>
          <button onClick={() => { setStatusFilter('all'); setCurrentPage(1); }} className="text-sm text-orange-600">Clear</button>
        </div>
      )}

      {showFavoritesOnly && (
        <div className="flex items-center justify-between bg-yellow-50 rounded-lg px-2 py-1.5">
          <span className="text-sm font-medium text-yellow-800">{'\u2B50'} {favorites.size} favorites</span>
          <button onClick={() => { setShowFavoritesOnly(false); setCurrentPage(1); }} className="text-sm text-yellow-600">Clear</button>
        </div>
      )}

      {/* Songs */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden relative">
        {pageLoading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        )}
        {songs.length === 0 && !pageLoading ? (
          <div className="text-center py-10">
            <Music className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-gray-900">{showFavoritesOnly ? 'No favorites yet' : 'No songs found'}</h3>
            <p className="text-sm text-gray-400">{showFavoritesOnly ? 'Tap \u2605 to add favorites' : 'Try adjusting your filters'}</p>
          </div>
        ) : songs.map((song, i) => {
          const isFav = favorites.has(song.id);
          return (
            <div key={song.id}
              className={`flex items-center gap-3 px-3 py-3 ${i !== songs.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <button onClick={(e) => toggleFavorite(song.id, e)} className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-base leading-none" aria-label={isFav ? 'Remove favorite' : 'Add favorite'}>
                <span className={isFav ? 'text-yellow-500' : 'text-gray-300'}>{isFav ? '\u2605' : '\u2606'}</span>
              </button>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => song.sheet_music_url && handleViewPDF(song)}>
                <div className={`text-sm font-semibold ${song.sheet_music_url ? 'text-gray-900 active:text-orange-600' : 'text-gray-900'}`} style={{ whiteSpace: 'normal', overflow: 'visible' }}>{song.title}</div>
                <div className="text-sm text-gray-400" style={{ whiteSpace: 'normal', overflow: 'visible' }}>{song.composer}</div>
              </div>
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold text-white flex-shrink-0 ${getLangColor(song.language)}`}>
                {(song.language || '?').slice(0, 1)}
              </span>
              <span className="flex-shrink-0 text-base leading-none">
                {song.learning_status === 'learned' ? '\u2705' : song.learning_status === 'learning' ? '\uD83D\uDCDA' : '\u23F3'}
              </span>
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
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50">
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Church Songs */}
      {churchSongs.length > 0 && (
        <div className="mt-4">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Your Church Songs</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {churchSongs.map((song, i) => (
              <div key={song.id} className={`flex items-center gap-3 px-3 py-3 ${i !== churchSongs.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{song.title}</div>
                  <div className="text-sm text-gray-400">{song.composer}</div>
                </div>
                {song.partition_url && (
                  <button
                    onClick={() => window.open(song.partition_url!, '_blank', 'noopener')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex-shrink-0"
                  >
                    <Music className="w-3 h-3" />
                    View Sheet Music
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF Modal Overlay */}
      {viewingSong && viewingSong.sheet_music_url && (
        <SheetMusicViewer
          url={viewingSong.sheet_music_url}
          title={viewingSong.title}
          version={viewingSong.updated_at}
          onClose={() => setViewingSong(null)}
        />
      )}
    </div>
  );
};
