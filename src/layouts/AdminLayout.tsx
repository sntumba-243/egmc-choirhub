import { Link, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, Music, Users, Calendar, MessageSquare, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AdminLayout() {
  const location = useLocation();
  const { signOut } = useAuth();

  const navItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/repertoire', icon: Music, label: 'Repertoire' },
    { path: '/admin/members', icon: Users, label: 'Members' },
    { path: '/admin/events', icon: Calendar, label: 'Events' },
    { path: '/admin/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            EGMC EGMChoir hub
          </h1>
          <p className="text-sm text-gray-600 mt-1">Admin Panel</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={'flex items-center gap-3 px-4 py-3 rounded-lg transition-all ' +
                  (isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100')}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
