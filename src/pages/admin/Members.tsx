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
    console.log('Delete clicked for:', name, id);
    
    if (!confirm(`Delete ${name}?`)) return;

    try {
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (error) throw error;
      setMembers(members.filter(m => m.id !== id));
      toast.success('Member deleted');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to delete');
    }
  };

  const filteredMembers = members.filter(member => {
    const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.member_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVoice = filterVoice === 'all' || member.voice_part === filterVoice;
    const matchesStatus = filterStatus === 'all' || member.status === filterStatus;
    return matchesSearch && matchesVoice && matchesStatus;
  });

  const voiceCounts = {
    Soprano: members.filter(m => m.voice_part === 'Soprano').length,
    Alto: members.filter(m => m.voice_part === 'Alto').length,
    Tenor: members.filter(m => m.voice_part === 'Tenor').length,
    Bass: members.filter(m => m.voice_part === 'Bass').length,
  };

  if (loading) {
    return <div className="flex justify-center p-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Member Management</h1>
          <p className="text-gray-600">Showing {filteredMembers.length} of {members.length} members</p>
        </div>
        <button
          onClick={() => navigate('/admin/members/new')}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Add New Member
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => setFilterVoice(filterVoice === 'Soprano' ? 'all' : 'Soprano')}
          className={`bg-pink-50 rounded-xl p-6 border-2 transition-all hover:shadow-lg text-left ${
            filterVoice === 'Soprano' ? 'border-pink-500 ring-2 ring-pink-200' : 'border-pink-100'
          }`}
        >
          <div className="text-pink-600 font-semibold mb-1">Soprano</div>
          <div className="text-3xl font-bold text-pink-900">{voiceCounts.Soprano}</div>
          <div className="text-sm text-pink-600">members</div>
          {filterVoice === 'Soprano' && <div className="text-xs mt-2 font-semibold text-pink-700">✓ Active Filter</div>}
        </button>

        <button
          onClick={() => setFilterVoice(filterVoice === 'Alto' ? 'all' : 'Alto')}
          className={`bg-purple-50 rounded-xl p-6 border-2 transition-all hover:shadow-lg text-left ${
            filterVoice === 'Alto' ? 'border-purple-500 ring-2 ring-purple-200' : 'border-purple-100'
          }`}
        >
          <div className="text-purple-600 font-semibold mb-1">Alto</div>
          <div className="text-3xl font-bold text-purple-900">{voiceCounts.Alto}</div>
          <div className="text-sm text-purple-600">members</div>
          {filterVoice === 'Alto' && <div className="text-xs mt-2 font-semibold text-purple-700">✓ Active Filter</div>}
        </button>

        <button
          onClick={() => setFilterVoice(filterVoice === 'Tenor' ? 'all' : 'Tenor')}
          className={`bg-blue-50 rounded-xl p-6 border-2 transition-all hover:shadow-lg text-left ${
            filterVoice === 'Tenor' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-100'
          }`}
        >
          <div className="text-blue-600 font-semibold mb-1">Tenor</div>
          <div className="text-3xl font-bold text-blue-900">{voiceCounts.Tenor}</div>
          <div className="text-sm text-blue-600">members</div>
          {filterVoice === 'Tenor' && <div className="text-xs mt-2 font-semibold text-blue-700">✓ Active Filter</div>}
        </button>

        <button
          onClick={() => setFilterVoice(filterVoice === 'Bass' ? 'all' : 'Bass')}
          className={`bg-green-50 rounded-xl p-6 border-2 transition-all hover:shadow-lg text-left ${
            filterVoice === 'Bass' ? 'border-green-500 ring-2 ring-green-200' : 'border-green-100'
          }`}
        >
          <div className="text-green-600 font-semibold mb-1">Bass</div>
          <div className="text-3xl font-bold text-green-900">{voiceCounts.Bass}</div>
          <div className="text-sm text-green-600">members</div>
          {filterVoice === 'Bass' && <div className="text-xs mt-2 font-semibold text-green-700">✓ Active Filter</div>}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, or member ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 px-4 py-3 border rounded-lg"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-3 border rounded-lg">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left font-semibold">Name</th>
              <th className="px-6 py-4 text-left font-semibold">Member ID</th>
              <th className="px-6 py-4 text-left font-semibold">Voice Part</th>
              <th className="px-6 py-4 text-left font-semibold">Role</th>
              <th className="px-6 py-4 text-left font-semibold">Status</th>
              <th className="px-6 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredMembers.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-semibold">{member.first_name} {member.last_name}</div>
                  <div className="text-sm text-gray-600">{member.email}</div>
                </td>
                <td className="px-6 py-4 text-gray-600">{member.member_id}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    member.voice_part === 'Soprano' ? 'bg-pink-100 text-pink-800' :
                    member.voice_part === 'Alto' ? 'bg-purple-100 text-purple-800' :
                    member.voice_part === 'Tenor' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {member.voice_part}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    member.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {member.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/members/${member.id}/edit`);
                      }}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, member.id, `${member.first_name} ${member.last_name}`)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
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
    </div>
  );
};
