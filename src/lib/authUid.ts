import { supabase } from './supabase';

// The app's `user.id` comes from the `members` table (looked up by email) and is
// NOT the auth user id for ~half of members. Columns whose FKs point at
// auth.users (messages.sender_id, read_messages.user_id, user_favorites.user_id)
// and RLS checks that use auth.uid() must use the REAL session user id — this
// returns it.
//
// Offline, supabase-js can't refresh an expired access token and getSession()
// reports no session (see lib/offlineSession). The stored session is still in
// storage until sign-out, so fall back to the user id recorded in it — needed to
// find this person's saved favorites offline. Sign-out removes it.
export async function getAuthUid(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch { /* offline / storage blocked → stored session below */ }
  return storedSessionUid();
}

function storedSessionUid(): string | null {
  for (const s of ['local', 'session'] as const) {
    try {
      const st = s === 'local' ? window.localStorage : window.sessionStorage;
      for (let i = 0; i < st.length; i++) {
        const k = st.key(i);
        if (!k || !k.startsWith('sb-') || !k.endsWith('-auth-token')) continue;
        const raw = st.getItem(k);
        const id = raw ? JSON.parse(raw)?.user?.id : null;
        if (typeof id === 'string' && id) return id;
      }
    } catch { /* storage blocked / unparsable */ }
  }
  return null;
}
