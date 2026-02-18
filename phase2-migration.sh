#!/bin/bash

echo "=== Phase 2: Auth & Context Updates ==="

# =============================================
# 2.1 Update NeonUser interface to include church fields
# =============================================

cat > src/lib/neonAuth.ts << 'NEOF'
export interface NeonUser {
  id: string;
  email: string;
  name: string;
  role: string;
  voice_part: string | null;
  church_id: string;
  is_super_admin: boolean;
  force_password_change?: boolean;
}

interface Session {
  user: NeonUser;
  expiresAt: number;
}

const SESSION_KEY = 'neon_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000;
const API_URL = 'http://localhost:3001/api';

export const neonAuth = {
  async login(email: string, password: string): Promise<{ user: NeonUser | null; error: string | null }> {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        return { user: null, error: data.error || 'Login failed' };
      }

      const user = data.user as NeonUser;

      const session: Session = {
        user,
        expiresAt: Date.now() + SESSION_DURATION
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));

      return { user, error: null };
    } catch (error: any) {
      console.error('Login error:', error);
      return { user: null, error: error.message };
    }
  },

  getSession(): { user: NeonUser | null } {
    try {
      const sessionStr = localStorage.getItem(SESSION_KEY);
      if (!sessionStr) {
        return { user: null };
      }

      const session: Session = JSON.parse(sessionStr);

      if (Date.now() > session.expiresAt) {
        localStorage.removeItem(SESSION_KEY);
        return { user: null };
      }

      return { user: session.user };
    } catch (error) {
      console.error('Session error:', error);
      return { user: null };
    }
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  isAuthenticated(): boolean {
    const { user } = this.getSession();
    return user !== null;
  }
};
NEOF

echo "  [1/6] Updated neonAuth.ts"

# =============================================
# 2.2 Create ChurchContext
# =============================================

cat > src/contexts/ChurchContext.tsx << 'CEOF'
import { createContext, useContext, useEffect, useState } from 'react';
import { getDbClient } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface Church {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  address: string | null;
  city: string | null;
  country: string | null;
  pastor_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
}

interface ChurchContextType {
  church: Church | null;
  churches: Church[];
  loading: boolean;
  refreshChurch: () => Promise<void>;
  loadAllChurches: () => Promise<void>;
}

const ChurchContext = createContext<ChurchContextType | undefined>(undefined);

export const ChurchProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [church, setChurch] = useState<Church | null>(null);
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.church_id) {
      loadChurch(user.church_id);
    } else {
      setChurch(null);
      setLoading(false);
    }
  }, [user?.church_id]);

  useEffect(() => {
    if (church) {
      applyTheme(church);
    }
  }, [church]);

  const loadChurch = async (churchId: string) => {
    try {
      const supabase = getDbClient();
      const { data, error } = await supabase
        .from('churches')
        .select('*')
        .eq('id', churchId)
        .single();

      if (error) throw error;
      setChurch(data);
    } catch (error) {
      console.error('Error loading church:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshChurch = async () => {
    if (user?.church_id) {
      await loadChurch(user.church_id);
    }
  };

  const loadAllChurches = async () => {
    try {
      const supabase = getDbClient();
      const { data, error } = await supabase
        .from('churches')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setChurches(data || []);
    } catch (error) {
      console.error('Error loading churches:', error);
    }
  };

  const applyTheme = (church: Church) => {
    const root = document.documentElement;
    root.style.setProperty('--church-primary', church.primary_color);
    root.style.setProperty('--church-secondary', church.secondary_color);
    root.style.setProperty('--church-accent', church.accent_color);
  };

  return (
    <ChurchContext.Provider value={{ church, churches, loading, refreshChurch, loadAllChurches }}>
      {children}
    </ChurchContext.Provider>
  );
};

export const useChurch = () => {
  const context = useContext(ChurchContext);
  if (!context) {
    throw new Error('useChurch must be used within ChurchProvider');
  }
  return context;
};
CEOF

echo "  [2/6] Created ChurchContext.tsx"

# =============================================
# 2.3 Update AuthContext
# =============================================

cat > src/contexts/AuthContext.tsx << 'AEOF'
import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDbClient } from '../lib/supabase';
import { neonAuth, NeonUser } from '../lib/neonAuth';
import { autoFailover } from '../lib/autoFailover';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: NeonUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<NeonUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const useNeon = import.meta.env.VITE_USE_NEON === 'true' || autoFailover.isUsingNeon();

  useEffect(() => {
    checkUser();

    const handleFailover = () => {
      console.log('Failover detected, rechecking user...');
      checkUser();
    };

    window.addEventListener('database-failover', handleFailover);
    return () => window.removeEventListener('database-failover', handleFailover);
  }, []);

  const checkUser = async () => {
    try {
      if (useNeon) {
        const { user } = neonAuth.getSession();
        setUser(user);
      } else {
        const supabase = getDbClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: memberData } = await supabase
            .from('members')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (memberData) {
            const { data: userData } = await supabase
              .from('users')
              .select('is_super_admin')
              .eq('id', session.user.id)
              .single();

            setUser({
              id: memberData.id,
              email: memberData.email,
              name: memberData.first_name ? `${memberData.first_name} ${memberData.last_name || ''}`.trim() : memberData.email,
              role: memberData.role,
              voice_part: memberData.voice_part,
              church_id: memberData.church_id,
              is_super_admin: userData?.is_super_admin || false,
              force_password_change: memberData.must_change_password || false,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRedirectPath = (user: NeonUser): string => {
    if (user.is_super_admin) return '/super-admin';
    if (user.role === 'admin') return '/admin';
    return '/member';
  };

  const login = async (email: string, password: string) => {
    try {
      if (useNeon) {
        const { user, error } = await neonAuth.login(email, password);
        if (error) throw new Error(error);
        if (user) {
          setUser(user);
          toast.success('Login successful!');
          navigate(getRedirectPath(user));
        }
      } else {
        const supabase = getDbClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          const { data: memberData } = await supabase
            .from('members')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (memberData) {
            const { data: userData } = await supabase
              .from('users')
              .select('is_super_admin')
              .eq('id', data.user.id)
              .single();

            const loggedInUser: NeonUser = {
              id: memberData.id,
              email: memberData.email,
              name: memberData.first_name ? `${memberData.first_name} ${memberData.last_name || ''}`.trim() : memberData.email,
              role: memberData.role,
              voice_part: memberData.voice_part,
              church_id: memberData.church_id,
              is_super_admin: userData?.is_super_admin || false,
              force_password_change: memberData.must_change_password || false,
            };

            setUser(loggedInUser);
            toast.success('Login successful!');
            navigate(getRedirectPath(loggedInUser));
          }
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed');
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (useNeon) {
        neonAuth.logout();
      } else {
        const supabase = getDbClient();
        await supabase.auth.signOut();
      }

      setUser(null);
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
AEOF

echo "  [3/6] Updated AuthContext.tsx"

# =============================================
# 2.4 Update ProtectedRoute to handle 3 roles
# =============================================

cat > src/components/ProtectedRoute.tsx << 'PEOF'
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'member' | 'admin' | 'super_admin';
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requiredRole, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.force_password_change && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (requiredRole === 'super_admin') {
    if (!user.is_super_admin) {
      if (user.role === 'admin') return <Navigate to="/admin" replace />;
      return <Navigate to="/member" replace />;
    }
  }

  if (requiredRole === 'admin' || requireAdmin) {
    if (user.role !== 'admin' && !user.is_super_admin) {
      return <Navigate to="/member" replace />;
    }
  }

  if (requiredRole === 'member') {
    // All roles can access member pages
  }

  return <>{children}</>;
};
PEOF

echo "  [4/6] Updated ProtectedRoute.tsx"

# =============================================
# 2.5 Create church service
# =============================================

cat > src/lib/churchService.ts << 'CSEOF'
import { getDbClient } from './supabase';

export interface Church {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  address: string | null;
  city: string | null;
  country: string | null;
  pastor_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChurchSongStatus {
  id: string;
  church_id: string;
  song_id: string;
  status: 'learned' | 'learning' | 'not_started';
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const churchService = {
  async getChurches(): Promise<Church[]> {
    const supabase = getDbClient();
    const { data, error } = await supabase
      .from('churches')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getChurch(id: string): Promise<Church | null> {
    const supabase = getDbClient();
    const { data, error } = await supabase
      .from('churches')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createChurch(church: Partial<Church>): Promise<Church> {
    const supabase = getDbClient();
    const { data, error } = await supabase
      .from('churches')
      .insert([church])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateChurch(id: string, church: Partial<Church>): Promise<void> {
    const supabase = getDbClient();
    const { error } = await supabase
      .from('churches')
      .update({ ...church, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteChurch(id: string): Promise<void> {
    const supabase = getDbClient();
    const { error } = await supabase
      .from('churches')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  async getChurchMembers(churchId: string) {
    const supabase = getDbClient();
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('church_id', churchId)
      .order('first_name');

    if (error) throw error;
    return data || [];
  },

  async getChurchStats(churchId: string) {
    const supabase = getDbClient();
    const [members, events, songStatuses] = await Promise.all([
      supabase.from('members').select('id', { count: 'exact' }).eq('church_id', churchId),
      supabase.from('events').select('id', { count: 'exact' }).eq('church_id', churchId),
      supabase.from('church_song_status').select('status').eq('church_id', churchId),
    ]);

    const statuses = songStatuses.data || [];
    return {
      totalMembers: members.count || 0,
      totalEvents: events.count || 0,
      songsLearned: statuses.filter(s => s.status === 'learned').length,
      songsLearning: statuses.filter(s => s.status === 'learning').length,
      songsNotStarted: statuses.filter(s => s.status === 'not_started').length,
    };
  },

  async setSuperAdmin(userId: string, isSuperAdmin: boolean): Promise<void> {
    const supabase = getDbClient();
    const { error } = await supabase
      .from('users')
      .update({ is_super_admin: isSuperAdmin })
      .eq('id', userId);

    if (error) throw error;
  },
};

export const churchSongStatusService = {
  async getStatuses(churchId: string): Promise<ChurchSongStatus[]> {
    const supabase = getDbClient();
    const { data, error } = await supabase
      .from('church_song_status')
      .select('*')
      .eq('church_id', churchId);

    if (error) throw error;
    return data || [];
  },

  async getStatus(churchId: string, songId: string): Promise<ChurchSongStatus | null> {
    const supabase = getDbClient();
    const { data, error } = await supabase
      .from('church_song_status')
      .select('*')
      .eq('church_id', churchId)
      .eq('song_id', songId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async setStatus(churchId: string, songId: string, status: string, userId: string, notes?: string): Promise<void> {
    const supabase = getDbClient();
    const { error } = await supabase
      .from('church_song_status')
      .upsert([{
        church_id: churchId,
        song_id: songId,
        status,
        updated_by: userId,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'church_id,song_id' });

    if (error) throw error;
  },

  async bulkSetStatus(churchId: string, songIds: string[], status: string, userId: string): Promise<void> {
    const supabase = getDbClient();
    const records = songIds.map(songId => ({
      church_id: churchId,
      song_id: songId,
      status,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('church_song_status')
      .upsert(records, { onConflict: 'church_id,song_id' });

    if (error) throw error;
  },
};
CSEOF

echo "  [5/6] Created churchService.ts"

# =============================================
# 2.6 Update App.tsx to include ChurchProvider and super admin routes
# =============================================

cat > src/contexts/ChurchContext.tsx << 'CEOF2'
import { createContext, useContext, useEffect, useState } from 'react';
import { getDbClient } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface Church {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  address: string | null;
  city: string | null;
  country: string | null;
  pastor_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
}

interface ChurchContextType {
  church: Church | null;
  churches: Church[];
  loading: boolean;
  refreshChurch: () => Promise<void>;
  loadAllChurches: () => Promise<void>;
}

const ChurchContext = createContext<ChurchContextType | undefined>(undefined);

export const ChurchProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [church, setChurch] = useState<Church | null>(null);
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.church_id) {
      loadChurch(user.church_id);
    } else {
      setChurch(null);
      setLoading(false);
    }
  }, [user?.church_id]);

  useEffect(() => {
    if (church) {
      applyTheme(church);
    }
  }, [church]);

  const loadChurch = async (churchId: string) => {
    try {
      const supabase = getDbClient();
      const { data, error } = await supabase
        .from('churches')
        .select('*')
        .eq('id', churchId)
        .single();

      if (error) throw error;
      setChurch(data);
    } catch (error) {
      console.error('Error loading church:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshChurch = async () => {
    if (user?.church_id) {
      await loadChurch(user.church_id);
    }
  };

  const loadAllChurches = async () => {
    try {
      const supabase = getDbClient();
      const { data, error } = await supabase
        .from('churches')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setChurches(data || []);
    } catch (error) {
      console.error('Error loading churches:', error);
    }
  };

  const applyTheme = (church: Church) => {
    const root = document.documentElement;
    root.style.setProperty('--church-primary', church.primary_color);
    root.style.setProperty('--church-secondary', church.secondary_color);
    root.style.setProperty('--church-accent', church.accent_color);
  };

  return (
    <ChurchContext.Provider value={{ church, churches, loading, refreshChurch, loadAllChurches }}>
      {children}
    </ChurchContext.Provider>
  );
};

export const useChurch = () => {
  const context = useContext(ChurchContext);
  if (!context) {
    throw new Error('useChurch must be used within ChurchProvider');
  }
  return context;
};
CEOF2

echo "  [6/6] Created ChurchContext.tsx (final)"

echo ""
echo "=== Phase 2 Complete ==="
echo ""
echo "Files updated:"
echo "  - src/lib/neonAuth.ts (added church_id, is_super_admin to NeonUser)"
echo "  - src/contexts/AuthContext.tsx (fetches church_id + is_super_admin, routes super admin)"
echo "  - src/contexts/ChurchContext.tsx (NEW - church theme + data)"
echo "  - src/components/ProtectedRoute.tsx (handles super_admin/admin/member)"
echo "  - src/lib/churchService.ts (NEW - church CRUD + song status)"
echo ""
echo "=== MANUAL STEPS ==="
echo ""
echo "1. Wrap App with ChurchProvider in src/App.tsx."
echo "   In the App() function, change:"
echo ""
echo "     <AuthProvider>"
echo "       <AppRoutes />"
echo ""
echo "   To:"
echo ""
echo "     <AuthProvider>"
echo "       <ChurchProvider>"
echo "         <AppRoutes />"
echo "       </ChurchProvider>"
echo ""
echo "   Add import at top:"
echo "     import { ChurchProvider } from './contexts/ChurchContext';"
echo ""
echo "2. Update the root redirect in AppRoutes to handle super admin:"
echo "   Change:"
echo "     user ? <Navigate to={user.role === 'admin' ? '/admin' : '/member'} />"
echo "   To:"
echo "     user ? <Navigate to={user.is_super_admin ? '/super-admin' : user.role === 'admin' ? '/admin' : '/member'} />"
echo ""
echo "3. Then: git add -A && git commit -m 'feat: Phase 2 multi-tenant auth and church context' && git push"
