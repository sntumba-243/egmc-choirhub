import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Calendar, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type Tab = 'overview' | 'favorites' | 'practice';

export const MemberDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  // Real counts from database
  const [songsCount, setSongsCount] = useState<number>(0);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [eventsCount, setEventsCount] = useState<number>(0);
  const [messagesCount, setMessagesCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCounts();
  }, [user]);

  const fetchCounts = async () => {
    try {
      // Fetch songs count
      const { count: songs } = await supabase
        .from('songs')
        .select('*', { count: 'exact', head: true });

      // Fetch user favorites count
      if (user?.id) {
        const { count: favorites } = await supabase
          .from('user_favorites')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        setFavoritesCount(favorites || 0);
      }
      setSongsCount(songs || 0);

      // Fetch upcoming events count (events with date >= today)
      const today = new Date().toISOString().split('T')[0];
      const { count: events } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte('date', today);
      setEventsCount(events || 0);

      // Fetch unread messages count
      if (user?.id) {
        const { data: messages } = await supabase
          .from('direct_messages')
          .select('id')
          .eq('recipient_id', user.id)
          .eq('is_read', false);
        setMessagesCount(messages?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching counts:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { label: 'Total Songs', value: loading ? '...' : songsCount.toString(), icon: Music, route: '/member/repertoire' },
    { label: 'Upcoming Events', value: loading ? '...' : eventsCount.toString(), icon: Calendar, route: '/member/calendar' },
    { label: 'Unread Messages', value: loading ? '...' : messagesCount.toString(), icon: MessageSquare, route: '/member/messages' },
  ];

  const favoriteSongs = [
    { id: '1', title: 'Amazing Grace', composer: 'John Newton', favorites: 45 },
    { id: '2', title: 'Hallelujah', composer: 'Leonard Cohen', favorites: 32 },

      {/* Your Stats Card */}
  ];

  return (
    <div className="space-y-4 pb-4">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 sm:p-6 text-white shadow-md">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Welcome back! 👋</h1>
        <p className="text-sm text-purple-100">{user?.name || 'Member'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button key={stat.label} onClick={() => navigate(stat.route)} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all text-left w-full">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5 text-purple-600" />
                <p className="text-xs text-gray-600">{stat.label}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </button>
          );
        })}
      </div>

      {/* Rest of your dashboard content... */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/member/repertoire')}
            className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Music className="w-6 h-6 text-purple-600 mb-2" />
            <p className="text-sm font-medium text-gray-900">Repertoire</p>
          </button>
          <button
            onClick={() => navigate('/member/calendar')}
            className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Calendar className="w-6 h-6 text-blue-600 mb-2" />
            <p className="text-sm font-medium text-gray-900">Calendar</p>
          </button>
        </div>
      </div>
    </div>
  );
};
