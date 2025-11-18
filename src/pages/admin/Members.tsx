import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Search, Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Member {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  voice_part: string;
  role: string;
  status: string;
}

export const AdminMembers = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVoice, setFilterVoice] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('last_name', { ascending: true });

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
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Mobile Optimized */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">Members</h1>
          <p className="text-xs sm:text-sm text-gray-600">
            {members.length} total · {roleCounts.admin} admin · {roleCounts.member} member · {roleCounts.guest} guest
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/members/new')}
          className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-indigo-600 text-white rounded-lg hover:shadow-lg active:scale-95 transition-all flex-shrink-0 text-sm sm:text-base"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Add New</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Voice Part Stats - Mobile: 2x2 grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Object.entries(voicePartCounts).map(([voice, count]) => {
          const colors = {
            Soprano: 'bg-pink-100 text-pink-700 border-pink-200',
            Alto: 'bg-purple-100 text-purple-700 border-purple-200',
            Tenor: 'bg-blue-100 text-blue-700 border-blue-200',
            Bass: 'bg-green-100 text-green-700 border-green-200',
          };
          
          return (
            <div
              key={voice}
              onClick={() => setFilterVoice(voice)} className={`${colors[voice as keyof typeof colors]} rounded-xl p-4 border-2 text-center cursor-pointer hover:opacity-80 transition-all active:scale-95`}
            >
              <div className="text-2xl sm:text-3xl font-bold mb-1">{count}</div>
              <div className="text-xs sm:text-sm font-medium">{voice}</div>
              <div className="text-xs opacity-75">members</div>
            </div>
          );
        })}
      </div>

      {/* Search & Filters - Mobile Stacked */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base"
          />
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <select
            value={filterVoice}
            onChange={(e) => setFilterVoice(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="all">All Voices</option>
            <option value="Soprano">Soprano</option>
            <option value="Alto">Alto</option>
            <option value="Tenor">Tenor</option>
            <option value="Bass">Bass</option>
          </select>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="guest">Guest</option>
          </select>
        </div>
      </div>

      {/* Members List - Mobile Optimized Cards */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center">
          <div className="text-4xl sm:text-5xl mb-4">👥</div>
          <h3 className="text-lg sm:text-xl font-semibold mb-2">No members found</h3>
          <p className="text-sm sm:text-base text-gray-600">
            {searchTerm ? 'Try a different search term' : 'Add your first member to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              onClick={() => navigate(`/admin/members/${member.id}/edit`)}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-4 cursor-pointer border border-gray-100 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Member Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                      {member.first_name} {member.last_name}
                    </h3>
                    <span className={`
                      px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0
                      ${member.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'}
                    `}>
                      {member.status}
                    </span>
                    {/* Role Badge */}
                    <span className={`
                      px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0
                      ${member.role === 'admin' 
                        ? 'bg-red-100 text-red-700' 
                        : member.role === 'guest'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'}
                    `}>
                      {member.role === 'admin' ? '👑 Admin' : 
                       member.role === 'guest' ? '👤 Guest' : 
                       '👤 Member'}
                    </span>
                  </div>
                  
                  <p className="text-xs sm:text-sm text-gray-600 mb-1 truncate">
                    {member.email}
                  </p>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-700 rounded">
                      {member.voice_part}
                    </span>
                    <span className="text-xs text-gray-500">
                      ID: {member.member_id}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/admin/members/${member.id}/edit`);
                    }}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg active:bg-indigo-100 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, member.id, `${member.first_name} ${member.last_name}`)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg active:bg-red-100 transition-colors"
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
