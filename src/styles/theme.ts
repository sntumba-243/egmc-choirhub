import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { tokens, type Accent } from './tokens';

export function useTheme() {
  const { user } = useAuth();

  const { accent, role } = useMemo(() => {
    let roleKey: 'member' | 'admin' | 'superAdmin' = 'member';
    if (user?.is_super_admin) {
      roleKey = 'superAdmin';
    } else if (user?.role === 'admin') {
      roleKey = 'admin';
    }
    return {
      accent: tokens.accents[roleKey] as Accent,
      role: roleKey,
    };
  }, [user?.role, user?.is_super_admin]);

  return { tokens, accent, role };
}
