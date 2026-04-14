import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDbClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Church, Users, Music, Calendar, Shield, Plus, ArrowRight } from 'lucide-react';
import { useTheme } from '../../styles/theme';
import { StatCard } from '../../components/ui/StatCard';
import { PageCard } from '../../components/ui/PageCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';

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
  const { accent, tokens } = useTheme();
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
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_global', true).gte('date', new Date().toISOString().split('T')[0]),
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
    return <LoadingSkeleton variant="dashboard" />;
  }

  const statCards = [
    { label: 'Churches', value: churches.length, icon: Church, iconBg: accent.primaryLight, iconColor: accent.primary, route: '/super-admin/churches' },
    { label: 'Total Members', value: totalMembers, icon: Users, iconBg: '#DBEAFE', iconColor: '#2563EB', route: '/super-admin/members' },
    { label: 'Songs', value: totalSongs, icon: Music, iconBg: '#F3E8FF', iconColor: '#9333EA', route: '/super-admin/repertoire' },
    { label: 'Upcoming Events', value: totalEvents, icon: Calendar, iconBg: '#DCFCE7', iconColor: '#16A34A', route: '/super-admin/events' },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ background: accent.primaryLight }}>
          <Shield className="w-6 h-6" style={{ color: accent.primary }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
          <p className="text-xs text-gray-600">Manage all churches and repertoire</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            iconBg={stat.iconBg}
            iconColor={stat.iconColor}
            onClick={() => navigate(stat.route)}
          />
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Church className="w-5 h-5" /> Churches
          </h2>
          <button
            onClick={() => navigate('/super-admin/churches/new')}
            className="flex items-center gap-1 px-3 py-1.5 text-white rounded-lg text-sm font-medium hover:opacity-90"
            style={{ background: accent.primary }}
          >
            <Plus className="w-4 h-4" /> Add Church
          </button>
        </div>

        <div className="space-y-2">
          {churches.map((church) => (
            <PageCard
              key={church.id}
              as="button"
              onClick={() => navigate(`/super-admin/churches/${church.id}`)}
              className="hover:shadow-md transition-all flex items-center justify-between"
              style={{ padding: tokens.spacing.lg }}
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
            </PageCard>
          ))}

          {churches.length === 0 && (
            <EmptyState icon={Church} message="No churches yet" />
          )}
        </div>
      </div>
    </div>
  );
};
