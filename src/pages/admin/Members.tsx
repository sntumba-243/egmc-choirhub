import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { User, Search, Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../contexts/ChurchContext';

interface Member {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  avatar_url?: string;
  last_active?: string;
  voice_part: string;
  role: string;
  status: string;
  church_id?: string;
  churches?: { name: string };
}

export const AdminMembers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { church } = useChurch();
  const isSuperAdmin = user?.is_super_admin === true;
  const [members, setMembers] = useState<Member[]>([]);

  const isOnline = (lastActive: string | undefined) => {
    if (!lastActive) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(lastActive) > fiveMinutesAgo;
  };

  const getLastActiveText = (lastActive: string | undefined) => {
    if (!lastActive) return 'Never';
    const now = new Date();
    const active = new Date(lastActive);
    const diffMs = now.getTime() - active.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 5) return 'Online now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVoice, setFilterVoice] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => {
    fetchMembers();
  }, [user?.church_id, isSuperAdmin]);

  const fetchMembers = async () => {
    try {
      let query = supabase.from('members').select('id, first_name, last_name, email, role, voice_part, member_id, phone_number, avatar_url, created_at, status, last_active, church_id, churches(name)');
      if (isSuperAdmin) {
        query = query.eq('role', 'admin');
      } else {
        query = query.eq('church_id', user?.church_id);
      }
      const { data, error } = await query.order('last_name', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    
    if (!confirm(`Delete ${name}?`)) return;
    
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMembers(members.filter(m => m.id !== id));
      toast.success('Member deleted');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to delete member');
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      member.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesVoice = filterVoice === 'all' || member.voice_part === filterVoice;
    const matchesStatus = filterStatus === 'all' || member.status === filterStatus;
    const matchesRole = filterRole === 'all' || member.role === filterRole;
    
    return matchesSearch && matchesVoice && matchesStatus && matchesRole;
  });

  const voicePartCounts = {
    Soprano: members.filter(m => m.voice_part === 'Soprano').length,
    Alto: members.filter(m => m.voice_part === 'Alto').length,
    Tenor: members.filter(m => m.voice_part === 'Tenor').length,
    Bass: members.filter(m => m.voice_part === 'Bass').length,
  };

  const roleCounts = {
    admin: members.filter(m => m.role === 'admin').length,
    member: members.filter(m => m.role === 'member').length,
    guest: members.filter(m => m.role === 'guest').length,
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{isSuperAdmin ? "Church Admins" : "Members"}</h1>
          <p className="text-xs text-gray-600">
            {isSuperAdmin ? `${members.length} admins across all churches` : `${members.length} total · ${roleCounts.admin} admin · ${roleCounts.member} member · ${roleCounts.guest} guest`}
          </p>
        </div>
        <button
          onClick={() => navigate(isSuperAdmin ? '/super-admin/members/new' : '/admin/members/new')}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-xl text-[13px] font-semibold hover:bg-blue-600 shadow-sm transition-all flex-shrink-0 min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>Add New</span>
        </button>
      </div>

      {/* Compact Voice Part Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(voicePartCounts).map(([voice, count]) => {
          const colors = {
            Soprano: 'bg-pink-50 border-pink-200 text-pink-700',
            Alto: 'bg-purple-50 border-purple-200 text-purple-700',
            Tenor: 'bg-blue-50 border-blue-200 text-blue-700',
            Bass: 'bg-green-50 border-green-200 text-green-700',
          };
          
          return (
            <button
              key={voice}
              onClick={() => setFilterVoice(filterVoice === voice ? 'all' : voice)}
              className={`${colors[voice as keyof typeof colors]} rounded-lg border-2 p-2 text-center transition-all hover:opacity-80 ${
                filterVoice === voice ? 'ring-2 ring-indigo-500' : ''
              }`}
            >
              <div className="text-xl font-bold">{count}</div>
              <div className="text-xs font-medium">{voice}</div>
            </button>
          );
        })}
      </div>

      {/* Compact Search & Filters */}
      <div className="bg-white rounded-lg shadow-sm p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm min-h-[44px]"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs min-h-[44px]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs min-h-[44px]"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="guest">Guest</option>
          </select>
        </div>
      </div>

      {/* Compact Members List */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="text-4xl mb-3">👥</div>
          <h3 className="text-base font-semibold mb-1">No members found</h3>
          <p className="text-sm text-gray-600">
            {searchTerm ? 'Try a different search term' : 'Add your first member to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              onClick={() => navigate(isSuperAdmin ? `/super-admin/members/${member.id}/edit` : `/admin/members/${member.id}/edit`)}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-3 cursor-pointer border border-gray-100"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${isOnline(member.last_active) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                </div>
                
                {/* Member Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">
                      {member.first_name} {member.last_name}
                    </h3>
                    <span className={`
                      px-1.5 py-0.5 text-xs font-medium rounded-full flex-shrink-0
                      ${member.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'}
                    `}>
                      {member.status}
                    </span>
                    <span className={`
                      px-1.5 py-0.5 text-xs font-semibold rounded-full flex-shrink-0
                      ${member.role === 'admin' 
                        ? 'bg-red-100 text-red-700' 
                        : member.role === 'guest'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'}
                    `}>
                      {member.role === 'admin' ? '👑' : 
                       member.role === 'guest' ? '👤' : 
                       '👤'}
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-600 mb-1 truncate">
                    {member.email}
                  </p>
                  {isSuperAdmin && member.churches?.name && (
                    <p className="text-xs text-indigo-600 font-medium mb-1 truncate">🏛 {member.churches.name}</p>
                  )}
                  
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded">
                      {member.voice_part}
                    </span>
                    <span className="text-xs text-gray-400">
                      {member.member_id}
                    </span>
                    <span className={`text-xs ${isOnline(member.last_active) ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                      • {getLastActiveText(member.last_active)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(isSuperAdmin ? `/super-admin/members/${member.id}/edit` : `/admin/members/${member.id}/edit`);
                    }}
                    className="p-2 min-h-[44px] min-w-[44px] text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, member.id, `${member.first_name} ${member.last_name}`)}
                    className="p-2 min-h-[44px] min-w-[44px] text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
