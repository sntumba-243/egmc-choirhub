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
    
    // Listen for failover events
    const handleFailover = () => {
      console.log('Failover detected, rechecking user...');
      checkUser();
    };
    
    window.addEventListener('database-failover', handleFailover);
    return () => window.removeEventListener('database-failover', handleFailover);
  }, []);

  const checkUser = async () => {
    try {
      console.log('Checking user... Using Neon:', useNeon);
      
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
            setUser({
              id: memberData.id,
              email: memberData.email,
              name: memberData.name,
              role: memberData.role,
              voice_part: memberData.voice_part
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

  const login = async (email: string, password: string) => {
    try {
      if (useNeon) {
        const { user, error } = await neonAuth.login(email, password);
        
        if (error) throw new Error(error);
        
        if (user) {
          setUser(user);
          toast.success('Login successful!');
          navigate(user.role === 'admin' ? '/admin' : '/member');
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
            setUser({
              id: memberData.id,
              email: memberData.email,
              name: memberData.name,
              role: memberData.role,
              voice_part: memberData.voice_part
            });
            
            toast.success('Login successful!');
            navigate(memberData.role === 'admin' ? '/admin' : '/member');
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
