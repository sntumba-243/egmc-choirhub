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
  timezone: string;
}

interface ChurchContextType {
  church: Church | null;
  churches: Church[];
  loading: boolean;
  refreshChurch: () => Promise<void>;
  loadAllChurches: () => Promise<void>;
}

const CACHE_KEY = 'choirhub_church_theme';

const applyTheme = (church: Church) => {
  const root = document.documentElement;
  root.style.setProperty('--church-primary', church.primary_color);
  root.style.setProperty('--church-secondary', church.secondary_color);
  root.style.setProperty('--church-accent', church.accent_color);

  // Dynamic favicon
  if (church.logo_url) {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]') || document.createElement('link');
    link.rel = 'icon';
    link.href = church.logo_url;
    document.head.appendChild(link);
  }

  // Dynamic PWA theme color
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', church.primary_color || '#185FA5');

  // Dynamic document title
  document.title = (church.short_name || church.name) + ' · ChoirHub';
};

// Apply cached theme immediately on load (before React renders)
try {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const church = JSON.parse(cached) as Church;
    applyTheme(church);
  }
} catch {}

const ChurchContext = createContext<ChurchContextType | undefined>(undefined);

export const ChurchProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [church, setChurch] = useState<Church | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.church_id) {
      loadChurch(user.church_id);
    } else {
      setChurch(null);
      localStorage.removeItem(CACHE_KEY);
      setLoading(false);
    }
  }, [user?.church_id]);

  useEffect(() => {
    if (church) {
      applyTheme(church);
      localStorage.setItem(CACHE_KEY, JSON.stringify(church));
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
