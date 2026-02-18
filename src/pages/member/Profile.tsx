import React, { useState, useEffect, useRef } from 'react';
import { User, Music, Trash2, HardDrive, Download, Clock, Award, Target, Phone, Camera, Save, ChevronRight, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { offlineStorage, OfflineSong } from '../../lib/offlineStorage';
import { practiceLogService, PracticeLog } from '../../lib/practiceLog';
import toast from 'react-hot-toast';

export const MemberProfile: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [offlineSongs, setOfflineSongs] = useState<OfflineSong[]>([]);
  const [storageInfo, setStorageInfo] = useState({ usedMB: 0, totalMB: 100, percentage: 0 });
  const [practiceStats, setPracticeStats] = useState({
    weeklyTotal: 0,
    monthlyTotal: 0,
    mostPracticed: null as { songTitle: string; count: number } | null,
    streak: 0,
  });
  const [recentLogs, setRecentLogs] = useState<PracticeLog[]>([]);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showOffline, setShowOffline] = useState(false);

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
    setPracticeStats({
      weeklyTotal: practiceLogService.getWeeklyTotal(userId),
      monthlyTotal: practiceLogService.getMonthlyTotal(userId),
      mostPracticed: practiceLogService.getMostPracticedSong(userId),
      streak: practiceLogService.getCurrentStreak(userId),
    });
    setRecentLogs(practiceLogService.getRecentLogs(userId, 10));
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be less than 2MB'); return; }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('members').update({ avatar_url: publicUrl }).eq('id', user.id);
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
      const { error } = await supabase.from('members').update({ phone_number: phoneNumber }).eq('id', user.id);
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
    if (confirm('Clear all offline downloads?')) {
      offlineStorage.clearAll();
      loadOfflineData();
    }
  };

  const formatDate = (dateString: string): string =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const roleBadge = user?.role === 'guest'
    ? { bg: 'bg-blue-50 text-blue-700 ring-blue-200', label: 'Guest' }
    : user?.role === 'admin'
    ? { bg: 'bg-purple-50 text-purple-700 ring-purple-200', label: 'Admin' }
    : { bg: 'bg-green-50 text-green-700 ring-green-200', label: 'Member' };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center ring-2 ring-gray-100">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-gray-300" />
              )}
            </div>
            <button
              onClick={() => setShowAvatarMenu(!showAvatarMenu)}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 theme-btn rounded-full flex items-center justify-center shadow-md disabled:opacity-50"
            >
              <Camera className="w-3 h-3" />
            </button>
            {showAvatarMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAvatarMenu(false)} />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden w-44">
                  <button
                    onClick={() => { cameraInputRef.current?.click(); setShowAvatarMenu(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                  >
                    <Camera className="w-4 h-4 text-gray-400" />
                    Take Photo
                  </button>
                  <div className="h-px bg-gray-100" />
                  <button
                    onClick={() => { fileInputRef.current?.click(); setShowAvatarMenu(false); }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                  >
                    <Upload className="w-4 h-4 text-gray-400" />
                    Choose from Gallery
                  </button>
                </div>
              </>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="user" onChange={handleAvatarUpload} className="hidden" />
          </div>

          {/* Name & Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{user?.name}</h1>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${roleBadge.bg}`}>
                {roleBadge.label}
              </span>
              {user?.voice_part && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-600 ring-1 ring-gray-200">
                  {user.voice_part}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            Phone Number
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter phone number"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-300 focus:border-gray-300 outline-none"
              />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-3.5 py-2 rounded-lg theme-btn text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3 h-3" />
              {saving ? '...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Practice Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Practice Stats</h2>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: `${practiceStats.weeklyTotal}m`, label: 'Week', icon: Clock, color: 'text-blue-600 bg-blue-50' },
            { value: `${practiceStats.monthlyTotal}m`, label: 'Month', icon: Target, color: 'text-green-600 bg-green-50' },
            { value: practiceStats.mostPracticed?.songTitle?.split(' ')[0] || '—', label: 'Top Song', icon: Music, color: 'text-amber-600 bg-amber-50' },
            { value: `${practiceStats.streak}d`, label: 'Streak', icon: Award, color: 'text-red-500 bg-red-50' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className={`w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-3.5 h-3.5" />
              </div>
              <p className="text-sm font-bold text-gray-900 truncate">{stat.value}</p>
              <p className="text-[10px] text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Offline Downloads - Collapsible */}
      <div className="bg-white rounded-xl border border-gray-200">
        <button
          onClick={() => setShowOffline(!showOffline)}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <HardDrive className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Offline Downloads</p>
              <p className="text-[10px] text-gray-400">{offlineSongs.length} songs · {storageInfo.usedMB.toFixed(1)} MB</p>
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showOffline ? 'rotate-90' : ''}`} />
        </button>

        {showOffline && (
          <div className="px-4 pb-4 border-t border-gray-100">
            {/* Storage bar */}
            <div className="mt-3 mb-3">
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${storageInfo.percentage > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{storageInfo.percentage.toFixed(0)}% used</p>
            </div>

            {offlineSongs.length === 0 ? (
              <div className="text-center py-4">
                <Download className="w-5 h-5 mx-auto mb-1 text-gray-300" />
                <p className="text-xs text-gray-400">No offline songs</p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  {offlineSongs.map((song) => (
                    <div key={song.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{song.title}</p>
                        <p className="text-[10px] text-gray-400">{formatDate(song.downloadedAt)}</p>
                      </div>
                      <button onClick={() => handleRemoveSong(song.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {offlineSongs.length > 1 && (
                  <button onClick={handleClearAll} className="mt-2 text-[11px] text-red-500 hover:text-red-600 font-medium">
                    Clear all downloads
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {recentLogs.length === 0 && (
        <div className="text-center py-6">
          <p className="text-xs text-gray-400">Start practicing to see your stats grow</p>
        </div>
      )}
    </div>
  );
};

export default MemberProfile;
