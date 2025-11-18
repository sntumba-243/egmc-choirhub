import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Maximize, Minimize, Download, Check, FileText, Music2, Youtube, ExternalLink, Play, Pause, Clock } from 'lucide-react';
import { offlineStorage } from '../../lib/offlineStorage';
import { practiceLogService } from '../../lib/practiceLog';
import { useAuth } from '../../contexts/AuthContext';
import { songsService, type Song } from '../../lib/database';

interface SongDetailProps {
  songId: string;
  onBack: () => void;
}

export const SongDetail = () => {
  const { id: songId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPracticing, setIsPracticing] = useState(false);
  const [practiceTime, setPracticeTime] = useState(0);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [practiceNotes, setPracticeNotes] = useState('');
  const [currentSpeed, setCurrentSpeed] = useState('1.0x');

  useEffect(() => {
    loadSong();
  }, [songId]);

  // Removed fullscreen auto-open - now using PDF viewer route
  useEffect(() => {
    if (false) {
      navigate("/pdf-viewer", { state: { url: song.sheet_music_url, title: song.title } });
    }
  }, [song, searchParams]);

  const loadSong = async () => {
    try {
      const data = await songsService.getSong(songId);
      setSong(data);
      if (data) {
        setIsDownloaded(offlineStorage.isDownloaded(data.id));
      }
    } catch (error) {
      console.error('Failed to load song:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [song?.id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPracticing) {
      interval = setInterval(() => {
        setPracticeTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPracticing]);

  const handleDownload = async () => {
    if (isDownloaded || !song) return;

    setDownloading(true);

    setTimeout(async () => {
      await offlineStorage.downloadSong(song);
      setIsDownloaded(true);
      setDownloading(false);
    }, 2000);
  };

  const handleStartPractice = () => {
    setIsPracticing(true);
    setPracticeTime(0);
  };

  const handleEndPractice = () => {
    setIsPracticing(false);
    const minutes = Math.floor(practiceTime / 60);
    if (minutes > 0) {
      setShowNotesModal(true);
    } else {
      setPracticeTime(0);
    }
  };

  const handleSavePracticeLog = () => {
    if (!song) return;

    const minutes = Math.floor(practiceTime / 60);
    practiceLogService.addLog({
      userId: user?.id || 'member',
      songId: song.id,
      songTitle: song.title,
      date: new Date().toISOString(),
      duration: minutes,
      speedUsed: currentSpeed,
      notes: practiceNotes.trim() || undefined,
    });

    alert(`${minutes} minute${minutes !== 1 ? 's' : ''} logged!`);
    setPracticeTime(0);
    setPracticeNotes('');
    setShowNotesModal(false);
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-blue-900 text-xl">Loading song...</div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-red-900 text-xl">Song not found</div>
      </div>
    );
  }

  return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6">
        <button
          onClick={() => navigate('/member/repertoire')}
          className="flex items-center gap-2 text-blue-900 font-semibold hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Repertoire
        </button>

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-blue-900 mb-2">{song.title}</h2>
            <p className="text-lg text-gray-700 mb-1">Composer: {song.composer}</p>
            {song.arranger && (
              <p className="text-md text-gray-600">Arranged by: {song.arranger}</p>
            )}
          </div>

          {!isDownloaded ? (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-900 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="w-5 h-5" />
              {downloading ? 'Downloading...' : 'Download for Offline'}
            </button>
          ) : (
            <div className="flex items-center gap-2 px-6 py-3 bg-green-100 text-green-700 rounded-lg font-semibold">
              <Check className="w-5 h-5" />
              Available Offline
            </div>
          )}
        </div>

        {song.tags && song.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {song.tags.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {!isOnline && !isDownloaded && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 font-semibold">You're offline</p>
            <p className="text-yellow-700 text-sm mt-1">
              This song is not available offline. Connect to the internet to download it.
            </p>
          </div>
        )}

        {downloading && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-blue-900">Downloading...</span>
              <span className="text-sm text-blue-700">50%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full animate-pulse" style={{ width: '50%' }} />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-blue-900 mb-4">Resources</h3>

        <div className="space-y-3">
          {song.sheet_music_url && (
            <button
              onClick={() => {
                if (isOnline || isDownloaded) {
                  navigate("/pdf-viewer", { state: { url: song.sheet_music_url, title: song.title } });
                } else {
                  alert('This resource is not available offline');
                }
              }}
              className={`flex items-center gap-3 p-4 rounded-lg transition-colors w-full text-left ${
                isOnline || isDownloaded
                  ? 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
                  : 'bg-gray-100 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-700" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Sheet Music</p>
                <p className="text-sm text-slate-600">Click to view sheet music</p>
              </div>
              <Maximize className="w-5 h-5 text-slate-400" />
            </button>
          )}

          {song.youtube_link && (
            <a
              href={isOnline ? song.youtube_link : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 p-4 rounded-lg transition-colors ${
                isOnline
                  ? 'bg-gray-50 hover:bg-gray-100'
                  : 'bg-gray-100 opacity-50 cursor-not-allowed'
              }`}
              onClick={(e) => {
                if (!isOnline) {
                  e.preventDefault();
                  alert('YouTube requires an internet connection');
                }
              }}
            >
              <Youtube className="w-6 h-6 text-red-600" />
              <div className="flex-1">
                <p className="font-semibold text-blue-900">YouTube Video</p>
                <p className="text-sm text-gray-600">Watch performance</p>
              </div>
              <ExternalLink className="w-5 h-5 text-gray-400" />
            </a>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-blue-900">Part Recordings</h3>
          {!isPracticing ? (
            <button
              onClick={handleStartPractice}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              Start Practice Session
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                <Clock className="w-5 h-5 text-blue-700 animate-pulse" />
                <span className="font-mono text-lg font-bold text-blue-900">{formatTime(practiceTime)}</span>
              </div>
              <button
                onClick={handleEndPractice}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                <Pause className="w-4 h-4" />
                End Practice Session
              </button>
            </div>
          )}
        </div>

        <div className="mb-4 flex items-center gap-4">
          <label className="text-sm font-semibold text-gray-700">Playback Speed:</label>
          <select
            value={currentSpeed}
            onChange={(e) => setCurrentSpeed(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="0.5x">0.5x</option>
            <option value="0.75x">0.75x</option>
            <option value="1.0x">1.0x</option>
            <option value="1.25x">1.25x</option>
            <option value="1.5x">1.5x</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {song.soprano_audio_url && (
            <div className={`p-4 rounded-lg ${isOnline || isDownloaded ? 'bg-pink-50' : 'bg-gray-100 opacity-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Music2 className="w-5 h-5 text-pink-700" />
                <span className="font-semibold text-pink-900">Soprano</span>
              </div>
              {isOnline || isDownloaded ? (
                <audio controls className="w-full">
                  <source src={song.soprano_audio_url} type="audio/mpeg" />
                </audio>
              ) : (
                <p className="text-sm text-gray-600">Not available offline</p>
              )}
            </div>
          )}

          {song.alto_audio_url && (
            <div className={`p-4 rounded-lg ${isOnline || isDownloaded ? 'bg-purple-50' : 'bg-gray-100 opacity-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Music2 className="w-5 h-5 text-purple-700" />
                <span className="font-semibold text-purple-900">Alto</span>
              </div>
              {isOnline || isDownloaded ? (
                <audio controls className="w-full">
                  <source src={song.alto_audio_url} type="audio/mpeg" />
                </audio>
              ) : (
                <p className="text-sm text-gray-600">Not available offline</p>
              )}
            </div>
          )}

          {song.tenor_audio_url && (
            <div className={`p-4 rounded-lg ${isOnline || isDownloaded ? 'bg-blue-50' : 'bg-gray-100 opacity-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Music2 className="w-5 h-5 text-blue-700" />
                <span className="font-semibold text-blue-900">Tenor</span>
              </div>
              {isOnline || isDownloaded ? (
                <audio controls className="w-full">
                  <source src={song.tenor_audio_url} type="audio/mpeg" />
                </audio>
              ) : (
                <p className="text-sm text-gray-600">Not available offline</p>
              )}
            </div>
          )}

          {song.bass_audio_url && (
            <div className={`p-4 rounded-lg ${isOnline || isDownloaded ? 'bg-green-50' : 'bg-gray-100 opacity-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Music2 className="w-5 h-5 text-green-700" />
                <span className="font-semibold text-green-900">Bass</span>
              </div>
              {isOnline || isDownloaded ? (
                <audio controls className="w-full">
                  <source src={song.bass_audio_url} type="audio/mpeg" />
                </audio>
              ) : (
                <p className="text-sm text-gray-600">Not available offline</p>
              )}
            </div>
          )}
        </div>
      </div>

      {showNotesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-blue-900 mb-3">Practice Notes</h3>
            <p className="text-gray-700 mb-4">
              Great session! You practiced for {Math.floor(practiceTime / 60)} minutes.
            </p>
            <textarea
              value={practiceNotes}
              onChange={(e) => setPracticeNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none mb-4"
              placeholder="Add any notes about your practice session (optional)..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPracticeTime(0);
                  setPracticeNotes('');
                  setShowNotesModal(false);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSavePracticeLog}
                className="flex-1 bg-blue-900 text-white py-2 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
              >
                Save Log
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};
