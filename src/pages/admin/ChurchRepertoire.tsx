import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Music, Search, Grid3x3, List, Star, CheckCircle, BookOpen, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

interface Song {
  id: string;
  title: string;
  composer: string;
  language: string;
  sheet_music_url?: string;
  created_at?: string;
}

type Status = 'learned' | 'learning' | 'not_started';

export const ChurchRepertoire = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'a-z' | 'z-a' | 'recent'>('a-z');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [user?.church_id]);

  const fetchData = async () => {
    try {
      const [songsRes, statusRes, favRes] = await Promise.all([
        supabase.from('songs').select('*').order('title', { ascending: true }),
        supabase.from('church_song_status').select('song_id, status').eq('church_id', user?.church_id),
        user?.id ? supabase.from('user_favorites').select('song_id').eq('user_id', user.id) : Promise.resolve({ data: [] }),
      ]);

      setSongs(songsRes.data || []);

      const map: Record<string, Status> = {};
      (statusRes.data || []).forEach((s: any) => { map[s.song_id] = s.status; });
      setStatusMap(map);

      setFavorites(new Set((favRes.data || []).map((f: any) => f.song_id)));
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (songId: string): Status => statusMap[songId] || 'not_started';

  const updateStatus = async (e: React.MouseEvent, songId: string, newStatus: Status) => {
    e.stopPropagation();
    if (!user?.church_id) return;
    setUpdatingId(songId);

    try {
      const { error } = await supabase
        .from('church_song_status')
        .upsert({
          church_id: user.church_id,
          song_id: songId,
          status: newStatus,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'church_id,song_id' });

      if (error) throw error;
      setStatusMap(prev => ({ ...prev, [songId]: newStatus }));
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleFavorite = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    try {
      if (favorites.has(songId)) {
        await supabase.from('user_favorites').delete().eq('user_id', user.id).eq('song_id', songId);
        const newFavorites = new Set(favorites);
        newFavorites.delete(songId);
        setFavorites(newFavorites);
      } else {
        await supabase.from('user_favorites').insert({ user_id: user.id, song_id: songId });
        const newFavorites = new Set(favorites);
        newFavorites.add(songId);
        setFavorites(newFavorites);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleViewPDF = (song: Song) => {
    if (song.sheet_music_url) {
      navigate('/pdf-viewer', {
        state: { url: song.sheet_music_url, title: song.title }
      });
    }
  };

  const getStatusEmoji = (songId: string) => {
    const status = getStatus(songId);
    switch (status) {
      case 'learned': return <span className="text-xs">✅</span>;
      case 'learning': return <span className="text-xs">📚</span>;
      case 'not_started': return <span className="text-xs">⏳</span>;
    }
  };

  const languages = [...new Set(songs.map(s => s.language).filter(Boolean))].sort();
  const langCounts: Record<string, number> = {};
  languages.forEach(l => { langCounts[l] = songs.filter(s => s.language === l).length; });

  const filteredSongs = songs.filter(song => {
    if (languageFilter !== 'all' && song.language?.toLowerCase() !== languageFilter) return false;
    if (statusFilter !== 'all' && getStatus(song.id) !== statusFilter) return false;

    const search = searchTerm.toLowerCase();
    const matchesSearch = song.title.toLowerCase().includes(search) || song.composer?.toLowerCase().includes(search);

    if (showFavoritesOnly) return matchesSearch && favorites.has(song.id);
    return matchesSearch;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'a-z': return a.title.localeCompare(b.title);
      case 'z-a': return b.title.localeCompare(a.title);
      case 'recent': return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      default: return 0;
    }
  });

  const stats = {
    total: songs.length,
    learned: songs.filter(s => getStatus(s.id) === 'learned').length,
    learning: songs.filter(s => getStatus(s.id) === 'learning').length,
    notStarted: songs.filter(s => getStatus(s.id) === 'not_started').length,
  };
  const masteryRate = stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Repertoire</h1>
        <p className="text-xs text-gray-600 mt-0.5">
          {filteredSongs.length} of {songs.length} songs
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`bg-white rounded-lg shadow-sm border p-2 text-center transition ${
            statusFilter === 'all' ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
          }`}
        >
          <div className="text-lg font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-600">Total</div>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'learned' ? 'all' : 'learned')}
          className={`bg-green-50 border rounded-lg shadow-sm p-2 text-center transition ${
            statusFilter === 'learned' ? 'ring-2 ring-green-500 border-green-500' : 'border-green-200'
          }`}
        >
          <div className="text-lg font-bold text-green-700">{stats.learned}</div>
          <div className="text-xs text-gray-700">✅</div>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'learning' ? 'all' : 'learning')}
          className={`bg-yellow-50 border rounded-lg shadow-sm p-2 text-center transition ${
            statusFilter === 'learning' ? 'ring-2 ring-yellow-500 border-yellow-500' : 'border-yellow-200'
          }`}
        >
          <div className="text-lg font-bold text-yellow-700">{stats.learning}</div>
          <div className="text-xs text-gray-700">📚</div>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'not_started' ? 'all' : 'not_started')}
          className={`bg-gray-50 border rounded-lg shadow-sm p-2 text-center transition ${
            statusFilter === 'not_started' ? 'ring-2 ring-gray-500 border-gray-500' : 'border-gray-200'
          }`}
        >
          <div className="text-lg font-bold text-gray-700">{stats.notStarted}</div>
          <div className="text-xs text-gray-700">⏳</div>
        </button>
        <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-sm p-2 text-center">
          <div className="text-lg font-bold text-blue-700">{masteryRate}%</div>
          <div className="text-xs text-gray-700">Rate</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search songs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white font-medium text-gray-700"
          >
            <option value="a-z">A → Z</option>
            <option value="z-a">Z → A</option>
            <option value="recent">Recent</option>
          </select>

          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white font-medium text-gray-700"
          >
            <option value="all">All ({songs.length})</option>
            {languages.map(l => (
              <option key={l} value={l.toLowerCase()}>{l} ({langCounts[l]})</option>
            ))}
          </select>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 min-h-[44px] min-w-[44px] rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 min-h-[44px] min-w-[44px] rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            showFavoritesOnly ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-white' : ''}`} />
          Favorites {favorites.size > 0 && `(${favorites.size})`}
        </button>
      </div>

      {/* Song List */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {filteredSongs.map((song) => {
            const isFavorite = favorites.has(song.id);
            const status = getStatus(song.id);
            const isUpdating = updatingId === song.id;

            return (
              <div
                key={song.id}
                onClick={() => song.sheet_music_url && handleViewPDF(song)}
                className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 transition ${
                  song.sheet_music_url ? 'cursor-pointer' : ''
                }`}
              >
                <button
                  onClick={(e) => toggleFavorite(song.id, e)}
                  className="flex-shrink-0"
                >
                  <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                </button>

                <div className="flex-shrink-0">
                  {getStatusEmoji(song.id)}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">{song.title}</h4>
                  <p className="text-xs text-gray-600 truncate">{song.composer}</p>
                </div>

                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0 ${
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

                {/* Status action buttons */}
                <div className={`flex items-center gap-0.5 flex-shrink-0 ${isUpdating ? 'opacity-40' : ''}`}>
                  <button
                    onClick={(e) => updateStatus(e, song.id, 'learned')}
                    disabled={isUpdating}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                      status === 'learned'
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'text-gray-300 hover:text-green-500 hover:bg-green-50'
                    }`}
                    title="Learned"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => updateStatus(e, song.id, 'learning')}
                    disabled={isUpdating}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                      status === 'learning'
                        ? 'bg-yellow-500 text-white shadow-sm'
                        : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50'
                    }`}
                    title="Learning"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => updateStatus(e, song.id, 'not_started')}
                    disabled={isUpdating}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                      status === 'not_started'
                        ? 'bg-gray-500 text-white shadow-sm'
                        : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                    }`}
                    title="Not Started"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}

          {filteredSongs.length === 0 && (
            <div className="text-center py-12">
              <Music className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">No songs found</h3>
              <p className="text-xs text-gray-500">Try adjusting your filters</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filteredSongs.map((song) => {
            const isFavorite = favorites.has(song.id);
            const isUpdating = updatingId === song.id;
            const status = getStatus(song.id);
            const langColor = song.language === 'English' ? 'bg-blue-500' : song.language === 'French' ? 'bg-purple-500' : song.language === 'Lingala' ? 'bg-green-500' : song.language === 'Tshiluba' ? 'bg-yellow-500' : song.language === 'Swahili' ? 'bg-teal-500' : song.language === 'Kikongo' ? 'bg-orange-500' : song.language === 'Portuguese' ? 'bg-pink-500' : 'bg-gray-400';
            const langCode = (song.language || '??').slice(0, 2).toUpperCase();
            const langTextColor = song.language === 'English' ? 'text-blue-600 bg-blue-50' : song.language === 'French' ? 'text-purple-600 bg-purple-50' : song.language === 'Lingala' ? 'text-green-600 bg-green-50' : song.language === 'Tshiluba' ? 'text-yellow-600 bg-yellow-50' : song.language === 'Swahili' ? 'text-teal-600 bg-teal-50' : song.language === 'Kikongo' ? 'text-orange-600 bg-orange-50' : song.language === 'Portuguese' ? 'text-pink-600 bg-pink-50' : 'text-gray-600 bg-gray-50';
            const statusColor = status === 'learned' ? 'bg-green-500' : status === 'learning' ? 'bg-yellow-500' : 'bg-gray-300';

            return (
              <div
                key={song.id}
                onClick={() => song.sheet_music_url && handleViewPDF(song)}
                className={`group bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border overflow-hidden flex border-gray-100 hover:border-gray-200 ${
                  song.sheet_music_url ? 'cursor-pointer' : ''
                }`}
              >
                <div className={`w-1 ${langColor} flex-shrink-0 rounded-l-2xl`} />
                <div className="flex-1 p-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="text-[13px] font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors flex-1 mr-2">{song.title}</h3>
                    <button onClick={(e) => toggleFavorite(song.id, e)} className="flex-shrink-0">
                      <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 truncate mb-2">{song.composer}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${langTextColor}`}>{langCode}</span>
                      <div className={`w-3.5 h-3.5 rounded ${statusColor} flex items-center justify-center`}>
                        {status === 'learned' && <CheckCircle className="w-2 h-2 text-white" strokeWidth={3} />}
                        {status === 'learning' && <BookOpen className="w-2 h-2 text-white" strokeWidth={3} />}
                        {status === 'not_started' && <Clock className="w-2 h-2 text-white" strokeWidth={3} />}
                      </div>
                    </div>
                    <div className={`flex gap-0.5 ${isUpdating ? 'opacity-40' : ''}`}>
                      <button
                        onClick={(e) => updateStatus(e, song.id, 'learned')}
                        disabled={isUpdating}
                        className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                          status === 'learned' ? 'bg-green-500 text-white' : 'text-gray-300 hover:text-green-500'
                        }`}
                        title="Learned"
                      >
                        <CheckCircle className="w-2.5 h-2.5" strokeWidth={3} />
                      </button>
                      <button
                        onClick={(e) => updateStatus(e, song.id, 'learning')}
                        disabled={isUpdating}
                        className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                          status === 'learning' ? 'bg-yellow-500 text-white' : 'text-gray-300 hover:text-yellow-500'
                        }`}
                        title="Learning"
                      >
                        <BookOpen className="w-2.5 h-2.5" strokeWidth={3} />
                      </button>
                      <button
                        onClick={(e) => updateStatus(e, song.id, 'not_started')}
                        disabled={isUpdating}
                        className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                          status === 'not_started' ? 'bg-gray-500 text-white' : 'text-gray-300 hover:text-gray-500'
                        }`}
                        title="Not Started"
                      >
                        <Clock className="w-2.5 h-2.5" strokeWidth={3} />
                      </button>

                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
