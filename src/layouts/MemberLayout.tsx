import React, { useState, useEffect } from 'react';
import { Music, Calendar, Mail, Mic, User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { OnlineIndicator } from '../components/OnlineIndicator';
import { GlobalSearch } from '../components/GlobalSearch';

interface MemberLayoutProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  children: React.ReactNode;
}

export const MemberLayout: React.FC<MemberLayoutProps> = ({ activeTab, onNavigate, children }) => {
  const { user, logout } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(3);
  const [upcomingEvents, setUpcomingEvents] = useState(2);

  useEffect(() => {
    const mockUnread = Math.floor(Math.random() * 5);
    const mockUpcoming = Math.floor(Math.random() * 4);
    setUnreadMessages(mockUnread);
    setUpcomingEvents(mockUpcoming);
  }, []);

  const tabs = [
    { id: 'repertoire', label: 'Repertoire', icon: Music, badge: null },
    { id: 'calendar', label: 'Calendar', icon: Calendar, badge: upcomingEvents },
    { id: 'messages', label: 'Messages', icon: Mail, badge: unreadMessages },
    { id: 'practice', label: 'Practice', icon: Mic, badge: null },
    { id: 'profile', label: 'Profile', icon: User, badge: null },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-shrink-0">
              <img src="/image.png" alt="EGMC Logo" className="w-12 h-12 object-contain" />
              <div>
                <h1 className="text-2xl font-bold text-blue-900">EGMC ChoirHub</h1>
                <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
              </div>
            </div>
            <div className="flex-1 max-w-md">
              <GlobalSearch onNavigate={(type, id) => console.log('Navigate to:', type, id)} />
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <OnlineIndicator />
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>

        <nav className="border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex gap-2 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth -webkit-overflow-scrolling-touch">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onNavigate(tab.id)}
                    className={`relative flex items-center justify-center gap-2 px-4 py-3 font-semibold transition-colors whitespace-nowrap border-b-2 flex-shrink-0 group ${
                      isActive
                        ? 'text-blue-900 border-blue-900'
                        : 'text-gray-600 border-transparent hover:text-blue-700'
                    }`}
                    title={tab.label}
                  >
                    <Icon className="w-5 h-5" />
                    <span className={`${
                      isActive ? 'inline' : 'hidden md:inline'
                    }`}>
                      {tab.label}
                    </span>
                    {tab.badge !== null && tab.badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};
