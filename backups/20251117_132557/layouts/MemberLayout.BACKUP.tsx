import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Music, 
  Calendar, 
  MessageSquare, 
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Settings
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export const MemberLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/member', icon: LayoutDashboard },
    { name: 'Repertoire', href: '/member/repertoire', icon: Music },
    { name: 'Calendar', href: '/member/calendar', icon: Calendar },
    { name: 'Messages', href: '/member/messages', icon: MessageSquare },
  ];

  const isActive = (path: string) => {
    if (path === '/member') {
      return location.pathname === '/member';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between safe-top">
        <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          ChoirHub
        </h1>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors active:bg-gray-200"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          overflow-y-auto h-screen lg:h-auto
          safe-top safe-bottom safe-left
        `}>
          <div className="h-full flex flex-col">
            {/* Logo/Header - Desktop Only */}
            <div className="hidden lg:block p-6 border-b border-gray-200">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                EGMC ChoirHub
              </h1>
              <p className="text-sm text-gray-500 mt-1">Member Portal</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 lg:px-4 lg:py-6 space-y-1 overflow-y-auto">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-2.5 lg:py-3 rounded-lg transition-all active:scale-95 lg:active:scale-100
                      ${active
                        ? 'bg-purple-50 text-purple-700 font-medium shadow-sm'
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm lg:text-base">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Info & Logout */}
            <div className="p-3 lg:p-4 border-t border-gray-200 space-y-2">
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                  {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'M'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-gray-900 truncate">
                    {user?.name || user?.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-gray-500">{user?.voicePart || 'Member'}</p>
                </div>
              </div>

              {/* Profile Button - Hidden for now, could be added later */}
              {/* <button
                onClick={() => navigate('/member/profile')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 rounded-lg transition-all"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">Profile</span>
              </button> */}

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all font-medium"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {sidebarOpen && isMobile && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 w-full overflow-auto">
          <div className="w-full p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto safe-bottom">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Padding for Safe Area */}
      <div className="h-4 safe-bottom" />
    </div>
  );
};
