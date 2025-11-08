import React, { useState, useEffect } from 'react';
import { Search, Heart, Music, Eye, X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface Song {
  id: string;
  title: string;
  composer: string;
  language: string;
  sheet_music_url?: string;
  audio_url?: string;
  is_favorite?: boolean;
}

export const MemberRepertoire: React.FC = () => {
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [loading, setLoading] = useState(true);
  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    fetchSongs();
  }, [user]);

  useEffect(() => {
    filterSongs();
  }, [searchQuery, activeTab, songs]);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .order('title');

      if (songsError) throw songsError;

      if (user?.id) {
        const { data: favoritesData } = await supabase
          .from('song_favorites')
          .select('song_id')
          .eq('member_id', user.id);

        const favoriteIds = new Set(favoritesData?.map(f => f.song_id));
        const songsWithFavorites = songsData.map(song => ({
          ...song,
          is_favorite: favoriteIds.has(song.id)
        }));
        setSongs(songsWithFavorites);
      } else {
        setSongs(songsData);
      }
    } catch (error) {
      console.error('Error fetching songs:', error);
      toast.error('Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  const filterSongs = () => {
    let filtered = songs;

    if (activeTab === 'favorites') {
      filtered = filtered.filter(song => song.is_favorite);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(song =>
        song.title.toLowerCase().includes(query) ||
        song.composer.toLowerCase().includes(query)
      );
    }

    setFilteredSongs(filtered);
  };

  const toggleFavorite = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;

    const song = songs.find(s => s.id === songId);
    const isFavorite = song?.is_favorite;

    try {
      if (isFavorite) {
        await supabase
          .from('song_favorites')
          .delete()
          .eq('song_id', songId)
          .eq('member_id', user.id);
        toast.success('Removed from favorites');
      } else {
        await supabase
          .from('song_favorites')
          .insert({ song_id: songId, member_id: user.id });
        toast.success('Added to favorites');
      }

      setSongs(songs.map(s => 
        s.id === songId ? { ...s, is_favorite: !isFavorite } : s
      ));
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const openSheetMusic = (song: Song, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (song.sheet_music_url) {
      setViewingSong(song);
      setZoom(100);
    } else {
      toast.error('No sheet music available');
    }
  };

  const favoriteCount = songs.filter(s => s.is_favorite).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-3"></div>
        <p className="text-gray-600 text-sm">Loading repertoire...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Repertoire</h1>
        <div className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
          {filteredSongs.length}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
            activeTab === 'all'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Songs
        </button>
        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === 'favorites'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Heart className="w-4 h-4" fill={activeTab === 'favorites' ? 'currentColor' : 'none'} />
          Favorites ({favoriteCount})
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search songs..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Songs List */}
      <div className="space-y-3">
        {filteredSongs.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {activeTab === 'favorites' ? 'No favorite songs yet' : 'No songs found'}
            </p>
          </div>
        ) : (
          filteredSongs.map((song) => (
            <div
              key={song.id}
              onClick={() => song.sheet_music_url && openSheetMusic(song)}
              className={`bg-white rounded-xl border border-gray-200 p-4 transition-all ${
                song.sheet_music_url ? 'hover:shadow-lg hover:border-purple-300 cursor-pointer' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Song Icon */}
                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Music className="w-6 h-6 text-purple-600" />
                </div>

                {/* Song Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-base mb-1">{song.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{song.composer}</p>
                  <div className="flex items-center gap-2">
                    <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">
                      {song.language}
                    </span>
                    {song.sheet_music_url && (
                      <span className="inline-flex items-center gap-1 text-xs text-purple-600 font-medium">
                        <Eye className="w-3 h-3" />
                        Sheet Music
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {song.sheet_music_url && (
                    <button
                      onClick={(e) => openSheetMusic(song, e)}
                      className="p-2 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                      title="View Sheet Music"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => toggleFavorite(song.id, e)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    title={song.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart
                      className={`w-5 h-5 ${song.is_favorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Full Screen Sheet Music Viewer */}
      {viewingSong && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Header */}
          <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg truncate">{viewingSong.title}</h2>
              <p className="text-sm text-gray-300 truncate">{viewingSong.composer}</p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 25))}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium px-2">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 25))}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              {viewingSong.sheet_music_url && (
                <a
                  href={viewingSong.sheet_music_url}
                  download
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </a>
              )}
              <button
                onClick={() => setViewingSong(null)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors ml-2"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 overflow-auto bg-gray-800 flex items-center justify-center p-4">
            {viewingSong.sheet_music_url?.endsWith('.pdf') ? (
              <iframe
                src={viewingSong.sheet_music_url}
                className="w-full h-full bg-white"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                title="Sheet Music"
              />
            ) : (
              <img
                src={viewingSong.sheet_music_url}
                alt={viewingSong.title}
                className="max-w-full max-h-full object-contain"
                style={{ transform: `scale(${zoom / 100})` }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
