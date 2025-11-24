import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useActivityTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const updateActivity = async () => {
      try {
        await supabase
          .from('members')
          .update({ last_active: new Date().toISOString() })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error updating activity:', error);
      }
    };

    updateActivity();

    // Update every 2 minutes while active
    const interval = setInterval(updateActivity, 2 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [user?.id]);
}
