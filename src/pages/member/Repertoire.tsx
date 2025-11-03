import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, X, Search, Heart, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface Song {
  id: string;
  title: string;
  composer?: string;
  language?: string;
  sheet_music_url?: string;
  audio_url?: string;
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
      if (user) {
        setUserId(user.id);
      }
    } catch (error) {
      console.error('Error fetching user ID:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('id, title, composer, language, sheet_music_url, audio_url')
        .order('title', { ascending: true });

      if (songsError) {
        console.error('Songs error:', songsError);
        toast.error('Failed to load songs');
        setLoading(false);
        return;
      }

      const { data: favoritesData, error: favoritesError } = await supabase
        .from('song_favorites')
        .select('song_id')
        .eq('member_id', userId);

      if (favoritesError) {
        console.error('Favorites error:', favoritesError);
      } else if (favoritesData) {
        const favoriteIds = new Set(favoritesData.map(f => f.song_id));
        setFavorites(favoriteIds);
      }

      if (!songsData || songsData.length === 0) {
        setSongs([]);
        setLoading(false);
        return;
      }

      setSongs(songsData);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const filterSongs = () => {
    let filtered = [...songs];

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
    if (!userId) {
      toast.error('Please log in to save favorites');
      return;
    }

    const isFavorited = favorites.has(songId);

    try {
      if (isFavorited) {
        const { error } = await supabase
          .from('song_favorites')
          .delete()
          .eq('member_id', userId)
          .eq('song_id', songId);

        if (error) throw error;

        setFavorites(prev => {
          const newFavorites = new Set(prev);
          newFavorites.delete(songId);
          return newFavorites;
        });
        toast.success('Removed from favorites');
      } else {
        const { error } = await supabase
          .from('song_favorites')
          .insert({
            member_id: userId,
            song_id: songId,
            notes: ''
          });

        if (error) throw error;

        setFavorites(prev => {
          const newFavorites = new Set(prev);
          newFavorites.add(songId);
          return newFavorites;
        });
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  const getEmbedUrl = (url: string | undefined) => {
    if (!url || typeof url !== 'string') return '';
    
    try {
      if (url.includes('drive.google.com')) {
        const fileIdMatch = url.match(/\/d\/([^\/]+)/) || url.match(/id=([^&]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
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

      {/* Mobile Filters Toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">Filters</span>
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
      </button>

      {/* Expandable Filters */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div>
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
        </div>
      )}

      {/* Songs Display */}
      {filteredSongs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-sm">
            {songs.length === 0 ? 'No songs in repertoire yet' : 'No songs found'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Desktop Table - Hidden on Mobile */}
          <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Composer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Language
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSongs.map((song) => (
                    <tr key={song.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{song.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {song.composer || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {song.language || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleFavorite(song.id)}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                              favorites.has(song.id)
                                ? 'text-red-600 bg-red-50 hover:bg-red-100'
                                : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            <Heart 
                              className={`w-3 h-3 ${favorites.has(song.id) ? 'fill-current' : ''}`}
                            />
                          </button>
                          {song.sheet_music_url && (
                            <button
                              onClick={() => setViewingSong(song)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Layout - Visible on Mobile */}
          <div className="sm:hidden space-y-3">
            {filteredSongs.map((song) => (
              <div key={song.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm break-words">{song.title}</h3>
                    {song.composer && (
                      <p className="text-xs text-gray-600 mt-1">{song.composer}</p>
                    )}
                    {song.language && (
                      <p className="text-xs text-gray-500 mt-1 bg-gray-100 inline-block px-2 py-1 rounded mt-2">
                        {song.language}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleFavorite(song.id)}
                    className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                      favorites.has(song.id)
                        ? 'text-red-600 bg-red-50 hover:bg-red-100'
                        : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <Heart 
                      className={`w-5 h-5 ${favorites.has(song.id) ? 'fill-current' : ''}`}
                    />
                  </button>
                </div>

                {song.sheet_music_url && (
                  <button
                    onClick={() => setViewingSong(song)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View Sheet Music
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sheet Music Viewer Modal - Mobile Optimized */}
      {viewingSong && viewingSong.sheet_music_url && getEmbedUrl(viewingSong.sheet_music_url) && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-xl sm:rounded-lg w-full sm:w-full sm:max-w-4xl max-h-[90vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex-1">
                <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">{viewingSong.title}</h2>
                {viewingSong.composer && (
                  <p className="text-xs sm:text-sm text-gray-500 truncate">{viewingSong.composer}</p>
                )}
              </div>
              <button 
                onClick={() => setViewingSong(null)} 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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
