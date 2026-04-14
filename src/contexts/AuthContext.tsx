import { preCacheUserData } from '../lib/offlineCache';
import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDbClient } from '../lib/supabase';
import { neonAuth, NeonUser } from '../lib/neonAuth';
import { autoFailover } from '../lib/autoFailover';
import { Sentry } from '../lib/sentry';
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
            .eq('email', session.user.email)
            .single();

          if (memberData) {
            const { data: userData } = await supabase
              .from('users')
              .select('is_super_admin')
              .eq('id', session.user.id)
              .maybeSingle();

            setUser({
              id: memberData.id,
              email: memberData.email,
              name: memberData.first_name ? `${memberData.first_name} ${memberData.last_name || ''}`.trim() : memberData.email,
              first_name: memberData.first_name || null,
              role: memberData.role,
              voice_part: memberData.voice_part,
              church_id: memberData.church_id,
              is_super_admin: userData?.is_super_admin || false,
            });
            // Pre-cache data for offline use on session restore
            if (memberData.church_id) {
              preCacheUserData(supabase, memberData.church_id).catch(() => {});
            }
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
          Sentry.setUser({ id: user.id, email: user.email, role: user.role });
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
            .eq('email', data.user.email)
            .single();

          if (memberData) {
            const { data: userData } = await supabase
              .from('users')
              .select('is_super_admin')
              .eq('id', data.user.id)
              .maybeSingle();

            const loggedInUser: NeonUser = {
              id: memberData.id,
              email: memberData.email,
              name: memberData.first_name ? `${memberData.first_name} ${memberData.last_name || ''}`.trim() : memberData.email,
              first_name: memberData.first_name || null,
              role: memberData.role,
              voice_part: memberData.voice_part,
              church_id: memberData.church_id,
              is_super_admin: userData?.is_super_admin || false,
            };

            setUser(loggedInUser);
            Sentry.setUser({ id: loggedInUser.id, email: loggedInUser.email, role: loggedInUser.role });
            // Pre-cache data for offline use
            if (loggedInUser.church_id) {
              preCacheUserData(supabase, loggedInUser.church_id).catch(() => {});
            }
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
      Sentry.setUser(null);
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
