import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { isMobile } from '../../utils/mobile-helpers';
import '../../styles/mobile-optimization.css';

interface Song {
  id: string;
  title: string;
  composer: string | null;
  language: 'english' | 'french';
  sheet_music_url: string | null;
  practice_track_url: string | null;
  created_at: string;
}

interface Favorite {
  id: string;
  song_id: string;
}

export function Repertoire() {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLanguage, setFilterLanguage] = useState<'all' | 'english' | 'french'>('all');
  const [userId, setUserId] = useState<string | null>(null);
  const mobile = isMobile();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      setUserId(user.id);

      // Load songs
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('*')
        .order('title');

      if (songError) throw songError;
      setSongs(songData || []);

      // Load favorites
      const { data: favData, error: favError } = await supabase
        .from('favorites')
        .select('id, song_id')
        .eq('user_id', user.id);

      if (favError) throw favError;
      setFavorites(favData || []);

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load songs');
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite(songId: string) {
    if (!userId) return;

    const isFavorite = favorites.some(f => f.song_id === songId);

    try {
      if (isFavorite) {
        // Remove favorite
        const favorite = favorites.find(f => f.song_id === songId);
        if (favorite) {
          const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('id', favorite.id);

          if (error) throw error;
          setFavorites(favorites.filter(f => f.id !== favorite.id));
        }
      } else {
        // Add favorite
        const { data, error } = await supabase
          .from('favorites')
          .insert({ user_id: userId, song_id: songId })
          .select()
          .single();

        if (error) throw error;
        setFavorites([...favorites, data]);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      setError('Failed to update favorite');
    }
  }

  function handleViewSheetMusic(song: Song) {
    if (!song.sheet_music_url) return;
    
    // Navigate to PDF viewer with minimal bezel
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

  // Filter songs
  const filteredSongs = songs.filter(song => {
    const matchesSearch = 
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (song.composer && song.composer.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesLanguage = filterLanguage === 'all' || song.language === filterLanguage;

    return matchesSearch && matchesLanguage;
  });

  if (loading) {
    return (
      <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading songs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
      {/* Header */}
      <h1 className={mobile ? 'text-2xl font-bold text-gray-900 mb-4' : 'text-3xl font-bold text-gray-900 mb-6'}>
        Repertoire
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title or composer..."
          className={mobile ? 'mobile-input' : 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'}
        />
      </div>

      {/* Language Filter */}
      <div className={mobile ? 'mobile-tabs mb-4' : 'flex gap-2 mb-6'}>
        <button
          onClick={() => setFilterLanguage('all')}
          className={`${mobile ? 'mobile-tab' : 'px-4 py-2 rounded-lg'} ${
            filterLanguage === 'all'
              ? mobile ? 'mobile-tab-active' : 'bg-blue-600 text-white'
              : mobile ? '' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterLanguage('english')}
          className={`${mobile ? 'mobile-tab' : 'px-4 py-2 rounded-lg'} ${
            filterLanguage === 'english'
              ? mobile ? 'mobile-tab-active' : 'bg-blue-600 text-white'
              : mobile ? '' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🇬🇧 English
        </button>
        <button
          onClick={() => setFilterLanguage('french')}
          className={`${mobile ? 'mobile-tab' : 'px-4 py-2 rounded-lg'} ${
            filterLanguage === 'french'
              ? mobile ? 'mobile-tab-active' : 'bg-blue-600 text-white'
              : mobile ? '' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🇫🇷 French
        </button>
      </div>

      {/* Song Count */}
      <div className="mb-4 text-sm text-gray-600">
        {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'}
      </div>

      {/* Songs List - Clean & Simple */}
      {filteredSongs.length === 0 ? (
        <div className={mobile ? 'mobile-card' : 'bg-white rounded-lg shadow-md p-8'}>
          <div className="text-center text-gray-500">
            <p className="text-4xl mb-3">🎵</p>
            <p className="text-lg">No songs found</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSongs.map((song) => (
            <div
              key={song.id}
              className={mobile ? 'mobile-card' : 'bg-white rounded-lg shadow-md p-4'}
            >
              {/* Clean Row Layout: Title | Language | Heart | View */}
              <div className="flex items-center gap-3">
                {/* Title & Composer */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {song.title}
                  </p>
                  {song.composer && (
                    <p className="text-sm text-gray-500 truncate">
                      {song.composer}
                    </p>
                  )}
                </div>

                {/* Language Flag */}
                <div className="text-2xl flex-shrink-0">
                  {getLanguageFlag(song.language)}
                </div>

                {/* Favorite Button */}
                <button
                  onClick={() => toggleFavorite(song.id)}
                  className="text-2xl flex-shrink-0 w-10 h-10 flex items-center justify-center"
                >
                  {isFavorite(song.id) ? '❤️' : '🤍'}
                </button>

                {/* View Button - Only if has sheet music */}
                {song.sheet_music_url && (
                  <button
                    onClick={() => handleViewSheetMusic(song)}
                    className={mobile ? 'mobile-button mobile-button-primary text-sm px-3 py-1' : 'px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700'}
                  >
                    👁️ View
                  </button>
                )}

                {/* Practice Track Icon - Only if has track */}
                {song.practice_track_url && (
                  <a
                    href={song.practice_track_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xl flex-shrink-0"
                  >
                    🎧
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
