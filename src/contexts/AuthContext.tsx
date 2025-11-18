import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'member' | 'guest';
  force_password_change?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, force_password_change, email')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (profile) {
        setUser({
          id: userId,
          email: profile.email || '',
          role: (profile.role || 'member') as 'admin' | 'member' | 'guest',
          force_password_change: profile.force_password_change || false
        });

        // If force_password_change is true, redirect to change password
        if (profile.force_password_change) {
          window.location.href = '/change-password';
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    if (data.user) {
      // Fetch profile to get role and force_password_change
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, force_password_change, email')
        .eq('id', data.user.id)
        .single();

      if (profile) {
        setUser({
          id: data.user.id,
          email: profile.email || data.user.email || '',
          role: (profile.role || 'member') as 'admin' | 'member' | 'guest',
          force_password_change: profile.force_password_change || false
        });

        // Check if password change is required
        if (profile.force_password_change) {
          // Don't throw error, just let the redirect happen
          // The useEffect will catch this and redirect
          return;
        }
      } else {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          role: 'member',
          force_password_change: false
        });
      }
    }
  };

  const register = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: 'member' }
      }
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn: login,
      signUp: register,
      signOut: logout,
      login, 
      register, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
