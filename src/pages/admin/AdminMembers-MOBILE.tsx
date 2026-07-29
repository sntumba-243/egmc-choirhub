import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { createSearcher, MEMBER_KEYS } from '../../lib/smartSearch';
import { isMobile } from '../../utils/mobile-helpers';
import '../../styles/mobile-optimization.css';

interface Member {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'member';
  voice_part: 'soprano' | 'alto' | 'tenor' | 'bass' | null;
  created_at: string;
}

export function AdminMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'member'>('all');
  const [filterVoicePart, setFilterVoicePart] = useState<'all' | 'soprano' | 'alto' | 'tenor' | 'bass'>('all');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    role: 'member' as 'admin' | 'member',
    voice_part: '' as '' | 'soprano' | 'alto' | 'tenor' | 'bass'
  });
  const [saving, setSaving] = useState(false);

  const mobile = isMobile();

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (fetchError) throw fetchError;
      setMembers(data || []);
    } catch (err) {
      console.error('Error loading members:', err);
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  }

  function handleEditMember(member: Member) {
    setSelectedMember(member);
    setEditFormData({
      full_name: member.full_name,
      role: member.role,
      voice_part: member.voice_part || ''
    });
    setShowEditModal(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMember) return;

    try {
      setSaving(true);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: editFormData.full_name.trim(),
          role: editFormData.role,
          voice_part: editFormData.voice_part || null
        })
        .eq('id', selectedMember.id);

      if (updateError) throw updateError;

      // Reload members
      await loadMembers();
      setShowEditModal(false);
      setSelectedMember(null);
    } catch (err) {
      console.error('Error updating member:', err);
      setError('Failed to update member');
    } finally {
      setSaving(false);
    }
  }

  function getVoicePartEmoji(voicePart: string | null) {
    switch (voicePart) {
      case 'soprano':
        return '🎵';
      case 'alto':
        return '🎶';
      case 'tenor':
        return '🎼';
      case 'bass':
        return '🎹';
      default:
        return '👤';
    }
  }

  function getRoleBadgeColor(role: string) {
    return role === 'admin' 
      ? 'bg-purple-100 text-purple-800'
      : 'bg-blue-100 text-blue-800';
  }

  // Fuzzy search first (ranked), then the existing filters on its output.
  const memberSearcher = useMemo(() => createSearcher(members, MEMBER_KEYS), [members]);
  const filteredMembers = memberSearcher(searchQuery).filter(member => {
    const matchesRole = filterRole === 'all' || member.role === filterRole;
    const matchesVoicePart = filterVoicePart === 'all' || member.voice_part === filterVoicePart;

    return matchesRole && matchesVoicePart;
  });

  // Stats
  const stats = {
    total: members.length,
    admins: members.filter(m => m.role === 'admin').length,
    soprano: members.filter(m => m.voice_part === 'soprano').length,
    alto: members.filter(m => m.voice_part === 'alto').length,
    tenor: members.filter(m => m.voice_part === 'tenor').length,
    bass: members.filter(m => m.voice_part === 'bass').length,
  };

  if (loading) {
    return (
      <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
      {/* Header */}
      <h1 className={mobile ? 'text-2xl font-bold text-gray-900 mb-4' : 'text-3xl font-bold text-gray-900 mb-6'}>
        Members
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-600 hover:text-red-800 font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className={mobile ? 'grid grid-cols-2 gap-3 mb-4' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6'}>
        <div className={mobile ? 'mobile-card bg-blue-50' : 'bg-blue-50 rounded-lg p-4'}>
          <div className="text-2xl mb-1">👥</div>
          <div className="text-2xl font-bold text-blue-800">{stats.total}</div>
          <div className="text-sm text-blue-600">Total</div>
        </div>
        <div className={mobile ? 'mobile-card bg-purple-50' : 'bg-purple-50 rounded-lg p-4'}>
          <div className="text-2xl mb-1">⭐</div>
          <div className="text-2xl font-bold text-purple-800">{stats.admins}</div>
          <div className="text-sm text-purple-600">Admins</div>
        </div>
        <div className={mobile ? 'mobile-card bg-pink-50' : 'bg-pink-50 rounded-lg p-4'}>
          <div className="text-2xl mb-1">🎵</div>
          <div className="text-2xl font-bold text-pink-800">{stats.soprano}</div>
          <div className="text-sm text-pink-600">Soprano</div>
        </div>
        <div className={mobile ? 'mobile-card bg-yellow-50' : 'bg-yellow-50 rounded-lg p-4'}>
          <div className="text-2xl mb-1">🎶</div>
          <div className="text-2xl font-bold text-yellow-800">{stats.alto}</div>
          <div className="text-sm text-yellow-600">Alto</div>
        </div>
        <div className={mobile ? 'mobile-card bg-green-50' : 'bg-green-50 rounded-lg p-4'}>
          <div className="text-2xl mb-1">🎼</div>
          <div className="text-2xl font-bold text-green-800">{stats.tenor}</div>
          <div className="text-sm text-green-600">Tenor</div>
        </div>
        <div className={mobile ? 'mobile-card bg-indigo-50' : 'bg-indigo-50 rounded-lg p-4'}>
          <div className="text-2xl mb-1">🎹</div>
          <div className="text-2xl font-bold text-indigo-800">{stats.bass}</div>
          <div className="text-sm text-indigo-600">Bass</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or email..."
          className={mobile ? 'mobile-input' : 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'}
        />
      </div>

      {/* Filters */}
      <div className={mobile ? 'space-y-3 mb-4' : 'flex gap-4 mb-6'}>
        <div className={mobile ? '' : 'flex-1'}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role
          </label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
        </div>

        <div className={mobile ? '' : 'flex-1'}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Voice Part
          </label>
          <select
            value={filterVoicePart}
            onChange={(e) => setFilterVoicePart(e.target.value as any)}
            className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
          >
            <option value="all">All Voice Parts</option>
            <option value="soprano">Soprano</option>
            <option value="alto">Alto</option>
            <option value="tenor">Tenor</option>
            <option value="bass">Bass</option>
          </select>
        </div>
      </div>

      {/* Members List */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {filteredMembers.length} of {members.length} members
      </div>

      {filteredMembers.length === 0 ? (
        <div className={mobile ? 'mobile-card' : 'bg-white rounded-lg shadow-md p-8'}>
          <div className="text-center text-gray-500">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-lg">No members found</p>
            <p className="text-sm mt-2">Try adjusting your search or filters</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              onClick={() => handleEditMember(member)}
              className={mobile ? 'mobile-card cursor-pointer hover:shadow-lg transition-shadow' : 'bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow'}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="text-3xl flex-shrink-0">
                    {getVoicePartEmoji(member.voice_part)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {member.full_name}
                    </p>
                    <p className="text-sm text-gray-600 truncate">
                      {member.email}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                        {member.role.toUpperCase()}
                      </span>
                      {member.voice_part && (
                        <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {member.voice_part.charAt(0).toUpperCase() + member.voice_part.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                  ✏️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={mobile ? 'mobile-card bg-white w-full max-w-lg' : 'bg-white rounded-lg p-6 w-full max-w-lg'}>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Edit Member
            </h2>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={selectedMember.email}
                  disabled
                  className={mobile ? 'mobile-input bg-gray-100' : 'w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100'}
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as 'admin' | 'member' })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice Part
                </label>
                <select
                  value={editFormData.voice_part}
                  onChange={(e) => setEditFormData({ ...editFormData, voice_part: e.target.value as any })}
                  className={mobile ? 'mobile-input' : 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'}
                >
                  <option value="">Not specified</option>
                  <option value="soprano">Soprano</option>
                  <option value="alto">Alto</option>
                  <option value="tenor">Tenor</option>
                  <option value="bass">Bass</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedMember(null);
                  }}
                  disabled={saving}
                  className={mobile ? 'mobile-button mobile-button-secondary flex-1' : 'flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={mobile ? 'mobile-button mobile-button-primary flex-1' : 'flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
