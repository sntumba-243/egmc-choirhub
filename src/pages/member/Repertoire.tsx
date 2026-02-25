import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Music, Search, Eye, Star, SlidersHorizontal } from 'lucide-react';
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

export const MemberRepertoire = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { church } = useChurch();
  const [songs, setSongs] = useState<SongWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'a-z' | 'z-a' | 'recent'>('a-z');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'english' | 'french' | 'portuguese' | 'lingala' | 'tshiluba' | 'kikongo' | 'swahili'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'learned' | 'learning' | 'not_started'>('all');

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "favorites") {
      setShowFavoritesOnly(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (church?.id) {
      fetchSongs();
      fetchFavorites();
    }
  }, [church?.id]);

  const fetchSongs = async () => {
    if (!church?.id) return;
    try {
      // Fetch all songs (global)
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .order('title', { ascending: true });

      if (songsError) throw songsError;

      // Fetch per-church learning status
      const { data: statusData, error: statusError } = await supabase
        .from('church_song_status')
        .select('song_id, status')
        .eq('church_id', church.id);

      if (statusError) throw statusError;

      // Build a map of song_id -> status
      const statusMap = new Map<string, 'learned' | 'learning' | 'not_started'>();
      (statusData || []).forEach((s: any) => {
        statusMap.set(s.song_id, s.status);
      });

      // Merge songs with their per-church status
      const merged: SongWithStatus[] = (songsData || []).map((song: Song) => ({
        ...song,
        learning_status: statusMap.get(song.id) || 'not_started',
      }));

      setSongs(merged);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load songs');
    } finally {
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

      const { data, error } = await supabase
        .from('user_favorites')
        .select('song_id')
        .eq('user_id', authUid);

      if (error) throw error;
      const favSet = new Set(data?.map(f => f.song_id) || []);
      setFavorites(favSet);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const toggleFavorite = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const authUid = await getAuthUid();
    if (!authUid) return;

    const isFavorite = favorites.has(songId);

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', authUid)
          .eq('song_id', songId);

        if (error) throw error;

        const newFavorites = new Set(favorites);
        newFavorites.delete(songId);
        setFavorites(newFavorites);
        toast.success('Removed from favorites');
      } else {
        const { error } = await supabase
          .from('user_favorites')
          .insert({ user_id: authUid, song_id: songId });

        if (error) throw error;

        const newFavorites = new Set(favorites);
        newFavorites.add(songId);
        setFavorites(newFavorites);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const handleViewPDF = (song: Song) => {
    if (song.sheet_music_url && !pdfLoading) {
      setPdfLoading(true);
      navigate("/pdf-viewer", {
        state: { url: song.sheet_music_url, title: song.title, songId: song.id }
      });
      setTimeout(() => setPdfLoading(false), 1000);
    }
  };

  const stats = {
    total: songs.length,
    learned: songs.filter(s => s.learning_status === 'learned').length,
    learning: songs.filter(s => s.learning_status === 'learning').length,
    notStarted: songs.filter(s => s.learning_status === 'not_started').length,
  };

  const masteryRate = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;

  const filterByLanguage = (song: Song): boolean => {
    if (languageFilter === 'all') return true;
    if (languageFilter === 'english') return song.language === 'English';
    if (languageFilter === 'french') return song.language === 'French';
    if (languageFilter === 'portuguese') return song.language === 'Portuguese';
    if (languageFilter === 'lingala') return song.language === 'Lingala';
    if (languageFilter === 'tshiluba') return song.language === 'Tshiluba';
    if (languageFilter === 'kikongo') return song.language === 'Kikongo';
    if (languageFilter === 'swahili') return song.language === 'Swahili';
    return true;
  };

  const filteredSongs = songs.filter(song => {
    if (statusFilter !== 'all' && song.learning_status !== statusFilter) {
      return false;
    }

    const search = searchTerm.toLowerCase();
    const titleMatch = song.title.toLowerCase().includes(search);
    const composerMatch = song.composer?.toLowerCase().includes(search);
    const matchesSearch = titleMatch || composerMatch;
    const matchesLanguage = filterByLanguage(song);

    if (showFavoritesOnly) {
      return matchesSearch && matchesLanguage && favorites.has(song.id);
    }

    return matchesSearch && matchesLanguage;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'a-z':
        return a.title.localeCompare(b.title);
      case 'z-a':
        return b.title.localeCompare(a.title);
      case 'recent':
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      default:
        return 0;
    }
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'learned':
        return <span className="text-xs">✅</span>;
      case 'learning':
        return <span className="text-xs">📚</span>;
      case 'not_started':
        return <span className="text-xs">⏳</span>;
      default:
        return <span className="text-xs">⏳</span>;
    }
  };

  const favoriteCount = favorites.size;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading repertoire...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Minimal Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-gray-900">Repertoire</h1>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {filteredSongs.length} songs
        </span>
      </div>

      {/* Compact Stats Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-3">
        <button
          onClick={() => setStatusFilter('all')}
          className={`bg-white rounded-lg shadow-sm p-1.5 text-center transition-all ${
            statusFilter === 'all' ? 'ring-2 ring-indigo-500' : ''
          }`}
        >
          <div className="text-base font-bold text-gray-900">{stats.total}</div>
          <div className="text-[10px] text-gray-600">Total</div>
        </button>
        <button
          onClick={() => setStatusFilter('learned')}
          className={`bg-green-50 border border-green-200 rounded-lg shadow-sm p-1.5 text-center transition-all ${
            statusFilter === 'learned' ? 'ring-2 ring-green-500' : ''
          }`}
        >
          <div className="text-base font-bold text-green-600">{stats.learned}</div>
          <div className="text-[10px] text-gray-600">✅</div>
        </button>
        <button
          onClick={() => setStatusFilter('learning')}
          className={`bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm p-1.5 text-center transition-all ${
            statusFilter === 'learning' ? 'ring-2 ring-yellow-500' : ''
          }`}
        >
          <div className="text-base font-bold text-yellow-600">{stats.learning}</div>
          <div className="text-[10px] text-gray-600">📚</div>
        </button>
        <button
          onClick={() => setStatusFilter('not_started')}
          className={`bg-gray-50 border border-gray-200 rounded-lg shadow-sm p-1.5 text-center transition-all ${
            statusFilter === 'not_started' ? 'ring-2 ring-gray-500' : ''
          }`}
        >
          <div className="text-base font-bold text-gray-600">{stats.notStarted}</div>
          <div className="text-[10px] text-gray-600">⏳</div>
        </button>
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm p-1.5 text-center">
          <div className="text-base font-bold text-indigo-600">{masteryRate}%</div>
          <div className="text-[10px] text-gray-600">Rate</div>
        </div>
      </div>

      {/* Search + Filter Icons */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`p-2.5 rounded-xl transition-all ${
            showFavoritesOnly
              ? 'bg-yellow-500 text-white shadow-md'
              : 'bg-white border border-gray-200 text-gray-600'
          }`}
        >
          <Star className={`w-5 h-5 ${showFavoritesOnly ? 'fill-white' : ''}`} />
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2.5 rounded-xl transition-all ${
            showFilters
              ? 'bg-purple-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Expandable Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl p-3 mb-3 border border-gray-200 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Sort</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="a-z">A → Z</option>
                <option value="z-a">Z → A</option>
                <option value="recent">Recent</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Language</label>
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="all">All</option>
                <option value="english">English</option>
                <option value="french">French</option>
                <option value="portuguese">Portuguese</option>
                <option value="lingala">Lingala</option>
                <option value="tshiluba">Tshiluba</option>
                <option value="kikongo">Kikongo</option>
                <option value="swahili">Swahili</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Indicators */}
      {statusFilter !== 'all' && (
        <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2 mb-3">
          <span className="text-sm font-medium text-indigo-800">
            Filtering by: {statusFilter === 'learned' ? '✅ Learned' : statusFilter === 'learning' ? '📚 Learning' : '⏳ Not Started'}
          </span>
          <button
            onClick={() => setStatusFilter('all')}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            Clear
          </button>
        </div>
      )}

      {/* Favorites indicator when active */}
      {showFavoritesOnly && (
        <div className="flex items-center justify-between bg-yellow-50 rounded-lg px-3 py-2 mb-3">
          <span className="text-sm font-medium text-yellow-800">
            ⭐ Showing {favoriteCount} favorites
          </span>
          <button
            onClick={() => setShowFavoritesOnly(false)}
            className="text-xs text-yellow-600 hover:text-yellow-800"
          >
            Clear
          </button>
        </div>
      )}

      {/* Song List — view only for members (no edit/delete/status controls) */}
      <div className="bg-white rounded-xl overflow-hidden shadow-sm">
        {filteredSongs.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">
              {showFavoritesOnly ? 'No favorites yet' : 'No songs found'}
            </h3>
            <p className="text-sm text-gray-500">
              {showFavoritesOnly
                ? 'Tap the star on songs to add favorites!'
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          filteredSongs.map((song, index) => {
            const isFavorite = favorites.has(song.id);
            return (
              <div
                key={song.id}
                onClick={() => song.sheet_music_url && handleViewPDF(song)}
                className={`flex items-center gap-3 px-3 py-3 active:bg-gray-50 ${
                  index !== filteredSongs.length - 1 ? 'border-b border-gray-100' : ''
                } ${song.sheet_music_url ? 'cursor-pointer' : ''}`}
              >
                {/* Star — members can toggle favorites */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(song.id, e);
                  }}
                  className="flex-shrink-0"
                >
                  <span className={`text-lg ${isFavorite ? 'text-yellow-500' : 'text-gray-300'}`}>
                    {isFavorite ? '★' : '☆'}
                  </span>
                </button>

                {/* Learning Status Badge (read-only for members) */}
                <div className="flex-shrink-0">
                  {getStatusBadge(song.learning_status)}
                </div>

                {/* Title */}
                <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                  {song.title}
                </span>

                {/* Language Badge */}
                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0 ${
                  song.language === 'English' ? 'bg-blue-500' :
                  song.language === 'French' ? 'bg-purple-500' :
                  song.language === 'Lingala' ? 'bg-green-500' :
                  song.language === 'Tshiluba' ? 'bg-yellow-500' :
                  song.language === 'Swahili' ? 'bg-teal-500' :
                  song.language === 'Kikongo' ? 'bg-orange-500' :
                  song.language === 'Portuguese' ? 'bg-pink-500' :
                  'bg-gray-400'
                }`}>
                  {(song.language || '??').slice(0, 1)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
