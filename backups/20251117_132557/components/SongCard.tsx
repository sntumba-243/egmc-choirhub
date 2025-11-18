import React from 'react';

interface Song {
  id: string;
  title: string;
  artist?: string;
  composer?: string;
  sheet_music_url?: string;
  status?: string;
}

interface SongCardProps {
  song: Song;
}

export const SongCard: React.FC<SongCardProps> = ({ song }) => {
  const handleViewScore = () => {
    if (song.sheet_music_url) {
      // Open PDF in new tab
      window.open(song.sheet_music_url, '_blank');
    } else {
      alert('No sheet music available for this song');
    }
  };

  return (
    <div className="song-card">
      <div className="song-info">
        <h3>{song.title}</h3>
        {song.artist && <p className="artist">{song.artist}</p>}
        {song.composer && <p className="composer">by {song.composer}</p>}
        {song.status && (
          <span className={`status-badge ${song.status}`}>
            {song.status}
          </span>
        )}
      </div>
      
      <div className="song-actions">
        {song.sheet_music_url ? (
          <button 
            onClick={handleViewScore}
            className="btn-view-score"
          >
            📄 View Score
          </button>
        ) : (
          <span className="no-score">No score available</span>
        )}
      </div>
    </div>
  );
};

export default SongCard;
