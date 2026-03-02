import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Music, Search, Star, SlidersHorizontal } from 'lucide-react';
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
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'learned' | 'learning' | 'not_started'>('all');

  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("tab") === "favorites") setShowFavoritesOnly(true);
  }, [searchParams]);

  useEffect(() => {
    if (church?.id) { fetchSongs(); fetchFavorites(); }
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
    if (song.sheet_music_url && !pdfLoading) {
      setPdfLoading(true);
      navigate("/pdf-viewer", { state: { url: song.sheet_music_url, title: song.title, songId: song.id } });
      setTimeout(() => setPdfLoading(false), 1000);
    }
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
    <div className="space-y-2 p-3 max-w-4xl mx-auto pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Repertoire</h1>
        <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{filteredSongs.length} songs</span>
      </div>

      {/* Stats */}
      <div className="flex gap-1">
        {[
          { key: 'all' as const, label: 'Total', value: stats.total, cls: '' },
          { key: 'learned' as const, label: '✅', value: stats.learned, cls: 'bg-green-50 border-green-200' },
          { key: 'learning' as const, label: '📚', value: stats.learning, cls: 'bg-yellow-50 border-yellow-200' },
          { key: 'not_started' as const, label: '⏳', value: stats.notStarted, cls: 'bg-gray-50' },
        ].map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            className={`flex-1 rounded-lg border p-1.5 text-center transition ${s.cls} ${statusFilter === s.key ? 'ring-2 ring-indigo-500' : 'border-gray-200'}`}>
            <div className="text-base font-bold">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </button>
        ))}
        <div className="flex-1 rounded-lg border border-indigo-200 bg-indigo-50 p-1.5 text-center">
          <div className="text-sm font-bold text-indigo-700">{masteryRate}%</div>
          <div className="text-xs text-gray-500">Rate</div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-1.5">
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300 w-3.5 h-3.5" />
          <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 text-base border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`w-10 h-10 flex items-center justify-center rounded-lg border text-sm ${showFavoritesOnly ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-white border-gray-200'}`}>
          <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-white' : 'text-gray-400'}`} />
        </button>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`w-10 h-10 flex items-center justify-center rounded-lg border transition ${showFilters ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-2 flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-400 uppercase">Sort</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="w-full mt-0.5 px-2 py-2 text-sm border border-gray-200 rounded bg-white">
              <option value="a-z">A → Z</option><option value="z-a">Z → A</option><option value="recent">Recent</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-400 uppercase">Language</label>
            <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)} className="w-full mt-0.5 px-2 py-2 text-sm border border-gray-200 rounded bg-white">
              <option value="all">All</option><option value="english">English</option><option value="french">French</option><option value="portuguese">Portuguese</option><option value="lingala">Lingala</option><option value="tshiluba">Tshiluba</option><option value="kikongo">Kikongo</option><option value="swahili">Swahili</option>
            </select>
          </div>
        </div>
      )}

      {/* Active filters */}
      {statusFilter !== 'all' && (
        <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-2 py-1.5">
          <span className="text-sm font-medium text-indigo-800">
            {statusFilter === 'learned' ? '✅ Learned' : statusFilter === 'learning' ? '📚 Learning' : '⏳ Not Started'}
          </span>
          <button onClick={() => setStatusFilter('all')} className="text-sm text-indigo-600">Clear</button>
        </div>
      )}

      {showFavoritesOnly && (
        <div className="flex items-center justify-between bg-yellow-50 rounded-lg px-2 py-1.5">
          <span className="text-sm font-medium text-yellow-800">⭐ {favorites.size} favorites</span>
          <button onClick={() => setShowFavoritesOnly(false)} className="text-sm text-yellow-600">Clear</button>
        </div>
      )}

      {/* Songs */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredSongs.length === 0 ? (
          <div className="text-center py-10">
            <Music className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-gray-900">{showFavoritesOnly ? 'No favorites yet' : 'No songs found'}</h3>
            <p className="text-sm text-gray-400">{showFavoritesOnly ? 'Tap ★ to add favorites' : 'Try adjusting your filters'}</p>
          </div>
        ) : filteredSongs.map((song, i) => {
          const isFav = favorites.has(song.id);
          return (
            <div key={song.id}
              className={`flex items-center gap-3 px-3 py-3 ${i !== filteredSongs.length - 1 ? 'border-b border-gray-100' : ''}`}>
              {/* Star */}
              <button onClick={(e) => toggleFavorite(song.id, e)} className="flex-shrink-0 text-base leading-none">
                <span className={isFav ? 'text-yellow-500' : 'text-gray-300'}>{isFav ? '★' : '☆'}</span>
              </button>
              {/* Info — tap to open PDF */}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => song.sheet_music_url && handleViewPDF(song)}>
                <div className={`text-sm font-semibold truncate ${song.sheet_music_url ? 'text-gray-900 active:text-indigo-600' : 'text-gray-900'}`}>{song.title}</div>
                <div className="text-sm text-gray-400 truncate">{song.composer}</div>
              </div>
              {/* Language */}
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold text-white flex-shrink-0 ${getLangColor(song.language)}`}>
                {(song.language || '?').slice(0, 1)}
              </span>
              {/* Status — read only */}
              <span className="flex-shrink-0 text-base leading-none">
                {song.learning_status === 'learned' ? '✅' : song.learning_status === 'learning' ? '📚' : '⏳'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
