import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Music, Church, Users, Calendar, Settings, LogOut, Menu, X, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../styles/theme';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function SuperAdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { accent } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      setSidebarOpen(false);
      await logout();
      navigate('/login', { replace: true });
      toast.success('Logged out successfully');
    } catch (error: any) {
      console.error('Logout error:', error);
      toast.error(error?.message || 'Failed to logout');
    }
  };

  const navItems = [
    { path: '/super-admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/super-admin/churches', icon: Church, label: 'Churches' },
    { path: '/super-admin/repertoire', icon: Music, label: 'Repertoire' },
    { path: '/super-admin/members', icon: Users, label: 'All Members' },
    { path: '/super-admin/events', icon: Calendar, label: 'Global Events' },
    { path: '/super-admin/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: accent.primaryLight }}>
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)'
        }}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: accent.primary }}>
              ChoirHub
            </h1>
            <p className="text-xs flex items-center gap-1" style={{ color: accent.secondary }}>
              <Shield className="w-3 h-3" /> Super Admin
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors active:bg-gray-200"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 min-w-[256px] bg-white border-r border-gray-200 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="hidden lg:block p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold" style={{ color: accent.primary }}>
            ChoirHub
          </h1>
          <p className="text-sm mt-1 flex items-center gap-1" style={{ color: accent.secondary }}>
            <Shield className="w-4 h-4" /> Super Admin
          </p>
        </div>

        <div className="p-4 border-b border-gray-200" style={{ background: accent.primaryLight }}>
          <p className="text-sm font-medium text-gray-900">{user?.name || user?.email}</p>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full text-xs font-semibold"
            style={{ background: accent.primary, color: 'white' }}
          >
            <Shield className="w-3 h-3" /> Super Admin
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/super-admin' && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                  ${isActive
                    ? 'text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'}
                `}
                style={isActive ? { background: accent.gradient } : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 active:bg-red-100 w-full transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <main
        className="flex-1 w-full overflow-auto"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top) + 64px), 64px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="p-4 sm:p-6 lg:p-8 lg:pt-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
