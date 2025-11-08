import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, Music, Calendar, MessageSquare, TrendingUp, TrendingDown, 
  Plus, Mail, AlertTriangle, Info, Settings, Bell, LogOut
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

interface Activity {
  id: string;
  member_id: string;
  action: string;
  created_at: string;
}

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
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
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState('Admin');
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, [user]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchAdminName(),
        fetchUpcomingEvents(),
        fetchRecentActivity(),
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

  const fetchRecentActivity = async () => {
    try {
      const { data } = await supabase
        .from('practice_logs')
        .select('*, members(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentActivity(data || []);
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

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${Math.floor(diffHours / 24)} days ago`;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
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
      label: 'Total Members', 
      value: stats.totalMembers, 
      icon: Users, 
      trend: stats.membersTrend,
      color: 'blue',
      route: '/admin/members'
    },
    { 
      label: 'Songs in Repertoire', 
      value: stats.totalSongs, 
      icon: Music, 
      trend: stats.songsTrend,
      color: 'purple',
      route: '/admin/repertoire'
    },
    { 
      label: 'Upcoming Events', 
      value: stats.upcomingEvents, 
      icon: Calendar, 
      trend: stats.eventsTrend,
      color: 'green',
      route: '/admin/events'
    },
    { 
      label: 'Total Messages', 
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
    { label: 'Send Message', icon: Mail, color: 'orange', route: '/admin/messages/new' },
    { label: 'Add Member', icon: Plus, color: 'purple', route: '/admin/members/new' },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header with Admin Profile */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-100 p-3 rounded-lg">
            <Music className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-600">EGMC ChoirHub</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/events')} className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-6 h-6 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg"
            >
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                {adminName.charAt(0)}
              </div>
              <span className="font-medium">{adminName}</span>
            </button>
            
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-2 z-50">
                <button
                  onClick={() => navigate('/admin/settings')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-red-600"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="text-2xl">📊</span> Quick Stats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all text-left border border-gray-100"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`${colorMap[stat.color as keyof typeof colorMap]} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-gray-700" />
                  </div>
                  {stat.trend !== 0 && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${
                      stat.trend > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.trend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>{stat.trend > 0 ? '+' : ''}{stat.trend}</span>
                    </div>
                  )}
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Engagement This Week */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="text-2xl">📈</span> Engagement This Week
        </h2>
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 font-medium">Practice Hours</span>
              <span className="text-indigo-600 font-bold">65%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-indigo-600 h-3 rounded-full" style={{ width: '65%' }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 font-medium">Attendance Rate</span>
              <span className="text-green-600 font-bold">90%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-green-600 h-3 rounded-full" style={{ width: '90%' }}></div>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-700 font-medium">Messages Read</span>
              <span className="text-purple-600 font-bold">85%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-purple-600 h-3 rounded-full" style={{ width: '85%' }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">🎯</span> Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              const colorMap = {
                indigo: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200',
                green: 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200',
                orange: 'bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-200',
                purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200',
              };
              
              return (
                <button
                  key={action.label}
                  onClick={() => navigate(action.route)}
                  className={`${colorMap[action.color as keyof typeof colorMap]} rounded-xl p-6 border-2 transition-all flex items-center gap-3 font-medium`}
                >
                  <Icon className="w-6 h-6" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">🚨</span> Alerts (2)
          </h2>
          <div className="space-y-3">
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">Concert in 3 days - 5 members haven't RSVP'd</p>
                  <button className="text-yellow-700 text-sm font-medium hover:underline mt-1">
                    View Details →
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">Sarah Johnson hasn't practiced this week</p>
                  <button className="text-blue-700 text-sm font-medium hover:underline mt-1">
                    Send Reminder →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">📅</span> Upcoming Events
          </h2>
          <div className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No upcoming events</p>
              </div>
            ) : (
              upcomingEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => navigate(`/admin/events/${event.id}`)}
                  className="w-full bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-100 rounded-lg p-3 text-center flex-shrink-0">
                      <div className="text-2xl font-bold text-indigo-600">
                        {new Date(event.date).getDate()}
                      </div>
                      <div className="text-xs text-indigo-600 uppercase">
                        {formatDate(event.date).split(' ')[0]}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1">{event.title}</h3>
                      <p className="text-sm text-gray-600">{event.time}</p>
                      <p className="text-sm text-gray-600">📍 {event.location}</p>
                      {event.rsvp_count && (
                        <p className="text-sm text-green-600 font-medium mt-1">
                          {event.rsvp_count} RSVPs
                        </p>
                      )}
                    </div>
                    <button className="text-indigo-600 text-sm font-medium hover:underline">
                      View
                    </button>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">👥</span> Recent Activity
          </h2>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No recent activity</p>
              </div>
            ) : (
              recentActivity.map((activity: any) => {
                const colors = ['bg-blue-100', 'bg-green-100', 'bg-purple-100', 'bg-orange-100', 'bg-pink-100'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                
                return (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={`${randomColor} w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold`}>
                      {activity.members?.first_name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900">
                        <span className="font-semibold">
                          {activity.members?.first_name || 'User'}
                        </span>{' '}
                        practiced "{activity.song_title || 'a song'}"
                      </p>
                      <p className="text-sm text-gray-600">{formatTime(activity.created_at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
