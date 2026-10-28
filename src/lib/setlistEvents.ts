import { supabase } from './supabase';

// Event pickers ("Add to event"): upcoming events whose setlist the current
// user may WRITE. Mirrors the event_songs write policy exactly by asking the
// policy's own helper, msg_can_edit_setlist(), per event — the client can't
// work it out itself, because global-event targeting lives in event_churches,
// which only super admins can read. Result:
//   • church admin: own church's events + globals explicitly targeted at them
//     (all-churches globals are super-admin-only setlists, so they're left out)
//   • super admin: every upcoming event

export interface PickableEvent {
  id: string;
  title: string;
  date: string;
  end_date?: string | null;
  type: string;
  is_global?: boolean | null;
  church_short_name?: string | null;
}

export async function fetchSetlistEditableEvents(fromYmd: string, limit: number): Promise<PickableEvent[]> {
  // RLS already narrows this to events the user can see.
  const { data, error } = await supabase
    .from('events')
    .select('id, title, date, end_date, type, is_global, churches(short_name)')
    .gte('last_date', fromYmd)
    .order('date', { ascending: true })
    .limit(100);
  if (error) throw error;
  const rows = (data || []) as any[];

  const checks: Array<{ data: unknown; error: unknown }> = await Promise.all(
    rows.map(e => supabase.rpc('msg_can_edit_setlist', { eid: e.id }))
  );
  const checkError = checks.find(c => c.error)?.error;
  if (checkError) console.error('Setlist permission check failed:', checkError);

  return rows
    .filter((_, i) => checks[i].data === true)
    .slice(0, limit)
    .map(({ churches, ...e }) => ({
      ...e,
      church_short_name: (Array.isArray(churches) ? churches[0] : churches)?.short_name ?? null,
    }));
}
