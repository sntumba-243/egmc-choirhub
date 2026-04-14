import { supabase } from './supabase';
import pkg from 'pg';
const { Pool } = pkg;

const useNeon = import.meta.env.VITE_USE_NEON === 'true';
const neonUrl = import.meta.env.VITE_NEON_CONNECTION;

let neonPool: any = null;

if (useNeon && neonUrl) {
  neonPool = new Pool({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false }
  });
}

// Export the appropriate client
export const db = useNeon && neonPool ? neonPool : supabase;
export { supabase }; // Always export supabase for auth
