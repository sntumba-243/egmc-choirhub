import React, { useState, useEffect } from 'react';
import { ListMusic, Plus, Piano, TrendingUp, Clock, Trash2, Edit2, X } from 'lucide-react';
import { practiceLogsService, practicePlaylistsService, songsService, PracticeLog, PracticePlaylist, Song } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

export const MemberPractice: React.FC = () => {
  const { user } = useAuth();
  const [showPiano, setShowPiano] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [playlists, setPlaylists] = useState<PracticePlaylist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [logs, setLogs] = useState<PracticeLog[]>([]);
  const [stats, setStats] = useState({ totalMinutes: 0, sessionCount: 0 });
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PracticePlaylist | null>(null);
  const [loading, setLoading] = useState(true);

  const [logForm, setLogForm] = useState({
    song_id: '',
    duration: 30,
    speed_used: '100%',
    notes: '',
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [playlistsData, songsData, logsData, statsData] = await Promise.all([
        practicePlaylistsService.getPlaylists(user.id),
        songsService.getSongs(),
        practiceLogsService.getLogs(user.id),
        practiceLogsService.getStats(user.id),
      ]);
      setPlaylists(playlistsData);
      setSongs(songsData);
      setLogs(logsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading practice data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!user || !newPlaylistName.trim()) return;
    try {
      await practicePlaylistsService.createPlaylist({
        user_id: user.id,
        name: newPlaylistName.trim(),
        song_ids: [],
      });
      setNewPlaylistName('');
      setShowCreateModal(false);
      loadData();
    } catch (error) {
      console.error('Error creating playlist:', error);
      alert('Failed to create playlist');
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Delete this playlist?')) return;
    try {
      await practicePlaylistsService.deletePlaylist(id);
      loadData();
    } catch (error) {
      console.error('Error deleting playlist:', error);
      alert('Failed to delete playlist');
    }
  };

  const handleLogPractice = async () => {
    if (!user || !logForm.song_id) {
      alert('Please select a song');
      return;
    }
    try {
      await practiceLogsService.createLog({
        user_id: user.id,
        song_id: logForm.song_id,
        duration: logForm.duration,
        speed_used: logForm.speed_used,
        notes: logForm.notes,
        date: new Date().toISOString(),
      });
      setLogForm({ song_id: '', duration: 30, speed_used: '100%', notes: '' });
      setShowLogModal(false);
      loadData();
    } catch (error) {
      console.error('Error logging practice:', error);
      alert('Failed to log practice session');
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm('Delete this practice log?')) return;
    try {
      await practiceLogsService.deleteLog(id);
      loadData();
    } catch (error) {
      console.error('Error deleting log:', error);
      alert('Failed to delete log');
    }
  };

  const getSongTitle = (songId: string): string => {
    const song = songs.find(s => s.id === songId);
    return song ? song.title : 'Unknown Song';
  };

  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const [activeNote, setActiveNote] = useState<string | null>(null);

  const playNote = (note: string) => {
    setActiveNote(note);
    setTimeout(() => setActiveNote(null), 200);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading practice tools...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-blue-900">Practice Tools</h2>
            <p className="text-gray-600 mt-1">Enhance your practice sessions</p>
          </div>
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            <Clock className="w-5 h-5" />
            Log Practice
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setShowPiano(!showPiano)}
            className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl hover:shadow-lg transition-all text-left group"
          >
            <Piano className="w-8 h-8 text-purple-700 mb-3" />
            <h3 className="text-lg font-bold text-purple-900 mb-2">Virtual Piano</h3>
            <p className="text-sm text-purple-700">
              Interactive piano keyboard for pitch reference
            </p>
          </button>

          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="p-6 bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200 rounded-xl hover:shadow-lg transition-all text-left group"
          >
            <TrendingUp className="w-8 h-8 text-blue-700 mb-3" />
            <h3 className="text-lg font-bold text-blue-900 mb-2">Practice Analytics</h3>
            <p className="text-sm text-blue-700">
              Detailed insights into your practice patterns
            </p>
          </button>
        </div>

        {showPiano && (
          <div className="mt-6 p-6 bg-gray-50 rounded-xl">
            <h4 className="text-lg font-bold text-gray-900 mb-4">Virtual Piano</h4>
            <div className="flex gap-1 overflow-x-auto pb-2">
              {notes.map((note) => {
                const isBlackKey = note.includes('#');
                return (
                  <button
                    key={note}
                    onClick={() => playNote(note)}
                    className={`
                      ${isBlackKey
                        ? 'w-10 h-24 bg-gray-800 text-white -mx-5 z-10 hover:bg-gray-700'
                        : 'w-12 h-32 bg-white text-gray-800 hover:bg-gray-100'
                      }
                      border-2 border-gray-300 rounded-b flex items-end justify-center pb-2 text-xs font-semibold transition-colors
                      ${activeNote === note ? (isBlackKey ? 'bg-gray-600' : 'bg-blue-100') : ''}
                    `}
                  >
                    {note}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">Click the keys for pitch references</p>
          </div>
        )}

        {showAnalytics && (
          <div className="mt-6 p-6 bg-gray-50 rounded-xl">
            <h4 className="text-lg font-bold text-gray-900 mb-4">Practice Analytics</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Total Minutes</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalMinutes}</p>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Total Sessions</p>
                <p className="text-2xl font-bold text-blue-900">{stats.sessionCount}</p>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Avg. Session</p>
                <p className="text-2xl font-bold text-blue-900">
                  {stats.sessionCount > 0
                    ? Math.round(stats.totalMinutes / stats.sessionCount)
                    : 0} min
                </p>
              </div>
            </div>

            <div>
              <h5 className="font-semibold text-gray-900 mb-3">Recent Practice Sessions</h5>
              {logs.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.slice(0, 10).map((log) => (
                    <div key={log.id} className="p-3 bg-white rounded-lg border border-gray-200 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-semibold text-gray-900">{getSongTitle(log.song_id)}</p>
                          <span className="text-sm text-gray-600">{log.duration} min</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(log.date).toLocaleDateString()} • Speed: {log.speed_used}
                        </p>
                        {log.notes && (
                          <p className="text-sm text-gray-600 mt-2">{log.notes}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="ml-3 p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete log"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No practice sessions logged yet</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-blue-900">My Practice Playlists</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Playlist
          </button>
        </div>

        {playlists.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="p-5 border-2 border-blue-200 bg-blue-50 rounded-xl hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <ListMusic className="w-6 h-6 text-blue-700 mb-2" />
                    <h4 className="text-lg font-bold text-blue-900 mb-1">{playlist.name}</h4>
                    <p className="text-sm text-gray-600">{playlist.song_ids.length} songs</p>
                  </div>
                  <button
                    onClick={() => handleDeletePlaylist(playlist.id)}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                    title="Delete playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No playlists yet. Create one to get started!</p>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-blue-900 mb-4">Create New Playlist</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleCreatePlaylist()}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-blue-900 mb-4">Log Practice Session</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Song</label>
                <select
                  value={logForm.song_id}
                  onChange={(e) => setLogForm({ ...logForm, song_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a song...</option>
                  {songs.map((song) => (
                    <option key={song.id} value={song.id}>
                      {song.title} - {song.composer}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={logForm.duration}
                  onChange={(e) => setLogForm({ ...logForm, duration: parseInt(e.target.value) || 0 })}
                  min="1"
                  max="300"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Speed Used</label>
                <select
                  value={logForm.speed_used}
                  onChange={(e) => setLogForm({ ...logForm, speed_used: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="50%">50% - Very Slow</option>
                  <option value="60%">60% - Slow</option>
                  <option value="70%">70%</option>
                  <option value="80%">80%</option>
                  <option value="90%">90%</option>
                  <option value="100%">100% - Full Tempo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (optional)</label>
                <textarea
                  value={logForm.notes}
                  onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Any notes about this practice session..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLogModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogPractice}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Log Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
