import { supabase } from './supabase';

export interface AttendanceRecord {
  id?: string;
  event_id: string;
  member_id: string;
  event_title: string;
  event_date: string;
  status: 'yes' | 'no' | 'maybe';
  church_id: string;
  marked_by_admin?: boolean;
  marked_at?: string;
}

export interface MemberAttendanceRow {
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    voice_part: string | null;
    role: string;
  };
  status: 'yes' | 'no' | null;
  markedByAdmin: boolean;
}

export async function getEventAttendanceWithMembers(
  eventId: string,
  churchId: string
): Promise<MemberAttendanceRow[]> {
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, voice_part, role')
    .eq('church_id', churchId)
    .neq('role', 'inactive')
    .order('last_name', { ascending: true });

  if (membersError || !members) {
    console.error('getEventAttendanceWithMembers members:', membersError?.message);
    return [];
  }

  const { data: records, error: recordsError } = await supabase
    .from('attendance_history')
    .select('member_id, status, marked_by_admin')
    .eq('event_id', eventId)
    .eq('church_id', churchId);

  if (recordsError) {
    console.error('getEventAttendanceWithMembers records:', recordsError?.message);
  }

  const recordMap = new Map<string, { status: 'yes' | 'no' | 'maybe'; markedByAdmin: boolean }>();
  for (const r of records || []) {
    recordMap.set(r.member_id, {
      status: r.status as 'yes' | 'no' | 'maybe',
      markedByAdmin: r.marked_by_admin ?? false,
    });
  }

  return members.map(m => {
    const rec = recordMap.get(m.id);
    const rawStatus = rec?.status ?? null;
    const status: 'yes' | 'no' | null = rawStatus === 'yes' || rawStatus === 'no' ? rawStatus : null;
    return {
      member: m,
      status,
      markedByAdmin: rec?.markedByAdmin ?? false,
    };
  });
}

export async function markMemberAttendance(
  eventId: string,
  eventTitle: string,
  eventDate: string,
  memberId: string,
  churchId: string,
  status: 'yes' | 'no'
): Promise<boolean> {
  const { error } = await supabase
    .from('attendance_history')
    .upsert(
      {
        event_id: eventId,
        member_id: memberId,
        event_title: eventTitle,
        event_date: eventDate,
        status,
        church_id: churchId,
        marked_by_admin: true,
        marked_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,member_id' }
    );
  if (error) {
    console.error('markMemberAttendance:', error.message);
    return false;
  }
  return true;
}

export async function bulkMarkAllPresent(
  eventId: string,
  eventTitle: string,
  eventDate: string,
  memberIds: string[],
  churchId: string
): Promise<boolean> {
  if (memberIds.length === 0) return true;
  const markedAt = new Date().toISOString();
  const rows = memberIds.map(memberId => ({
    event_id: eventId,
    member_id: memberId,
    event_title: eventTitle,
    event_date: eventDate,
    status: 'yes' as const,
    church_id: churchId,
    marked_by_admin: true,
    marked_at: markedAt,
  }));
  const { error } = await supabase
    .from('attendance_history')
    .upsert(rows, { onConflict: 'event_id,member_id' });
  if (error) {
    console.error('bulkMarkAllPresent:', error.message);
    return false;
  }
  return true;
}

export interface EventRSVP {
  member_id: string;
  status: 'yes' | 'no' | 'maybe';
}

export async function getRSVPsForEvent(eventId: string): Promise<EventRSVP[]> {
  const { data, error } = await supabase
    .from('event_rsvps')
    .select('member_id, status')
    .eq('event_id', eventId);
  if (error) {
    console.error('getRSVPsForEvent:', error.message);
    return [];
  }
  return (data || []) as EventRSVP[];
}

export interface EventAttendanceSummary {
  total: number;
  present: number;
  absent: number;
  unmarked: number;
  rate: number;
}

export async function getEventAttendanceSummary(
  eventId: string,
  churchId: string
): Promise<EventAttendanceSummary> {
  const rows = await getEventAttendanceWithMembers(eventId, churchId);
  const total = rows.length;
  const present = rows.filter(r => r.status === 'yes').length;
  const absent = rows.filter(r => r.status === 'no').length;
  const unmarked = rows.filter(r => r.status === null).length;
  const effectivePresent = present + unmarked;
  return {
    total,
    present,
    absent,
    unmarked,
    rate: total > 0 ? Math.round((effectivePresent / total) * 100) : 0,
  };
}

export function summaryFromRows(
  rows: MemberAttendanceRow[],
  optimistic: Map<string, 'yes' | 'no'>
): EventAttendanceSummary {
  const total = rows.length;
  let present = 0;
  let absent = 0;
  let unmarked = 0;
  for (const r of rows) {
    const eff = optimistic.get(r.member.id) ?? r.status;
    if (eff === 'yes') present++;
    else if (eff === 'no') absent++;
    else unmarked++;
  }
  const effectivePresent = present + unmarked;
  return {
    total,
    present,
    absent,
    unmarked,
    rate: total > 0 ? Math.round((effectivePresent / total) * 100) : 0,
  };
}
