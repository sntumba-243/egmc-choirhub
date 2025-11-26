import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Music, Search, Eye, Star, ArrowUpAZ, ArrowDownAZ } from 'lucide-react';
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

export const MemberRepertoire = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'a-z' | 'z-a' | 'recent'>('a-z');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'english' | 'french' | 'portuguese' | 'lingala' | 'tshiluba' | 'kikongo' | 'swahili'>('all');

  // Check if coming from Dashboard with favorites tab request
  // Check if coming from Dashboard with favorites tab request
  useEffect(() => {
    console.log("📍 Full location object:", location);
    console.log("📍 location.search:", location.search);
    console.log("📍 location.pathname:", location.pathname);
    console.log("📍 window.location.search:", window.location.search);
    
    const searchParams = new URLSearchParams(location.search);
    const showFavorites = searchParams.get("tab") === "favorites";
    
    console.log("📍 Tab param:", searchParams.get("tab"));
    
    if (showFavorites) {
      console.log("✅ Setting favorites filter to TRUE");
      setShowFavoritesOnly(true);
    }
  }, [location]);
  useEffect(() => {
    fetchSongs();
    fetchFavorites();
  }, []);

  const fetchSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('title', { ascending: true });

      if (error) throw error;
      console.log('Loaded songs:', data?.length);
      setSongs(data || []);
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
      const { data, error } = await supabase
        .from('user_favorites')
        .select('song_id')
        .eq('user_id', user.id);

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

    const isFavorite = favorites.has(songId);

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('song_id', songId);

        if (error) throw error;

        const newFavorites = new Set(favorites);
        newFavorites.delete(songId);
        setFavorites(newFavorites);
        toast.success('Removed from favorites');
      } else {
        const { error } = await supabase
          .from('user_favorites')
          .insert({ user_id: user.id, song_id: songId });

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
      // Reset after navigation
      setTimeout(() => setPdfLoading(false), 1000);
    }
  };

  // Filter songs by language
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

  // Filter and sort songs
  const filteredSongs = songs.filter(song => {
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
    <div className="space-y-4 pb-6">
      {/* Header - Compact */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Repertoire</h1>
        <p className="text-sm text-gray-600 mt-0.5">
          {filteredSongs.length} songs
          {favoriteCount > 0 && <span className="text-yellow-600"> · {favoriteCount} ⭐</span>}
        </p>
      </div>

      {/* Filters Bar - Compact */}
      <div className="bg-white rounded-lg shadow-md p-3 space-y-3">
        {/* Search & Sort - Compact */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search songs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Sort Dropdown - Compact */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer font-medium text-gray-700"
            >
              <option value="a-z">A → Z</option>
              <option value="z-a">Z → A</option>
              <option value="recent">Recent</option>
            </select>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
              {sortBy === 'a-z' ? (
                <ArrowUpAZ className="w-3.5 h-3.5 text-gray-500" />
              ) : sortBy === 'z-a' ? (
                <ArrowDownAZ className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </div>
          </div>

          {/* Language Filter Dropdown */}
          <div className="relative">
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value as any)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer font-medium text-gray-700"
            >
              <option value="all">All Languages</option>
              <option value="english">English</option>
              <option value="french">French</option>
              <option value="portuguese">Portuguese</option>
              <option value="lingala">Lingala</option>
              <option value="tshiluba">Tshiluba</option>
              <option value="kikongo">Kikongo</option>
              <option value="swahili">Swahili</option>
            </select>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Favorites Filter - Compact */}
        <div className="flex items-center">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
              showFavoritesOnly
                ? 'bg-yellow-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-white' : ''}`} />
            {showFavoritesOnly ? 'Favorites' : 'Show Favorites'}
            {favoriteCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                showFavoritesOnly ? 'bg-yellow-600' : 'bg-gray-200'
              }`}>
                {favoriteCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Songs List - Compact */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left">
                <Star className="w-3.5 h-3.5 inline text-gray-400" />
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Title
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Lang
              </th>
              <th className="px-2 py-2">
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSongs.map((song) => {
              const isFavorite = favorites.has(song.id);
              
              return (
                <tr
                  key={song.id}
                  onClick={() => song.sheet_music_url && handleViewPDF(song)}
                  className={`hover:bg-gray-50 transition-colors active:bg-gray-100 ${
                    song.sheet_music_url ? 'cursor-pointer' : ''
                  }`}
                >
                  {/* Star */}
                  <td className="px-3 py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(song.id, e);
                      }}
                      className={`transition-all ${
                        isFavorite
                          ? 'text-yellow-500'
                          : 'text-gray-300'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-500' : ''}`} />
                    </button>
                  </td>

                  {/* Title */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="font-medium text-gray-900 text-sm line-clamp-1">{song.title}</span>
                    </div>
                  </td>

                  {/* Language */}
                  <td className="px-3 py-2">
                    <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${
                      song.language === 'English' ? 'bg-blue-100 text-blue-800' :
                      song.language === 'French' ? 'bg-purple-100 text-purple-800' :
                      song.language === 'Lingala' ? 'bg-green-100 text-green-800' :
                      song.language === 'Tshiluba' ? 'bg-yellow-100 text-yellow-800' :
                      song.language === 'Swahili' ? 'bg-teal-100 text-teal-800' :
                      song.language === 'Kikongo' ? 'bg-orange-100 text-orange-800' :
                      song.language === 'Portuguese' ? 'bg-pink-100 text-pink-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {(song.language || "??").slice(0, 2)}
                    </span>
                  </td>

                  {/* Actions - Only View PDF */}
                  <td className="px-2 py-2 text-right">
                    {song.sheet_music_url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewPDF(song);
                        }}
                        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Empty State - Compact */}
        {filteredSongs.length === 0 && (
          <div className="text-center py-8">
            <Music className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">
              {showFavoritesOnly ? 'No favorites yet' : 'No songs found'}
            </h3>
            <p className="text-sm text-gray-500">
              {showFavoritesOnly
                ? 'Star some songs to add them to your favorites!'
                : 'Try adjusting your filters'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
