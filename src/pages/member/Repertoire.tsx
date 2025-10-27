import React, { useState, useEffect } from 'react';
import { Music, Search } from 'lucide-react';
import { songsService, type Song } from '../../lib/database';

interface MemberRepertoireProps {
  onNavigateToSong: (songId: string) => void;
}

export const MemberRepertoire: React.FC<MemberRepertoireProps> = ({ onNavigateToSong }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      const data = await songsService.getSongs();
      setSongs(data);
    } catch (error) {
      console.error('Failed to load songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (song.composer && song.composer.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (song.key && song.key.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (song.language && song.language.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (song.tags && song.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-2xl font-bold text-blue-900 mb-4">Song Repertoire</h2>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, key, language, composer, or tags..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading songs...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSongs.length === 0 ? (
              <div className="text-center py-12">
                <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  {songs.length === 0 ? 'No songs yet' : 'No songs found'}
                </p>
              </div>
            ) : (
              filteredSongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => onNavigateToSong(song.id)}
                  className="w-full p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <h3 className="font-bold text-blue-900 text-lg">{song.title}</h3>
                  <div className="flex gap-3 mt-1">
                    {song.key && (
                      <span className="text-sm text-gray-600">
                        <strong>Key:</strong> {song.key}
                      </span>
                    )}
                    {song.language && (
                      <span className="text-sm text-gray-600">
                        <strong>Language:</strong> {song.language}
                      </span>
                    )}
                  </div>
                  {song.composer && (
                    <p className="text-gray-600 text-sm mt-0.5">Composer: {song.composer}</p>
                  )}
                  {song.tags && song.tags.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {song.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
