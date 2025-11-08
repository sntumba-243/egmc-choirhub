import { useEffect, useState } from 'react';
import { Search, Heart, Eye, X, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Song {
  id: string;
  title: string;
  composer?: string;
  language?: string;
  sheet_music_url?: string;
}

export const MemberRepertoire = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  useEffect(() => {
    filterSongs();
  }, [songs, searchTerm, languageFilter]);

  const fetchUserId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchData = async () => {
    try {
      const [songsRes, favoritesRes] = await Promise.all([
        supabase.from('songs').select('*').order('title'),
        supabase.from('favorites').select('song_id').eq('user_id', userId)
      ]);

      if (songsRes.error) throw songsRes.error;
      setSongs(songsRes.data || []);
      
      if (favoritesRes.data) {
        setFavorites(new Set(favoritesRes.data.map(f => f.song_id)));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSongs = () => {
    let filtered = songs;

    if (searchTerm) {
      filtered = filtered.filter(song =>
        song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.composer?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (languageFilter !== 'all') {
      filtered = filtered.filter(song => song.language === languageFilter);
    }

    setFilteredSongs(filtered);
  };

  const toggleFavorite = async (songId: string) => {
    try {
      if (favorites.has(songId)) {
        await supabase.from('favorites').delete().eq('user_id', userId).eq('song_id', songId);
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(songId);
          return newSet;
        });
      } else {
        await supabase.from('favorites').insert([{ user_id: userId, song_id: songId }]);
        setFavorites(prev => new Set(prev).add(songId));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const getEmbedUrl = (url: string): string => {
    try {
      if (url.includes('drive.google.com')) {
        const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
        }
      }
      return url;
    } catch (error) {
      return '';
    }
  };

  const languages = ['all', ...Array.from(new Set(songs.map(s => s.language).filter(Boolean)))];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-3"></div>
        <p className="text-gray-600 text-sm">Loading repertoire...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Repertoire</h1>
        <div className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
          {filteredSongs.length}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search songs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Filters Toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">
          {languageFilter === 'all' ? 'All Languages' : languageFilter}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
      </button>

      {/* Language Filter Dropdown */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <label className="block text-xs font-medium text-gray-700 mb-2">Language</label>
          <select
            value={languageFilter}
            onChange={(e) => {
              setLanguageFilter(e.target.value);
              setShowFilters(false);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          >
            {languages.map(lang => (
              <option key={lang} value={lang}>
                {lang === 'all' ? 'All Languages' : lang}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Songs List */}
      {filteredSongs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-sm">
            {songs.length === 0 ? 'No songs in repertoire yet' : 'No songs found'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {filteredSongs.map((song) => (
            <div
              key={song.id}
              className="px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
            >
              {/* Song Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {song.title}
                </h3>
                {song.language && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-full">
                    {song.language}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Favorite Button */}
                <button
                  onClick={() => toggleFavorite(song.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    favorites.has(song.id)
                      ? 'text-red-600 bg-red-50 hover:bg-red-100'
                      : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                  }`}
                  aria-label="Toggle favorite"
                >
                  <Heart
                    className={`w-4 h-4 ${favorites.has(song.id) ? 'fill-current' : ''}`}
                  />
                </button>

                {/* View Button */}
                {song.sheet_music_url && (
                  <button
                    onClick={() => setViewingSong(song)}
                    className="p-2 rounded-lg text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
                    aria-label="View sheet music"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Sheet Music Viewer */}
      {viewingSong && viewingSong.sheet_music_url && getEmbedUrl(viewingSong.sheet_music_url) && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-xl sm:rounded-lg w-full sm:w-full sm:max-w-4xl max-h-[90vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">
                  {viewingSong.title}
                </h2>
                {viewingSong.composer && (
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    {viewingSong.composer}
                  </p>
                )}
              </div>
              <button
                onClick={() => setViewingSong(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Sheet Music */}
            <div className="flex-1 overflow-auto">
              <iframe
                src={getEmbedUrl(viewingSong.sheet_music_url)}
                className="w-full h-full"
                title={viewingSong.title}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
