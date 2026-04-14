import { createClient } from '@supabase/supabase-js';
import { neonClient } from './neonClient';
import { autoFailover } from './autoFailover';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Manual override from env
const forceNeon = import.meta.env.VITE_USE_NEON === 'true';

// Initialize auto-failover (only if not forcing Neon)
let useNeon = forceNeon;

if (!forceNeon) {
  // Auto-failover will run asynchronously
  autoFailover.initialize().then(failedOver => {
    if (failedOver && !useNeon) {
      // Trigger a re-render or reload if needed
      window.dispatchEvent(new Event('database-failover'));
    }
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials!');
}

const supabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Function to get the right client
export function getDbClient() {
  const shouldUseNeon = forceNeon || autoFailover.isUsingNeon();
  return shouldUseNeon ? neonClient : supabaseClient;
}

// Export current client (may switch after failover check)
export const supabase = getDbClient();

if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  (window as any).getDbClient = getDbClient;
  
  // Listen for failover events
  window.addEventListener('database-failover', () => {
  });
}
