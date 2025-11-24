import React, { useState, useEffect, useRef } from 'react';
import { User, Music, Trash2, HardDrive, Download, TrendingUp, Clock, Award, Target, Phone, Camera, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { offlineStorage, OfflineSong } from '../../lib/offlineStorage';
import { practiceLogService, PracticeLog } from '../../lib/practiceLog';
import toast from 'react-hot-toast';

export const MemberProfile: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [offlineSongs, setOfflineSongs] = useState<OfflineSong[]>([]);
  const [storageInfo, setStorageInfo] = useState({ usedMB: 0, totalMB: 100, percentage: 0 });
  const [practiceStats, setPracticeStats] = useState({
    weeklyTotal: 0,
    monthlyTotal: 0,
    mostPracticed: null as { songTitle: string; count: number } | null,
    streak: 0,
  });
  const [recentLogs, setRecentLogs] = useState<PracticeLog[]>([]);
  
  // Profile fields
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadOfflineData();
    loadPracticeData();
    loadProfileData();
  }, [user]);

  const loadProfileData = async () => {
    if (!user?.id) return;
    
    try {
      const { data } = await supabase
        .from('members')
        .select('phone_number, avatar_url')
        .eq('id', user.id)
        .single();

      if (data) {
        setPhoneNumber(data.phone_number || '');
        setAvatarUrl(data.avatar_url || null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

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

    setPracticeStats({ weeklyTotal, monthlyTotal, mostPracticed, streak });
    setRecentLogs(recent);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('members')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast.success('Profile picture updated!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload picture');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('members')
        .update({ phone_number: phoneNumber })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Profile updated!');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
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
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 p-4">
      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">My Profile</h2>
        
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-4 border-purple-100">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 disabled:opacity-50 shadow-lg"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            {uploading && <p className="text-xs text-purple-600 mt-2">Uploading...</p>}
            <p className="text-xs text-gray-500 mt-2">Tap camera to change</p>
          </div>

          {/* Profile Info */}
          <div className="flex-1 w-full">
            <div className="mb-4">
              <p className="text-2xl font-bold text-gray-900">{user?.name}</p>
              <p className="text-gray-600">{user?.email}</p>
            </div>

            {/* Phone Number */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter your phone number"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Practice Stats */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          Practice Statistics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <Clock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-purple-600">{practiceStats.weeklyTotal} min</p>
            <p className="text-xs text-gray-600">This Week</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <Target className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{practiceStats.monthlyTotal} min</p>
            <p className="text-xs text-gray-600">This Month</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <Music className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-yellow-600 truncate">
              {practiceStats.mostPracticed?.songTitle || 'None yet'}
            </p>
            <p className="text-xs text-gray-600">Most Practiced</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <Award className="w-6 h-6 text-red-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-600">{practiceStats.streak} days</p>
            <p className="text-xs text-gray-600">Current Streak</p>
          </div>
        </div>
      </div>

      {/* Offline Storage */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-purple-600" />
            Offline Downloads
          </h2>
          {offlineSongs.length > 0 && (
            <button onClick={handleClearAll} className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1">
              <Trash2 className="w-4 h-4" /> Clear All
            </button>
          )}
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{storageInfo.usedMB.toFixed(1)} MB used</span>
            <span>{storageInfo.percentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${storageInfo.percentage > 80 ? 'bg-red-500' : 'bg-purple-600'}`}
              style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
            ></div>
          </div>
        </div>

        {offlineSongs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Download className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No songs downloaded for offline use</p>
          </div>
        ) : (
          <div className="space-y-2">
            {offlineSongs.map((song) => (
              <div key={song.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{song.title}</p>
                  <p className="text-sm text-gray-500">Downloaded {formatDate(song.downloadedAt)}</p>
                </div>
                <button onClick={() => handleRemoveSong(song.id)} className="text-red-600 hover:text-red-700 p-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* No practice sessions message */}
      {recentLogs.length === 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No practice sessions yet</p>
          <p className="text-sm text-gray-400">Start practicing songs to see your stats here</p>
        </div>
      )}
    </div>
  );
};

export default MemberProfile;
