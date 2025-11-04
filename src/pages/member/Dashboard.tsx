import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Music, Calendar, MessageSquare, ArrowRight, Heart, Mic, Eye } from 'lucide-react';

type Tab = 'overview' | 'favorites' | 'practice';

export const MemberDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const stats = [
    { label: 'Total Songs', value: '381', icon: Music },
    { label: 'Upcoming Events', value: '1', icon: Calendar },
    { label: 'Unread Messages', value: '2', icon: MessageSquare },
  ];

  const favoriteSongs = [
    { id: '1', title: 'Amazing Grace', composer: 'John Newton', favorites: 45 },
    { id: '2', title: 'Hallelujah', composer: 'Leonard Cohen', favorites: 32 },
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
            <div key={stat.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5 text-purple-600" />
                <p className="text-xs text-gray-600">{stat.label}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {(['overview', 'favorites', 'practice'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Your choir dashboard overview with key stats and recent activity.</p>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-sm font-medium text-purple-700">381 songs</p>
                <p className="text-xs text-purple-600 mt-1">in your repertoire</p>
              </div>
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="space-y-3">
              {favoriteSongs.map((song) => (
                <div key={song.id} className="border border-gray-200 rounded-lg p-3">
                  <h3 className="font-semibold text-gray-900 text-sm">{song.title}</h3>
                  <p className="text-xs text-gray-600">{song.composer}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
                    <Heart className="w-3 h-3 fill-current" />
                    {song.favorites} favorites
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'practice' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Practice tips and resources to improve your singing skills.</p>
              <div className="bg-blue-50 rounded-lg p-3 flex items-start gap-2">
                <Mic className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-700">Warm-up exercises</p>
                  <p className="text-xs text-blue-600">5-10 minutes daily</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
