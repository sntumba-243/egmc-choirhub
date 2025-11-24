import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Music, Calendar, MessageSquare, ChevronRight, Bell, Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalSongs: number;
  upcomingEvents: number;
  unreadMessages: number;
  favoriteSongs: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
}

export const MemberDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalSongs: 0,
    upcomingEvents: 0,
    unreadMessages: 0,
    favoriteSongs: 0
  });
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [memberName, setMemberName] = useState('Member');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      if (user?.email) {
        const { data: memberData } = await supabase
          .from('members')
          .select('first_name')
          .eq('email', user.email)
          .single();

        if (memberData?.first_name) {
          setMemberName(memberData.first_name);
        }
      }

      const [songsRes, eventsRes, messagesRes, favoritesRes] = await Promise.all([
        supabase.from('songs').select('id'),
        supabase.from('events').select('id, title, date, time, location').gte('date', new Date().toISOString().split('T')[0]).order('date', { ascending: true }).limit(3),
        supabase.from('messages').select('id').eq('send_to', 'all_members').eq('is_read', false),
        supabase.from('user_favorites').select('id').eq('user_id', user?.id || '')
      ]);

      setStats({
        totalSongs: songsRes.data?.length || 0,
        upcomingEvents: eventsRes.data?.length || 0,
        unreadMessages: messagesRes.data?.length || 0,
        favoriteSongs: favoritesRes.data?.length || 0
      });

      setUpcomingEvents(eventsRes.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-3"></div>
        <p className="text-gray-600 text-sm">Loading dashboard...</p>
      </div>
    );
  }

  const quickActions = [
    { title: 'Repertoire', description: `${stats.totalSongs} songs • ${stats.favoriteSongs} favorites`, icon: Music, color: 'from-purple-500 to-purple-600', bgColor: 'bg-purple-50', iconColor: 'text-purple-600', route: '/member/repertoire' },
    { title: 'Calendar', description: `${stats.upcomingEvents} upcoming events`, icon: Calendar, color: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-50', iconColor: 'text-blue-600', route: '/member/calendar' },
    { title: 'AI Practice', description: 'Smart assistant ready', icon: Lightbulb, color: 'from-green-500 to-green-600', bgColor: 'bg-green-50', iconColor: 'text-green-600', route: '/member/vocal-coach' },
    { title: 'Messages', description: stats.unreadMessages > 0 ? `${stats.unreadMessages} unread` : 'No new messages', icon: MessageSquare, color: 'from-orange-500 to-orange-600', bgColor: 'bg-orange-50', iconColor: 'text-orange-600', route: '/member/messages', badge: stats.unreadMessages > 0 ? stats.unreadMessages : undefined }
  ];

  return (
    <div className="space-y-6 pb-6">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Welcome back, {memberName}! 👋</h1>
        <p className="text-purple-100 text-sm sm:text-base">Ready to make beautiful music today?</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.title} onClick={() => navigate(action.route)} className="bg-white rounded-xl p-4 sm:p-5 shadow-md hover:shadow-lg transition-all border border-gray-100 text-left relative group">
              {action.badge !== undefined && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center">{action.badge}</span>}
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg ${action.bgColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}><Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${action.iconColor}`} /></div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-1">{action.title}</h3>
              <p className="text-xs sm:text-sm text-gray-600">{action.description}</p>
              <div className={`mt-3 h-1 bg-gradient-to-r ${action.color} rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left`}></div>
            </button>
          );
        })}
      </div>
      {upcomingEvents.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Bell className="w-5 h-5 text-purple-600" />Upcoming Events</h2>
            <button onClick={() => navigate('/member/calendar')} className="text-sm text-purple-600 hover:text-purple-700 font-medium">View All</button>
          </div>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <button key={event.id} onClick={() => navigate(`/member/events/${event.id}`)} className="w-full bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors text-left group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-purple-600 transition-colors">{event.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="font-medium text-purple-600">{formatEventDate(event.date)}</span>
                      {event.time && <><span>•</span><span>{event.time}</span></>}
                    </div>
                    {event.location && <p className="text-xs text-gray-500 mt-1 truncate">📍 {event.location}</p>}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
        <h2 className="text-xl font-bold mb-2">Practice Tools</h2>
        <p className="text-indigo-100 text-sm mb-4">Access vocal exercises and practice materials</p>
        <button onClick={() => navigate('/member/practice')} className="w-full bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg px-4 py-3 hover:bg-white/30 transition-all font-medium text-sm flex items-center justify-between">
          <span>Start Practice Session</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Your Stats</h2>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => navigate("/member/repertoire")} className="text-center p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors w-full">
            <div className="text-2xl font-bold text-purple-600">{stats.totalSongs}</div>
            <div className="text-xs text-gray-600 mt-1">Songs</div>
          </button>
          <button onClick={() => navigate("/member/repertoire")} className="text-center p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors w-full">
            <div className="text-2xl font-bold text-blue-600">{stats.favoriteSongs}</div>
            <div className="text-xs text-gray-600 mt-1">Favorites</div>
          </button>
        </div>
      </div>

    </div>
  );
};
