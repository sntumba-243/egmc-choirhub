import React, { useState, useEffect } from 'react';
import { User, Music, Trash2, HardDrive, Download, AlertCircle, TrendingUp, Clock, Award, Target } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { offlineStorage, OfflineSong } from '../../lib/offlineStorage';
import { practiceLogService, PracticeLog } from '../../lib/practiceLog';

export const MemberProfile: React.FC = () => {
  const { user } = useAuth();
  const [offlineSongs, setOfflineSongs] = useState<OfflineSong[]>([]);
  const [storageInfo, setStorageInfo] = useState({ usedMB: 0, totalMB: 100, percentage: 0 });
  const [autoClear, setAutoClear] = useState(true);
  const [practiceStats, setPracticeStats] = useState({
    weeklyTotal: 0,
    monthlyTotal: 0,
    mostPracticed: null as { songTitle: string; count: number } | null,
    streak: 0,
  });
  const [recentLogs, setRecentLogs] = useState<PracticeLog[]>([]);

  useEffect(() => {
    loadOfflineData();
    loadPracticeData();
  }, []);

  const loadOfflineData = () => {
    const songs = offlineStorage.getOfflineSongs();
    const info = offlineStorage.getStorageInfo();
    setOfflineSongs(songs);
    setStorageInfo(info);
  };

  const loadPracticeData = () => {
    const userId = user?.id || 'member';
    const weeklyTotal = practiceLogService.getWeeklyTotal(userId);
    const monthlyTotal = practiceLogService.getMonthlyTotal(userId);
    const mostPracticed = practiceLogService.getMostPracticedSong(userId);
    const streak = practiceLogService.getCurrentStreak(userId);
    const recent = practiceLogService.getRecentLogs(userId, 10);

    setPracticeStats({
      weeklyTotal,
      monthlyTotal,
      mostPracticed,
      streak,
    });
    setRecentLogs(recent);
  };

  const handleRemoveSong = (songId: string) => {
    if (confirm('Remove this song from offline storage?')) {
      offlineStorage.removeSong(songId);
      loadOfflineData();
    }
  };

  const handleClearAll = () => {
    if (confirm('Clear all offline downloads? This cannot be undone.')) {
      offlineStorage.clearAll();
      loadOfflineData();
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-blue-900" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-blue-900">{user?.name}</h2>
            <p className="text-gray-600">{user?.email}</p>
            {user?.voicePart && (
              <span className="inline-block mt-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold capitalize">
                {user.voicePart}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          Practice Statistics
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-700" />
              <span className="text-sm font-semibold text-blue-900">This Week</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {practiceLogService.formatDuration(practiceStats.weeklyTotal)}
            </p>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-green-700" />
              <span className="text-sm font-semibold text-green-900">This Month</span>
            </div>
            <p className="text-2xl font-bold text-green-900">
              {practiceLogService.formatDuration(practiceStats.monthlyTotal)}
            </p>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Music className="w-5 h-5 text-purple-700" />
              <span className="text-sm font-semibold text-purple-900">Most Practiced</span>
            </div>
            <p className="text-sm font-bold text-purple-900 truncate">
              {practiceStats.mostPracticed?.songTitle || 'None yet'}
            </p>
            {practiceStats.mostPracticed && (
              <p className="text-xs text-purple-700">
                {practiceStats.mostPracticed.count} session{practiceStats.mostPracticed.count !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-orange-700" />
              <span className="text-sm font-semibold text-orange-900">Current Streak</span>
            </div>
            <p className="text-2xl font-bold text-orange-900">
              {practiceStats.streak} {practiceStats.streak === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>

        {recentLogs.length > 0 && (
          <>
            <h4 className="text-lg font-bold text-blue-900 mb-3">Recent Practice Sessions</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Song</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Duration</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Speed</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 text-sm font-semibold text-blue-900">{log.songTitle}</td>
                      <td className="py-3 px-3 text-sm text-gray-600">{formatDate(log.date)}</td>
                      <td className="py-3 px-3 text-sm text-gray-600">
                        {practiceLogService.formatDuration(log.duration)}
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-600">{log.speedUsed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {recentLogs.length === 0 && (
          <div className="text-center py-8">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No practice sessions yet</p>
            <p className="text-sm text-gray-500">
              Start practicing songs to see your stats here
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
          <HardDrive className="w-6 h-6" />
          Offline Storage
        </h3>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Storage Used</span>
            <span className="text-sm font-semibold text-blue-900">
              {storageInfo.usedMB} MB of {storageInfo.totalMB} MB
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                storageInfo.percentage > 80
                  ? 'bg-red-500'
                  : storageInfo.percentage > 50
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{storageInfo.percentage}% used</p>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6">
          <div className="flex-1">
            <label htmlFor="auto-clear" className="text-sm font-semibold text-gray-700 cursor-pointer">
              Auto-clear after 30 days
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Automatically remove downloads older than 30 days
            </p>
          </div>
          <input
            type="checkbox"
            id="auto-clear"
            checked={autoClear}
            onChange={(e) => setAutoClear(e.target.checked)}
            className="w-5 h-5 text-blue-900 rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-blue-900 flex items-center gap-2">
            <Download className="w-6 h-6" />
            Offline Downloads
          </h3>
          {offlineSongs.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg font-semibold hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>

        {offlineSongs.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No offline downloads yet</p>
            <p className="text-sm text-gray-500">
              Download songs from the repertoire to access them offline
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {offlineSongs.map((song) => (
              <div
                key={song.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-blue-900 truncate">{song.title}</h4>
                  <p className="text-sm text-gray-600">{song.composer}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span>Downloaded: {formatDate(song.downloadedAt)}</span>
                    <span>•</span>
                    <span>{offlineStorage.formatBytes(song.storageSize)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveSong(song.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-4"
                  title="Remove from offline storage"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {offlineSongs.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Offline Access</p>
              <p className="text-blue-700">
                Downloaded songs can be accessed when you're offline. Audio files and sheet music are
                cached on your device.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
