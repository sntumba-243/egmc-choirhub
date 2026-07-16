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

// Remember-me: when enabled the auth token lives in localStorage (survives
// browser/app close → offline access persists); when disabled it lives in
// sessionStorage (cleared on close). Flag defaults to true. The adapter is the
// single source the supabase client reads/writes the session through, so both
// online session-restore and the offline auth path honor the choice.
const REMEMBER_KEY = 'choirhub_remember_me';
const rememberMe = () => localStorage.getItem(REMEMBER_KEY) !== 'false'; // default true
const authStorage = {
  getItem: (k: string) => (rememberMe() ? localStorage : sessionStorage).getItem(k),
  setItem: (k: string, v: string) => (rememberMe() ? localStorage : sessionStorage).setItem(k, v),
  removeItem: (k: string) => { localStorage.removeItem(k); sessionStorage.removeItem(k); },
};

const supabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: authStorage,
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
