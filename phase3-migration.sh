#!/bin/bash

echo "=== Phase 3: Super Admin UI ==="

# =============================================
# 3.1 Create Super Admin Layout
# =============================================

mkdir -p src/layouts
mkdir -p src/pages/super-admin

cat > src/layouts/SuperAdminLayout.tsx << 'SLEOF'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Music, Church, Users, Calendar, Settings, LogOut, Menu, X, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function SuperAdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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
            <h1 className="text-lg font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              ChoirHub
            </h1>
            <p className="text-xs text-gray-600 flex items-center gap-1">
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
          w-64 bg-white border-r border-gray-200 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="hidden lg:block p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            ChoirHub
          </h1>
          <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
            <Shield className="w-4 h-4" /> Super Admin
          </p>
        </div>

        <div className="p-4 border-b border-gray-200 bg-amber-50">
          <p className="text-sm font-medium text-gray-900">{user?.name || user?.email}</p>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full text-xs font-semibold bg-amber-200 text-amber-900">
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
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'}
                `}
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
SLEOF

echo "  [1/5] Created SuperAdminLayout.tsx"

# =============================================
# 3.2 Super Admin Dashboard
# =============================================

cat > src/pages/super-admin/Dashboard.tsx << 'SDEOF'
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDbClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Church, Users, Music, Calendar, Shield, Plus, ArrowRight } from 'lucide-react';

interface ChurchStats {
  id: string;
  name: string;
  short_name: string;
  primary_color: string;
  memberCount: number;
}

export const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [churches, setChurches] = useState<ChurchStats[]>([]);
  const [totalSongs, setTotalSongs] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const supabase = getDbClient();

      const [churchesRes, songsRes, membersRes, eventsRes] = await Promise.all([
        supabase.from('churches').select('*').eq('is_active', true),
        supabase.from('songs').select('id', { count: 'exact', head: true }),
        supabase.from('members').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }).gte('date', new Date().toISOString().split('T')[0]),
      ]);

      setTotalSongs(songsRes.count || 0);
      setTotalMembers(membersRes.count || 0);
      setTotalEvents(eventsRes.count || 0);

      if (churchesRes.data) {
        const churchStats: ChurchStats[] = [];
        for (const church of churchesRes.data) {
          const { count } = await supabase
            .from('members')
            .select('id', { count: 'exact', head: true })
            .eq('church_id', church.id);

          churchStats.push({
            id: church.id,
            name: church.name,
            short_name: church.short_name,
            primary_color: church.primary_color,
            memberCount: count || 0,
          });
        }
        setChurches(churchStats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const statCards = [
    { label: 'Churches', value: churches.length, icon: Church, color: 'amber', route: '/super-admin/churches' },
    { label: 'Total Members', value: totalMembers, icon: Users, color: 'blue', route: '/super-admin/members' },
    { label: 'Songs', value: totalSongs, icon: Music, color: 'purple', route: '/super-admin/repertoire' },
    { label: 'Upcoming Events', value: totalEvents, icon: Calendar, color: 'green', route: '/super-admin/events' },
  ];

  const colorMap: Record<string, string> = {
    amber: 'bg-amber-100',
    blue: 'bg-blue-100',
    purple: 'bg-purple-100',
    green: 'bg-green-100',
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="bg-amber-100 p-2 rounded-lg">
          <Shield className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>
          <p className="text-xs text-gray-600">Manage all churches and repertoire</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              onClick={() => navigate(stat.route)}
              className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-all text-left border border-gray-100"
            >
              <div className={`${colorMap[stat.color]} p-2 rounded-lg w-fit mb-2`}>
                <Icon className="w-5 h-5 text-gray-700" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-600">{stat.label}</p>
            </button>
          );
        })}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Church className="w-5 h-5" /> Churches
          </h2>
          <button
            onClick={() => navigate('/super-admin/churches/new')}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
          >
            <Plus className="w-4 h-4" /> Add Church
          </button>
        </div>

        <div className="space-y-2">
          {churches.map((church) => (
            <button
              key={church.id}
              onClick={() => navigate(`/super-admin/churches/${church.id}`)}
              className="w-full bg-white rounded-lg p-4 border border-gray-100 hover:shadow-md transition-all text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: church.primary_color }}
                >
                  {church.short_name.substring(0, 2)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{church.name}</h3>
                  <p className="text-xs text-gray-500">{church.memberCount} members</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}

          {churches.length === 0 && (
            <div className="bg-white rounded-lg p-8 text-center border border-gray-100">
              <Church className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No churches yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
SDEOF

echo "  [2/5] Created SuperAdmin Dashboard"

# =============================================
# 3.3 Church Management Page (List + Create)
# =============================================

cat > src/pages/super-admin/Churches.tsx << 'CHEOF'
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDbClient } from '../../lib/supabase';
import { Church, Plus, Search, Users, Edit, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface ChurchData {
  id: string;
  name: string;
  short_name: string;
  primary_color: string;
  city: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
  memberCount?: number;
}

export const Churches = () => {
  const navigate = useNavigate();
  const [churches, setChurches] = useState<ChurchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchChurches();
  }, []);

  const fetchChurches = async () => {
    try {
      const supabase = getDbClient();
      const { data, error } = await supabase
        .from('churches')
        .select('*')
        .order('name');

      if (error) throw error;

      const churchesWithCounts: ChurchData[] = [];
      for (const church of data || []) {
        const { count } = await supabase
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('church_id', church.id);

        churchesWithCounts.push({ ...church, memberCount: count || 0 });
      }

      setChurches(churchesWithCounts);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load churches');
    } finally {
      setLoading(false);
    }
  };

  const filtered = churches.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.short_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2 rounded-lg">
            <Church className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Churches</h1>
            <p className="text-xs text-gray-600">{churches.length} registered</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/super-admin/churches/new')}
          className="flex items-center gap-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
        >
          <Plus className="w-4 h-4" /> Add Church
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search churches..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((church) => (
          <button
            key={church.id}
            onClick={() => navigate(`/super-admin/churches/${church.id}`)}
            className="w-full bg-white rounded-lg p-4 border border-gray-100 hover:shadow-md transition-all text-left flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: church.primary_color }}
              >
                {church.short_name.substring(0, 2)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{church.name}</h3>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" /> {church.memberCount} members
                  </span>
                  {church.city && (
                    <span className="text-xs text-gray-500">{church.city}{church.country ? `, ${church.country}` : ''}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${church.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {church.is_active ? 'Active' : 'Inactive'}
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="bg-white rounded-lg p-8 text-center border border-gray-100">
            <Church className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">{searchTerm ? 'No churches match your search' : 'No churches yet'}</p>
          </div>
        )}
      </div>
    </div>
  );
};
CHEOF

echo "  [3/5] Created Churches list page"

# =============================================
# 3.4 Church Form (Create/Edit)
# =============================================

cat > src/pages/super-admin/ChurchForm.tsx << 'CFEOF'
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDbClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Church, ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export const ChurchForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    short_name: '',
    primary_color: '#1e40af',
    secondary_color: '#3b82f6',
    accent_color: '#f59e0b',
    address: '',
    city: '',
    country: '',
    pastor_name: '',
    contact_email: '',
    contact_phone: '',
  });

  useEffect(() => {
    if (isEdit) fetchChurch();
  }, [id]);

  const fetchChurch = async () => {
    setLoading(true);
    try {
      const supabase = getDbClient();
      const { data, error } = await supabase
        .from('churches')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setForm({
          name: data.name || '',
          short_name: data.short_name || '',
          primary_color: data.primary_color || '#1e40af',
          secondary_color: data.secondary_color || '#3b82f6',
          accent_color: data.accent_color || '#f59e0b',
          address: data.address || '',
          city: data.city || '',
          country: data.country || '',
          pastor_name: data.pastor_name || '',
          contact_email: data.contact_email || '',
          contact_phone: data.contact_phone || '',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load church');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.short_name) {
      toast.error('Name and short name are required');
      return;
    }

    setSaving(true);
    try {
      const supabase = getDbClient();

      if (isEdit) {
        const { error } = await supabase
          .from('churches')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        toast.success('Church updated!');
      } else {
        const { error } = await supabase
          .from('churches')
          .insert([{ ...form, created_by: user?.id }]);
        if (error) throw error;
        toast.success('Church created!');
      }

      navigate('/super-admin/churches');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to save church');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <button
        onClick={() => navigate('/super-admin/churches')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Churches
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="bg-amber-100 p-2 rounded-lg">
          <Church className="w-6 h-6 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Church' : 'Add New Church'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Church Name *</label>
            <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Short Name *</label>
            <input type="text" value={form.short_name} onChange={(e) => handleChange('short_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" required maxLength={10} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pastor / Leader Name</label>
          <input type="text" value={form.pastor_name} onChange={(e) => handleChange('pastor_name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
            <input type="email" value={form.contact_email} onChange={(e) => handleChange('contact_email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
            <input type="tel" value={form.contact_phone} onChange={(e) => handleChange('contact_phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input type="text" value={form.address} onChange={(e) => handleChange('address', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input type="text" value={form.city} onChange={(e) => handleChange('city', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input type="text" value={form.country} onChange={(e) => handleChange('country', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Theme Colors</label>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Primary</label>
              <input type="color" value={form.primary_color} onChange={(e) => handleChange('primary_color', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Secondary</label>
              <input type="color" value={form.secondary_color} onChange={(e) => handleChange('secondary_color', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Accent</label>
              <input type="color" value={form.accent_color} onChange={(e) => handleChange('accent_color', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0" />
            </div>
            <div className="w-20 h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})` }} />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:bg-gray-400">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : isEdit ? 'Update Church' : 'Create Church'}
          </button>
          <button type="button" onClick={() => navigate('/super-admin/churches')}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
CFEOF

echo "  [4/5] Created ChurchForm page"

# =============================================
# 3.5 Church Detail Page
# =============================================

cat > src/pages/super-admin/ChurchDetail.tsx << 'CDEOF'
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDbClient } from '../../lib/supabase';
import { Church, Users, Music, Calendar, ArrowLeft, Edit, Shield, ShieldOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface ChurchData {
  id: string;
  name: string;
  short_name: string;
  primary_color: string;
  secondary_color: string;
  city: string | null;
  country: string | null;
  pastor_name: string | null;
  contact_email: string | null;
}

interface MemberData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  voice_part: string;
  is_super_admin?: boolean;
}

export const ChurchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [church, setChurch] = useState<ChurchData | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [stats, setStats] = useState({ members: 0, events: 0, songsLearned: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  const fetchAll = async () => {
    try {
      const supabase = getDbClient();

      const [churchRes, membersRes, eventsRes, songStatusRes] = await Promise.all([
        supabase.from('churches').select('*').eq('id', id).single(),
        supabase.from('members').select('id, first_name, last_name, email, role, voice_part').eq('church_id', id).order('first_name'),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('church_id', id),
        supabase.from('church_song_status').select('status').eq('church_id', id),
      ]);

      if (churchRes.error) throw churchRes.error;
      setChurch(churchRes.data);
      setMembers(membersRes.data || []);

      const learned = (songStatusRes.data || []).filter(s => s.status === 'learned').length;
      setStats({
        members: membersRes.data?.length || 0,
        events: eventsRes.count || 0,
        songsLearned: learned,
      });

      // Check super admin status for each member
      if (membersRes.data) {
        const userIds = membersRes.data.map(m => m.id);
        const { data: usersData } = await supabase
          .from('users')
          .select('id, is_super_admin')
          .in('id', userIds);

        if (usersData) {
          const superAdminMap = new Map(usersData.map(u => [u.id, u.is_super_admin]));
          setMembers(membersRes.data.map(m => ({ ...m, is_super_admin: superAdminMap.get(m.id) || false })));
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load church');
    } finally {
      setLoading(false);
    }
  };

  const toggleSuperAdmin = async (memberId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'remove super admin from' : 'make super admin';
    if (!confirm(`Are you sure you want to ${action} this member?`)) return;

    try {
      const supabase = getDbClient();
      const { error } = await supabase
        .from('users')
        .update({ is_super_admin: !currentStatus })
        .eq('id', memberId);

      if (error) throw error;
      toast.success(currentStatus ? 'Super admin removed' : 'Super admin granted');
      fetchAll();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!church) return <p>Church not found</p>;

  return (
    <div className="space-y-6 pb-8">
      <button onClick={() => navigate('/super-admin/churches')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Churches
      </button>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ background: `linear-gradient(135deg, ${church.primary_color}, ${church.secondary_color})` }}>
              {church.short_name.substring(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{church.name}</h1>
              <p className="text-sm text-gray-500">
                {church.city}{church.country ? `, ${church.country}` : ''}
                {church.pastor_name ? ` • Pastor: ${church.pastor_name}` : ''}
              </p>
            </div>
          </div>
          <button onClick={() => navigate(`/super-admin/churches/${id}/edit`)}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <Edit className="w-4 h-4" /> Edit
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.members}</p>
            <p className="text-xs text-gray-600">Members</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <Calendar className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.events}</p>
            <p className="text-xs text-gray-600">Events</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <Music className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.songsLearned}</p>
            <p className="text-xs text-gray-600">Songs Learned</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" /> Members ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
              <div>
                <p className="font-medium text-sm">
                  {member.first_name} {member.last_name}
                  {member.is_super_admin && (
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">
                      <Shield className="w-3 h-3" /> Super Admin
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">{member.email} • {member.voice_part || 'No part'} • {member.role}</p>
              </div>
              <button
                onClick={() => toggleSuperAdmin(member.id, member.is_super_admin || false)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                  member.is_super_admin
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-amber-600 hover:bg-amber-50'
                }`}
                title={member.is_super_admin ? 'Remove super admin' : 'Make super admin'}
              >
                {member.is_super_admin ? <ShieldOff className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                {member.is_super_admin ? 'Remove SA' : 'Make SA'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
CDEOF

echo "  [5/5] Created ChurchDetail page"

echo ""
echo "=== Phase 3 Files Created ==="
echo ""
echo "Now updating App.tsx with super-admin routes..."
echo "This requires a manual step - see instructions below."
echo ""
echo "=== MANUAL STEP ==="
echo "Add these imports to the TOP of src/App.tsx:"
echo ""
echo "  import SuperAdminLayout from './layouts/SuperAdminLayout';"
echo "  import { SuperAdminDashboard } from './pages/super-admin/Dashboard';"
echo "  import { Churches } from './pages/super-admin/Churches';"
echo "  import { ChurchForm } from './pages/super-admin/ChurchForm';"
echo "  import { ChurchDetail } from './pages/super-admin/ChurchDetail';"
echo ""
echo "Then add these routes INSIDE AppRoutes, BEFORE the Member Routes:"
echo ""
echo '  {/* Super Admin Routes */}'
echo '  <Route path="/super-admin" element={'
echo '    <ProtectedRoute requiredRole="super_admin">'
echo '      <SuperAdminLayout />'
echo '    </ProtectedRoute>'
echo '  }>'
echo '    <Route index element={<SuperAdminDashboard />} />'
echo '    <Route path="churches" element={<Churches />} />'
echo '    <Route path="churches/new" element={<ChurchForm />} />'
echo '    <Route path="churches/:id" element={<ChurchDetail />} />'
echo '    <Route path="churches/:id/edit" element={<ChurchForm />} />'
echo '    <Route path="repertoire" element={<AdminRepertoire />} />'
echo '    <Route path="repertoire/new" element={<SongForm />} />'
echo '    <Route path="repertoire/:id/edit" element={<SongForm />} />'
echo '    <Route path="members" element={<AdminMembers />} />'
echo '    <Route path="events" element={<AdminEvents />} />'
echo '    <Route path="events/new" element={<EventForm />} />'
echo '    <Route path="settings" element={<AdminSettings />} />'
echo '  </Route>'
echo ""
echo "Then: git add -A && git commit -m 'feat: Phase 3 super admin UI' && git push"
