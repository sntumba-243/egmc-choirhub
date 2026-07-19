import { supabase } from './supabase';

// The app's `user.id` comes from the `members` table (looked up by email) and is
// NOT the auth user id for ~half of members. Columns whose FKs point at
// auth.users (messages.sender_id, read_messages.user_id) and RLS checks that use
// auth.uid() must use the REAL session user id — this returns it.
export async function getAuthUid(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}
