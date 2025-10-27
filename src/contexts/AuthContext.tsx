import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  voicePart?: 'soprano' | 'alto' | 'tenor' | 'bass';
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, voicePart: 'soprano' | 'alto' | 'tenor' | 'bass') => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const transformSupabaseUser = (supabaseUser: SupabaseUser): User => {
    const metadata = supabaseUser.user_metadata || {};
    return {
      id: supabaseUser.id,
      name: metadata.name || metadata.full_name || 'User',
      email: supabaseUser.email || '',
      role: metadata.role || 'member',
      voicePart: metadata.voice_part,
      createdAt: supabaseUser.created_at || new Date().toISOString(),
    };
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(transformSupabaseUser(session.user));
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(transformSupabaseUser(session.user));
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (identifier: string, password: string) => {
    // Check if identifier is email or member_id
    if (identifier.includes('@')) {
      // It's an email, use standard login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        setUser(transformSupabaseUser(data.user));
      }
    } else {
      // It's a member_id, use edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login-with-member-id`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identifier,
            password,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const { session, user } = await response.json();

      if (session && user) {
        // Set the session manually
        await supabase.auth.setSession(session);
        setUser(transformSupabaseUser(user));
      }
    }
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    voicePart: 'soprano' | 'alto' | 'tenor' | 'bass'
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: 'member',
          voice_part: voicePart,
        },
      },
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      setUser(transformSupabaseUser(data.user));

      await supabase.from('users').insert({
        id: data.user.id,
        email: data.user.email!,
        name,
        role: 'member',
        voice_part: voicePart,
      });
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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
