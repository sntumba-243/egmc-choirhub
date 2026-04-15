import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, LayoutDashboard, Music, LibraryBig, Users, Calendar, MessageSquare, Mic, Settings, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useChurch } from '../contexts/ChurchContext';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { church } = useChurch();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [location]);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
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
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/repertoire', icon: Music, label: 'Repertoire' },
    { path: '/admin/church-songs', icon: LibraryBig, label: 'Church Songs' },
    { path: '/admin/members', icon: Users, label: 'Members' },
    { path: '/admin/events', icon: Calendar, label: 'Events' },
    { path: '/admin/attendance', icon: BarChart3, label: 'Attendance' },
    { path: '/admin/messages', icon: MessageSquare, label: 'Messages' },
    { path: '/admin/vocal-coach/assignments', icon: Mic, label: 'Vocal Coach' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const churchName = church?.short_name || church?.name || 'ChoirOS';
  const logoUrl = church?.logo_url;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Header */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 12px)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)'
        }}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={churchName} className="h-8 max-h-[32px] rounded-lg object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg theme-gradient flex items-center justify-center">
                <Music className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold theme-text">{churchName}</h1>
              <p className="text-xs text-gray-600">Admin Panel</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors active:bg-gray-200"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 min-w-[256px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Desktop Header */}
        <div className="hidden lg:block p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={churchName} className="h-10 max-h-[40px] rounded-lg object-contain" />
            ) : (
              <div className="w-10 h-10 rounded-lg theme-gradient flex items-center justify-center flex-shrink-0">
                <Music className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold theme-text truncate">{churchName}</h1>
              <p className="text-sm text-gray-600">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Mobile User Info */}
        <div className="lg:hidden p-4 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-medium text-gray-900">{user?.email}</p>
          <p className="text-xs text-gray-600 mt-1">Administrator</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'theme-active' : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 active:bg-red-100 w-full transition-colors">
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto" style={{ paddingTop: 'max(calc(env(safe-area-inset-top) + 64px), 64px)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
        <div className="p-4 sm:p-6 lg:p-8 lg:pt-0">
          <Outlet />
        </div>
      </main>

      <style>{`
        @supports (padding-top: env(safe-area-inset-top)) {
          body { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
        }
      `}</style>
    </div>
  );
}
