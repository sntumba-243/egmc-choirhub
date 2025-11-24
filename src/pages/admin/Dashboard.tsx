import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, Music, Calendar, MessageSquare, TrendingUp, TrendingDown, 
  Plus, Mail, AlertTriangle, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Stats {
  totalMembers: number;
  totalSongs: number;
  upcomingEvents: number;
  totalMessages: number;
  membersTrend: number;
  songsTrend: number;
  eventsTrend: number;
  messagesTrend: number;
}

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  rsvp_count?: number;
}

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    totalSongs: 0,
    upcomingEvents: 0,
    totalMessages: 0,
    membersTrend: 0,
    songsTrend: 0,
    eventsTrend: 0,
    messagesTrend: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState('Admin');

  useEffect(() => {
    fetchAllData();
  }, [user]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchAdminName(),
        fetchUpcomingEvents(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminName = async () => {
    try {
      if (user?.id) {
        const { data } = await supabase
          .from('members')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        if (data?.first_name) {
          setAdminName(data.first_name);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const [membersRes, songsRes, eventsRes, messagesRes] = await Promise.all([
        supabase.from('members').select('id, created_at'),
        supabase.from('songs').select('id, created_at'),
        supabase.from('events').select('id').gte('date', new Date().toISOString().split('T')[0]),
        supabase.from('messages').select('id, created_at')
      ]);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const membersTrend = membersRes.data?.filter(m => new Date(m.created_at) > sevenDaysAgo).length || 0;
      const songsTrend = songsRes.data?.filter(s => new Date(s.created_at) > sevenDaysAgo).length || 0;
      const messagesTrend = messagesRes.data?.filter(m => new Date(m.created_at) > sevenDaysAgo).length || 0;

      setStats({
        totalMembers: membersRes.data?.length || 0,
        totalSongs: songsRes.data?.length || 0,
        upcomingEvents: eventsRes.data?.length || 0,
        totalMessages: messagesRes.data?.length || 0,
        membersTrend,
        songsTrend,
        eventsTrend: 0,
        messagesTrend,
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      const { data } = await supabase
        .from('events')
        .select('*')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(3);

      setUpcomingEvents(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Members', 
      value: stats.totalMembers, 
      icon: Users, 
      trend: stats.membersTrend,
      color: 'blue',
      route: '/admin/members'
    },
    { 
      label: 'Songs', 
      value: stats.totalSongs, 
      icon: Music, 
      trend: stats.songsTrend,
      color: 'purple',
      route: '/admin/repertoire'
    },
    { 
      label: 'Events', 
      value: stats.upcomingEvents, 
      icon: Calendar, 
      trend: stats.eventsTrend,
      color: 'green',
      route: '/admin/events'
    },
    { 
      label: 'Messages', 
      value: stats.totalMessages, 
      icon: MessageSquare, 
      trend: stats.messagesTrend,
      color: 'orange',
      route: '/admin/messages'
    },
  ];

  const quickActions = [
    { label: 'New Song', icon: Music, color: 'indigo', route: '/admin/repertoire/new' },
    { label: 'New Event', icon: Calendar, color: 'green', route: '/admin/events/new' },
    { label: 'Message', icon: Mail, color: 'orange', route: '/admin/messages/new' },
    { label: 'New Member', icon: Plus, color: 'purple', route: '/admin/members/new' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      {/* Compact Header - Mobile Optimized */}
      <div className="flex items-center gap-3">
        <div className="bg-indigo-100 p-2 sm:p-3 rounded-lg">
          <Music className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-600">Welcome, {adminName}</p>
        </div>
      </div>

      {/* Quick Stats - Mobile: 2 columns, Desktop: 4 columns */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
          <span className="text-xl sm:text-2xl">📊</span> 
          <span>Quick Stats</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            const colorMap = {
              blue: 'bg-blue-100',
              purple: 'bg-purple-100',
              green: 'bg-green-100',
              orange: 'bg-orange-100'
            };
            
            return (
              <button
                key={stat.label}
                onClick={() => navigate(stat.route)}
                className="bg-white rounded-xl p-4 sm:p-5 lg:p-6 shadow-sm hover:shadow-md active:scale-95 transition-all text-left border border-gray-100"
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className={`${colorMap[stat.color as keyof typeof colorMap]} p-2 sm:p-3 rounded-lg`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
                  </div>
                  {stat.trend !== 0 && (
                    <div className={`flex items-center gap-1 text-xs sm:text-sm font-medium ${
                      stat.trend > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.trend > 0 ? <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" /> : <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />}
                      <span>{stat.trend > 0 ? '+' : ''}{stat.trend}</span>
                    </div>
                  )}
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
                <p className="text-xs sm:text-sm text-gray-600">{stat.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Actions - Mobile: 2x2 grid, Desktop: 4 columns */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
          <span className="text-xl sm:text-2xl">🎯</span> 
          <span>Quick Actions</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const colorMap = {
              indigo: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200 active:bg-indigo-200',
              green: 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200 active:bg-green-200',
              orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-200 active:bg-orange-200',
              purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200 active:bg-purple-200',
            };
            
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.route)}
                className={`${colorMap[action.color as keyof typeof colorMap]} rounded-xl p-4 sm:p-5 lg:p-6 border-2 transition-all flex flex-col items-center gap-2 sm:gap-3 font-medium text-sm sm:text-base min-h-[100px] sm:min-h-[120px]`}
              >
                <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                <span className="text-center">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upcoming Events */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
          <span className="text-xl sm:text-2xl">📅</span> 
          <span>Upcoming Events</span>
        </h2>
        <div className="space-y-3">
          {upcomingEvents.length === 0 ? (
            <div className="bg-white rounded-xl p-6 sm:p-8 text-center border border-gray-100">
              <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-sm sm:text-base text-gray-600">No upcoming events</p>
            </div>
          ) : (
            upcomingEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => navigate(`/admin/events/${event.id}`)}
                className="w-full bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md active:scale-98 transition-all text-left"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="bg-indigo-100 rounded-lg p-2 sm:p-3 text-center flex-shrink-0">
                    <div className="text-lg sm:text-2xl font-bold text-indigo-600">
                      {new Date(event.date + 'T00:00:00').getDate()}
                    </div>
                    <div className="text-xs text-indigo-600 uppercase">
                      {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{event.title}</h3>
                    <p className="text-xs sm:text-sm text-gray-600">{event.time}</p>
                    <p className="text-xs sm:text-sm text-gray-600">📍 {event.location}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Alerts - Mobile Optimized */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
          <span className="text-xl sm:text-2xl">🚨</span> 
          <span>Alerts (2)</span>
        </h2>
        <div className="space-y-3">
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-medium text-sm sm:text-base">Concert in 3 days - 5 members haven't RSVP'd</p>
                <button className="text-yellow-700 text-xs sm:text-sm font-medium hover:underline mt-1">
                  View Details →
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-medium text-sm sm:text-base">Sarah Johnson hasn't practiced this week</p>
                <button className="text-blue-700 text-xs sm:text-sm font-medium hover:underline mt-1">
                  Send Reminder →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
