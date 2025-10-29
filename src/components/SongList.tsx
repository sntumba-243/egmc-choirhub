// At the very top of SongList.tsx, add:
import '../styles/SongComponents.css';
// Or if your css is in a different folder:
import '../css/SongComponents.css';
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';// Adjust path as needed
import SongCard from './SongCard';

interface Song {
  id: string;
  title: string;
  artist?: string;
  composer?: string;
  sheet_music_url?: string;
  status?: string;
}

export const SongList: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('songs')
        .select('id, title, artist, composer, sheet_music_url, status')
        .order('title');

      if (fetchError) throw fetchError;

      setSongs(data || []);
    } catch (err) {
      console.error('Error loading songs:', err);
      setError('Failed to load songs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <p>Loading repertoire...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={loadSongs}>Retry</button>
      </div>
    );
  }

  return (
    <div className="song-list-container">
      <div className="song-list-header">
        <h1>Repertoire</h1>
        <p className="song-count">
          {songs.length} {songs.length === 1 ? 'song' : 'songs'}
        </p>
      </div>

      <div className="songs-grid">
        {songs.length === 0 ? (
          <p className="no-songs">No songs found</p>
        ) : (
          songs.map((song) => (
            <SongCard key={song.id} song={song} />
          ))
        )}
      </div>
    </div>
  );
};

export default SongList;
