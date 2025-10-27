import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Users, Filter } from 'lucide-react';
import { membersService, Member } from '../../lib/database';

interface AdminMembersProps {
  onNavigateToForm: (memberId?: string) => void;
}

export const AdminMembers: React.FC<AdminMembersProps> = ({ onNavigateToForm }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [voicePartFilter, setVoicePartFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [members, searchQuery, voicePartFilter, statusFilter]);

  const loadMembers = async () => {
    try {
      const data = await membersService.getMembers();
      setMembers(data);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterMembers = () => {
    let result = [...members];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        member =>
          member.name.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query)
      );
    }

    if (voicePartFilter !== 'all') {
      result = result.filter(member => member.voice_part === voicePartFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter(member => member.status === statusFilter);
    }

    setFilteredMembers(result);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await membersService.deleteMember(deleteConfirm.id);
      setMembers(members.filter(m => m.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Failed to delete member');
    }
  };

  const getVoicePartColor = (voicePart?: string): string => {
    const colors: Record<string, string> = {
      soprano: 'bg-pink-100 text-pink-700 border-pink-300',
      alto: 'bg-purple-100 text-purple-700 border-purple-300',
      tenor: 'bg-blue-100 text-blue-700 border-blue-300',
      bass: 'bg-green-100 text-green-700 border-green-300',
    };
    return voicePart ? colors[voicePart] || 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-700';
  };

  const getRoleBadgeColor = (role: string): string => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-700',
      'section leader': 'bg-amber-100 text-amber-700',
      member: 'bg-blue-100 text-blue-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  const getVoicePartCounts = () => {
    const counts = {
      soprano: 0,
      alto: 0,
      tenor: 0,
      bass: 0,
    };

    members.forEach(member => {
      if (member.voice_part && counts.hasOwnProperty(member.voice_part)) {
        counts[member.voice_part as keyof typeof counts]++;
      }
    });

    return counts;
  };

  const voicePartCounts = getVoicePartCounts();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading members...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-blue-900">Member Management</h2>
            <p className="text-gray-600 mt-1">Showing {filteredMembers.length} members</p>
          </div>
          <button
            onClick={() => onNavigateToForm()}
            className="bg-blue-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add New Member
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Object.entries(voicePartCounts).map(([part, count]) => (
            <div
              key={part}
              className={`p-4 rounded-lg border-2 ${getVoicePartColor(part)}`}
            >
              <div className="text-sm font-semibold capitalize">{part}</div>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs opacity-75">members</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={voicePartFilter}
                onChange={e => setVoicePartFilter(e.target.value)}
                className="pl-9 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Voice Parts</option>
                <option value="soprano">Soprano</option>
                <option value="alto">Alto</option>
                <option value="tenor">Tenor</option>
                <option value="bass">Bass</option>
              </select>
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="pl-9 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">
              {searchQuery || voicePartFilter !== 'all' || statusFilter !== 'all'
                ? 'No members match your filters'
                : 'No members yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Member ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Voice Part</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredMembers.map(member => (
                  <tr
                    key={member.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => onNavigateToForm(member.id)}
                  >
                    <td className="py-4 px-4">
                      <div className="font-semibold text-blue-900">{member.name}</div>
                      {member.phone && (
                        <div className="text-sm text-gray-500">{member.phone}</div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {member.member_id || '-'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-700">{member.email}</td>
                    <td className="py-4 px-4">
                      {member.voice_part ? (
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold border ${getVoicePartColor(member.voice_part)}`}
                        >
                          {String(member.voice_part).charAt(0).toUpperCase() + String(member.voice_part).slice(1)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Not assigned</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${getRoleBadgeColor(member.role)}`}
                      >
                        {String(member.role).charAt(0).toUpperCase() + String(member.role).slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          member.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {String(member.status).charAt(0).toUpperCase() + String(member.status).slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onNavigateToForm(member.id);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setDeleteConfirm(member);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-blue-900 mb-3">Confirm Delete</h3>
            <p className="text-gray-700 mb-2">
              Are you sure you want to remove <strong>{deleteConfirm.name}</strong>?
            </p>
            <p className="text-gray-600 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
