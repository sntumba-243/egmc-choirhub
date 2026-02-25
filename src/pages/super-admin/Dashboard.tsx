import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDbClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Church, Users, Music, Calendar, Shield, Plus, ArrowRight } from 'lucide-react';

interface ChurchStats {
  id: string;
  name: string;
  short_name: string;
  primary_color: string;
  logo_url: string | null;
  memberCount: number;
}

export const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [churches, setChurches] = useState<ChurchStats[]>([]);
  const [totalSongs, setTotalSongs] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const supabase = getDbClient();

      const [churchesRes, songsRes, membersRes, eventsRes] = await Promise.all([
        supabase.from('churches').select('*').eq('is_active', true),
        supabase.from('songs').select('id', { count: 'exact', head: true }),
        supabase.from('members').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }).gte('date', new Date().toISOString().split('T')[0]),
      ]);

      setTotalSongs(songsRes.count || 0);
      setTotalMembers(membersRes.count || 0);
      setTotalEvents(eventsRes.count || 0);

      if (churchesRes.data) {
        const churchStats: ChurchStats[] = [];
        for (const church of churchesRes.data) {
          const { count } = await supabase
            .from('members')
            .select('id', { count: 'exact', head: true })
            .eq('church_id', church.id);

          churchStats.push({
            id: church.id,
            name: church.name,
            short_name: church.short_name,
            primary_color: church.primary_color,
            logo_url: church.logo_url || null,
            memberCount: count || 0,
          });
        }
        setChurches(churchStats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const statCards = [
    { label: 'Churches', value: churches.length, icon: Church, color: 'amber', route: '/super-admin/churches' },
    { label: 'Total Members', value: totalMembers, icon: Users, color: 'blue', route: '/super-admin/members' },
    { label: 'Songs', value: totalSongs, icon: Music, color: 'purple', route: '/super-admin/repertoire' },
    { label: 'Upcoming Events', value: totalEvents, icon: Calendar, color: 'green', route: '/super-admin/events' },
  ];

  const colorMap: Record<string, string> = {
    amber: 'bg-amber-100',
    blue: 'bg-blue-100',
    purple: 'bg-purple-100',
    green: 'bg-green-100',
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="bg-amber-100 p-2 rounded-lg">
          <Shield className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
          <p className="text-xs text-gray-600">Manage all churches and repertoire</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              onClick={() => navigate(stat.route)}
              className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-all text-left border border-gray-100"
            >
              <div className={`${colorMap[stat.color]} p-2 rounded-lg w-fit mb-2`}>
                <Icon className="w-5 h-5 text-gray-700" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-600">{stat.label}</p>
            </button>
          );
        })}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Church className="w-5 h-5" /> Churches
          </h2>
          <button
            onClick={() => navigate('/super-admin/churches/new')}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
          >
            <Plus className="w-4 h-4" /> Add Church
          </button>
        </div>

        <div className="space-y-2">
          {churches.map((church) => (
            <button
              key={church.id}
              onClick={() => navigate(`/super-admin/churches/${church.id}`)}
              className="w-full bg-white rounded-lg p-4 border border-gray-100 hover:shadow-md transition-all text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {church.logo_url ? (
                  <img src={church.logo_url} alt={church.short_name} className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: church.primary_color || '#6366f1' }}
                  >
                    {church.short_name.substring(0, 2)}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{church.name}</h3>
                  <p className="text-xs text-gray-500">{church.memberCount} members</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}

          {churches.length === 0 && (
            <div className="bg-white rounded-lg p-8 text-center border border-gray-100">
              <Church className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No churches yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
