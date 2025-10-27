import React from 'react';
import { LayoutDashboard, Music, Users, Calendar, Mail, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GlobalSearch } from '../components/GlobalSearch';

interface AdminLayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ activePage, onNavigate, children }) => {
  const { user, logout } = useAuth();

  const pages = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'repertoire', label: 'Repertoire', icon: Music },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'messages', label: 'Messages', icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
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
              {pages.map((page) => {
                const Icon = page.icon;
                const isActive = activePage === page.id;
                return (
                  <button
                    key={page.id}
                    onClick={() => onNavigate(page.id)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 font-semibold transition-colors whitespace-nowrap border-b-2 flex-shrink-0 group ${
                      isActive
                        ? 'text-blue-900 border-blue-900'
                        : 'text-gray-600 border-transparent hover:text-blue-700'
                    }`}
                    title={page.label}
                  >
                    <Icon className="w-5 h-5" />
                    <span className={`${
                      isActive ? 'inline' : 'hidden md:inline'
                    }`}>
                      {page.label}
                    </span>
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
