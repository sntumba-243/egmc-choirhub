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
