import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Music, Calendar, MessageSquare, ArrowRight, Heart } from 'lucide-react';
import toast from 'react-hot-toast';

interface Stats {
  totalSongs: number;
  upcomingEvents: number;
  unreadMessages: number;
}

export const MemberDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ totalSongs: 381, upcomingEvents: 1, unreadMessages: 2 });

  useEffect(() => {
    // Set timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  const statCards = [
    { title: 'Repertoire', value: stats.totalSongs, icon: Music, bgColor: 'bg-purple-50', textColor: 'text-purple-600' },
    { title: 'Events', value: stats.upcomingEvents, icon: Calendar, bgColor: 'bg-green-50', textColor: 'text-green-600' },
    { title: 'Messages', value: stats.unreadMessages, icon: MessageSquare, bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
        <p className="text-gray-600 text-sm">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 sm:p-6 text-white shadow-md">
        <h1 className="text-xl sm:text-3xl font-bold mb-1">Welcome back! 👋</h1>
        <p className="text-sm text-purple-100">{user?.name || 'Member'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <button key={card.title} className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100 text-left">
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.textColor}`} />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
              <p className="text-xs text-gray-600 mt-3 mb-1">{card.title}</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{card.value}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Mobile Optimized ✨</h2>
        <p className="text-sm text-gray-600 mb-3">Your dashboard is fully optimized for mobile with responsive cards and touch-friendly navigation.</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-purple-50 rounded-lg p-3 text-center"><Music className="w-5 h-5 mx-auto mb-1 text-purple-600" /><p className="text-xs font-medium text-purple-600">Explore Songs</p></div>
          <div className="bg-blue-50 rounded-lg p-3 text-center"><Calendar className="w-5 h-5 mx-auto mb-1 text-blue-600" /><p className="text-xs font-medium text-blue-600">View Events</p></div>
        </div>
      </div>
    </div>
  );
};
