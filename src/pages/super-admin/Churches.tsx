import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDbClient } from '../../lib/supabase';
import { Church, Plus, Search, Users, Edit, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface ChurchData {
  id: string;
  name: string;
  short_name: string;
  primary_color: string;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
  memberCount?: number;
}

export const Churches = () => {
  const navigate = useNavigate();
  const [churches, setChurches] = useState<ChurchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchChurches();
  }, []);

  const fetchChurches = async () => {
    try {
      const supabase = getDbClient();
      const { data, error } = await supabase
        .from('churches')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const churchesWithCounts: ChurchData[] = [];
      for (const church of data || []) {
        const { count } = await supabase
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('church_id', church.id);

        churchesWithCounts.push({ ...church, memberCount: count || 0 });
      }

      setChurches(churchesWithCounts);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load churches');
    } finally {
      setLoading(false);
    }
  };

  const filtered = churches.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.short_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-2 rounded-lg">
            <Church className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Churches</h1>
            <p className="text-xs text-gray-600">{churches.length} registered</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/super-admin/churches/new')}
          className="flex items-center justify-center gap-1 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700"
        >
          <Plus className="w-4 h-4" /> Add Church
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search churches..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((church) => (
          <button
            key={church.id}
            onClick={() => navigate(`/super-admin/churches/${church.id}`)}
            className="w-full bg-white rounded-lg p-4 border border-gray-100 hover:shadow-md transition-all text-left flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              {church.logo_url ? (
                <img src={church.logo_url} alt={church.short_name} className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: church.primary_color || '#6366f1' }}
                >
                  {church.short_name.substring(0, 2)}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900">{church.name}</h3>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" /> {church.memberCount} members
                  </span>
                  {church.city && (
                    <span className="text-xs text-gray-500">{church.city}{church.country ? `, ${church.country}` : ''}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${church.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {church.is_active ? 'Active' : 'Inactive'}
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="bg-white rounded-lg p-8 text-center border border-gray-100">
            <Church className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">{searchTerm ? 'No churches match your search' : 'No churches yet'}</p>
          </div>
        )}
      </div>
    </div>
  );
};
