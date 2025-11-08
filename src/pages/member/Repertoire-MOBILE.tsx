import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Music, Heart, Play, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface Song {
  id: string;
  title: string;
  composer: string | null;
  language: 'english' | 'french';
  sheet_music_url: string | null;
  practice_track_url: string | null;
  youtube_link: string | null;
  lyrics: string | null;
  created_at: string;
}

interface Favorite {
  id: string;
  song_id: string;
}

export const MemberRepertoire = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLanguage, setFilterLanguage] = useState<'all' | 'english' | 'french'>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // Load songs
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('*')
        .order('title');

      if (songError) throw songError;
      setSongs(songData || []);

      // Load favorites
      if (user?.id) {
        const { data: favData, error: favError } = await supabase
          .from('song_favorites')
          .select('id, song_id')
          .eq('member_id', user.id);

        if (favError) throw favError;
        setFavorites(favData || []);
      }

    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Failed to load songs');
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite(songId: string, e: React.MouseEvent) {
    e.stopPropagation(); // Prevent navigation when clicking heart
    
    if (!user?.id) {
      toast.error('Please login to save favorites');
      return;
    }

    const favorite = favorites.find(f => f.song_id === songId);

    try {
      if (favorite) {
        // Remove favorite
        const { error } = await supabase
          .from('song_favorites')
          .delete()
          .eq('id', favorite.id);

        if (error) throw error;
        setFavorites(favorites.filter(f => f.id !== favorite.id));
        toast.success('Removed from favorites');
      } else {
        // Add favorite
        const { data, error } = await supabase
          .from('song_favorites')
          .insert({ member_id: user.id, song_id: songId })
          .select()
          .single();

        if (error) throw error;
        setFavorites([...favorites, data]);
        toast.success('Added to favorites');
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      toast.error('Failed to update favorite');
    }
  }

  function handleViewSheetMusic(song: Song, e: React.MouseEvent) {
    e.stopPropagation(); // Prevent song detail navigation
    
    if (!song.sheet_music_url) return;
    
    // Navigate to minimal bezel PDF viewer
    navigate('/pdf-viewer', {
      state: {
        url: song.sheet_music_url,
        title: song.title
      }
    });
  }

  function getLanguageFlag(language: string) {
    return language === 'english' ? '🇬🇧' : '🇫🇷';
  }

  function isFavorite(songId: string) {
    return favorites.some(f => f.song_id === songId);
  }

  // Filter songs - THIS IS THE KEY FIX
  const filteredSongs = songs.filter(song => {
    // Search filter
    const matchesSearch = !searchQuery || // If no search query, show all
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (song.composer && song.composer.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Language filter
    const matchesLanguage = filterLanguage === 'all' || song.language === filterLanguage;

    return matchesSearch && matchesLanguage;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-3"></div>
        <p className="text-gray-600 text-sm">Loading songs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900">Repertoire</h1>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search songs or composers..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Language Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        <button
          onClick={() => setFilterLanguage('all')}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            filterLanguage === 'all'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Songs
        </button>
        <button
          onClick={() => setFilterLanguage('english')}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            filterLanguage === 'english'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🇬🇧 English
        </button>
        <button
          onClick={() => setFilterLanguage('french')}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
            filterLanguage === 'french'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🇫🇷 French
        </button>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Songs List */}
      {filteredSongs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">No songs found</p>
          <p className="text-sm text-gray-600">
            {searchQuery 
              ? `Try adjusting your search for "${searchQuery}"`
              : 'No songs available in this language'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSongs.map((song) => (
            <div
              key={song.id}
              onClick={() => navigate(`/member/repertoire/${song.id}`)}
              className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-all cursor-pointer border border-gray-100"
            >
              <div className="flex items-center gap-3">
                {/* Language Flag */}
                <div className="text-2xl flex-shrink-0">
                  {getLanguageFlag(song.language)}
                </div>

                {/* Song Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {song.title}
                  </h3>
                  {song.composer && (
                    <p className="text-sm text-gray-600 truncate">
                      by {song.composer}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Favorite Heart */}
                  <button
                    onClick={(e) => toggleFavorite(song.id, e)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {isFavorite(song.id) ? (
                      <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                    ) : (
                      <Heart className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {/* View Sheet Music Button */}
                  {song.sheet_music_url && (
                    <button
                      onClick={(e) => handleViewSheetMusic(song, e)}
                      className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                      👁️ View
                    </button>
                  )}

                  {/* Practice Track Icon */}
                  {song.practice_track_url && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(song.practice_track_url!, '_blank');
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Play className="w-5 h-5 text-green-600" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
