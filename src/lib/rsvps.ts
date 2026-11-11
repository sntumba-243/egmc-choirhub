// ONE definition of "an RSVP", shared by every count and list.
//
// An event_rsvps row counts only if its member_id resolves to a member row the
// viewer can see. event_rsvps.member_id has NO foreign key to members, so rows
// survive member deletion ("orphans"), and for global events rows from other
// churches are readable via event_rsvps RLS but their members are not (members
// RLS). Previously the admin Events card counted raw rows (orphans included)
// while EventDetail listed only rows with a visible member — the card showed
// "1 RSVP" that the detail page and Reset could never act on.
//
// event_rsvps has no FK to members, so PostgREST can't embed the join: two
// queries (rows, then their members), filtered client-side.

import { supabase as client } from './supabase';

// The exported client is typed as a Supabase|Neon union whose builders aren't
// awaitable to tsc; at runtime it is the Supabase client.
const supabase = client as any;

export type RsvpStatus = 'yes' | 'no' | 'maybe';
export interface RsvpRow { event_id: string; member_id: string; status: RsvpStatus }

export interface RsvpResult {
  /** Rows whose member exists and is visible — the only ones any UI counts. */
  valid: RsvpRow[];
  /** Rows excluded from counts: orphaned (member deleted) or another church's member. */
  hidden: RsvpRow[];
  error: unknown;
}

const CHUNK = 200; // keep .in() URLs well under request-size limits

export async function fetchRsvps(eventIds: string[]): Promise<RsvpResult> {
  const ids = [...new Set(eventIds.filter(Boolean))];
  if (!ids.length) return { valid: [], hidden: [], error: null };

  const rows: RsvpRow[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('event_rsvps')
      .select('event_id, member_id, status')
      .in('event_id', ids.slice(i, i + CHUNK));
    if (error) return { valid: [], hidden: [], error };
    rows.push(...((data || []) as RsvpRow[]));
  }

  const memberIds = [...new Set(rows.map((r) => r.member_id).filter(Boolean))];
  const visible = new Set<string>();
  for (let i = 0; i < memberIds.length; i += CHUNK) {
    const { data, error } = await supabase.from('members').select('id').in('id', memberIds.slice(i, i + CHUNK));
    if (error) return { valid: [], hidden: [], error };
    (data || []).forEach((m: { id: string }) => visible.add(m.id));
  }

  const valid: RsvpRow[] = [];
  const hidden: RsvpRow[] = [];
  for (const r of rows) (visible.has(r.member_id) ? valid : hidden).push(r);
  return { valid, hidden, error: null };
}

/** event_id → number of valid rows (optionally only one status). */
export function countByEvent(rows: RsvpRow[], status?: RsvpStatus): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) if (!status || r.status === status) out[r.event_id] = (out[r.event_id] || 0) + 1;
  return out;
}
