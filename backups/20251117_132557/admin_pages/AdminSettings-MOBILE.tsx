import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { isMobile } from '../../utils/mobile-helpers';
import '../../styles/mobile-optimization.css';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'member';
  voice_part: 'soprano' | 'alto' | 'tenor' | 'bass' | null;
}

export function AdminSettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Profile form
  const [fullName, setFullName] = useState('');
  const [voicePart, setVoicePart] = useState<'' | 'soprano' | 'alto' | 'tenor' | 'bass'>('');
  const [saving, setSaving] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const mobile = isMobile();

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      setProfile(data);
      setFullName(data.full_name);
      setVoicePart(data.voice_part || '');
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          voice_part: voicePart || null
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setSuccess('Profile updated successfully!');
      await loadProfile();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setChangingPassword(true);
      setError(null);
      setSuccess(null);

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error changing password:', err);
      setError(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800">Failed to load profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
      {/* Header */}
      <h1 className={mobile ? 'text-2xl font-bold text-gray-900 mb-4' : 'text-3xl font-bold text-gray-900 mb-6'}>
        Settings
      </h1>

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 flex items-center justify-between">
          <span>✅ {success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800 font-semibold">
            ✕
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center justify-between">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-semibold">
            ✕
          </button>
        </div>
      )}

      {/* Profile Information Card */}
      <div className={mobile ? 'mobile-card mb-4' : 'bg-white rounded-lg shadow-md p-6 mb-6'}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Profile Information</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className={mobile ? 'mobile-input bg-gray-100' : 'w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100'}
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <input
              type="text"
              value={profile.role.toUpperCase()}
              disabled
              className={mobile ? 'mobile-input bg-gray-100' : 'w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100'}
            />
            <p className="text-xs text-gray-500 mt-1">Role cannot be self-changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Voice Part
            </label>
            <select
              value={voicePart}
              onChange={(e) => setVoicePart(e.target.value as any)}
              className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'}
            >
              <option value="">Not specified</option>
              <option value="soprano">Soprano</option>
              <option value="alto">Alto</option>
              <option value="tenor">Tenor</option>
              <option value="bass">Bass</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className={mobile ? 'mobile-button mobile-button-primary w-full' : 'w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50'}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Change Password Card */}
      <div className={mobile ? 'mobile-card mb-4' : 'bg-white rounded-lg shadow-md p-6 mb-6'}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'}
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'}
              placeholder="Enter new password (min 6 characters)"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'}
              placeholder="Confirm new password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={changingPassword}
            className={mobile ? 'mobile-button mobile-button-primary w-full' : 'w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50'}
          >
            {changingPassword ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* App Information Card */}
      <div className={mobile ? 'mobile-card mb-4' : 'bg-white rounded-lg shadow-md p-6 mb-6'}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">App Information</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <span className="text-gray-700">App Name</span>
            <span className="font-medium text-gray-900">EGMC ChoirHub</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <span className="text-gray-700">Version</span>
            <span className="font-medium text-gray-900">1.0.0</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <span className="text-gray-700">Environment</span>
            <span className="font-medium text-gray-900">
              {window.location.hostname.includes('localhost') ? 'Development' : 'Production'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-700">Your User ID</span>
            <span className="font-mono text-xs text-gray-600 truncate max-w-[200px]">
              {profile.id}
            </span>
          </div>
        </div>
      </div>

      {/* Danger Zone Card */}
      <div className={mobile ? 'mobile-card border-2 border-red-200' : 'bg-white rounded-lg shadow-md p-6 border-2 border-red-200'}>
        <h2 className="text-xl font-bold text-red-900 mb-4">⚠️ Danger Zone</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Clear Local Cache</h3>
            <p className="text-sm text-gray-600 mb-3">
              Clear all cached data from your browser. This won't affect your account data.
            </p>
            <button
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                setSuccess('Local cache cleared successfully!');
              }}
              className={mobile ? 'mobile-button bg-yellow-600 hover:bg-yellow-700 text-white' : 'px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700'}
            >
              Clear Cache
            </button>
          </div>

          <div className="pt-4 border-t border-red-200">
            <h3 className="font-semibold text-red-900 mb-2">Delete Account</h3>
            <p className="text-sm text-gray-600 mb-3">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              onClick={() => {
                alert('Account deletion must be requested through an administrator.');
              }}
              className={mobile ? 'mobile-button bg-red-600 hover:bg-red-700 text-white' : 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700'}
            >
              Request Account Deletion
            </button>
          </div>
        </div>
      </div>

      {/* Footer Spacing */}
      <div className="h-8"></div>
    </div>
  );
}
