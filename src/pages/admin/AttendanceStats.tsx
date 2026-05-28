import { useChurch } from '../../contexts/ChurchContext';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MemberAttendance {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  voice_part: string;
  role: string;
  attended: number;
  total_events: number;
  attendance_rate: number;
}

type TimePeriod = 'week' | 'month' | 'year' | 'all';
type StatusFilter = 'all' | 'regulars' | 'followup';

const voicePartColors: Record<string, string> = {
  Soprano: 'text-pink-600 bg-pink-50',
  Alto: 'text-purple-600 bg-purple-50',
  Tenor: 'text-blue-600 bg-blue-50',
  Bass: 'text-green-600 bg-green-50',
  Instrumentalist: 'text-orange-600 bg-orange-50',
};

interface StatusInfo {
  label: string;
  pillBg: string;
  pillText: string;
  dot: string;
  barColor: string;
  rowBg: string;
}

const getStatus = (rate: number, attended: number): StatusInfo => {
  if (attended === 0) return { label: 'Not seen yet', pillBg: 'bg-gray-100', pillText: 'text-gray-500', dot: 'bg-gray-400', barColor: 'bg-gray-300', rowBg: '' };
  if (rate >= 75)     return { label: 'Always here', pillBg: 'bg-green-50', pillText: 'text-green-700', dot: 'bg-green-500', barColor: 'bg-green-500', rowBg: '' };
  if (rate >= 50)     return { label: 'Often here', pillBg: 'bg-blue-50', pillText: 'text-blue-700', dot: 'bg-blue-500', barColor: 'bg-blue-500', rowBg: '' };
  if (rate >= 25)     return { label: 'Sometimes', pillBg: 'bg-amber-50', pillText: 'text-amber-700', dot: 'bg-amber-500', barColor: 'bg-amber-500', rowBg: '' };
  return                     { label: 'Rarely', pillBg: 'bg-orange-50', pillText: 'text-orange-700', dot: 'bg-orange-500', barColor: 'bg-orange-500', rowBg: '' };
};

export default function AttendanceStats() {
  const navigate = useNavigate();
  const [memberStats, setMemberStats] = useState<MemberAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const { church } = useChurch();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [sortBy, setSortBy] = useState<'name' | 'rate'>('rate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [voiceFilter, setVoiceFilter] = useState('all');

  useEffect(() => { loadStats(); }, [timePeriod]);

  useEffect(() => {
    const handleFocus = () => loadStats();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [timePeriod]);

  const loadStats = async () => {
    try {
      setLoading(true);

      const today = new Date();
      const todayStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');

      const sd = new Date();
      if (timePeriod === 'week') sd.setDate(sd.getDate() - 7);
      else if (timePeriod === 'month') sd.setDate(sd.getDate() - 30);
      else if (timePeriod === 'year') sd.setDate(sd.getDate() - 365);

      const startStr = timePeriod === 'all' ? null :
        sd.getFullYear() + '-' +
        String(sd.getMonth() + 1).padStart(2, '0') + '-' +
        String(sd.getDate()).padStart(2, '0');

      const { data: members } = await supabase
        .from('members').select('id, first_name, last_name, email, voice_part, role').eq('church_id', church?.id)
        .neq('role', 'inactive').order('first_name', { ascending: true });

      // All attendance data comes from attendance_history only (past archived events)
      let query = supabase
        .from('attendance_history').select('member_id, event_id, event_date, status')
        .eq('church_id', church?.id)
        .lte('event_date', todayStr);
      if (startStr) query = query.gte('event_date', startStr);
      const { data: archived } = await query;

      // Count distinct events from archived history
      const distinctEvents = new Set<string>();
      (archived || []).forEach(r => distinctEvents.add(r.event_id));
      const totalEvents = distinctEvents.size;

      if (totalEvents === 0) {
        setMemberStats((members || []).map(m => ({ ...m, attended: 0, total_events: 0, attendance_rate: 0 })));
        setLoading(false);
        return;
      }

      // Count attendance per member (status = 'yes' means they attended)
      const attendanceMap = new Map<string, Set<string>>();
      (archived || []).forEach(r => {
        if (r.status === 'yes') {
          if (!attendanceMap.has(r.member_id)) attendanceMap.set(r.member_id, new Set());
          attendanceMap.get(r.member_id)!.add(r.event_id);
        }
      });

      // Build auth_uid -> member map for resolving attendance_history rows stored with auth.uid()
      const membersList = members || [];
      const memberIds = new Set(membersList.map(m => m.id));
      const emailToMember = new Map(membersList.map(m => [m.email, m]));
      const authUidToMember = new Map<string, typeof membersList[0]>();

      const orphanedIds = [...attendanceMap.keys()].filter(id => !memberIds.has(id));
      if (orphanedIds.length > 0) {
        const { data: authUsers } = await supabase
          .from('users').select('id, email');
        (authUsers || []).forEach(u => {
          const member = emailToMember.get(u.email);
          if (member) authUidToMember.set(u.id, member);
        });
      }

      // Merge auth_uid attendance into matching member's count
      const mergedAttendance = new Map<string, Set<string>>();
      for (const [memberId, eventSet] of attendanceMap.entries()) {
        const resolved = authUidToMember.get(memberId);
        const targetId = resolved ? resolved.id : memberId;
        if (!mergedAttendance.has(targetId)) mergedAttendance.set(targetId, new Set());
        for (const eid of eventSet) mergedAttendance.get(targetId)!.add(eid);
      }

      const stats: MemberAttendance[] = membersList.map(m => {
        const att = mergedAttendance.get(m.id)?.size || 0;
        return { ...m, attended: att, total_events: totalEvents, attendance_rate: totalEvents > 0 ? Math.round((att / totalEvents) * 100) : 0 };
      });

      // Add truly orphaned entries (not resolvable via auth email fallback)
      for (const [memberId, eventSet] of mergedAttendance.entries()) {
        if (!memberIds.has(memberId)) {
          stats.push({
            id: memberId,
            first_name: 'Unknown',
            last_name: `(${memberId.substring(0, 8)}...)`,
            email: '',
            voice_part: '',
            role: '',
            attended: eventSet.size,
            total_events: totalEvents,
            attendance_rate: totalEvents > 0 ? Math.round((eventSet.size / totalEvents) * 100) : 0,
          });
        }
      }

      setMemberStats(stats);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = (field: 'name' | 'rate') => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir(field === 'name' ? 'asc' : 'desc'); }
  };

  const filtered = memberStats
    .filter(m => {
      if (statusFilter === 'regulars') return m.attendance_rate >= 50;
      if (statusFilter === 'followup') return m.attendance_rate < 50;
      return true;
    })
    .filter(m => voiceFilter === 'all' || m.voice_part === voiceFilter);

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') {
      const cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      return sortDir === 'asc' ? cmp : -cmp;
    }
    return sortDir === 'asc' ? a.attendance_rate - b.attendance_rate : b.attendance_rate - a.attendance_rate;
  });

  const totalEvents = memberStats[0]?.total_events || 0;
  const regularsCount = memberStats.filter(m => m.attendance_rate >= 50).length;
  const followupCount = memberStats.filter(m => m.attendance_rate < 50).length;
  const timePeriodLabels: Record<TimePeriod, string> = { week: 'Week', month: 'Month', year: 'Year', all: 'All' };
  const voiceParts = [...new Set(memberStats.map(m => m.voice_part).filter(Boolean))];

  if (loading) return (
    <div className="flex justify-center p-12">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 pb-8">
      {/* New header — back chevron, title, primary CTA */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
        <button
          onClick={() => navigate('/admin/attendance')}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4"
        >
          <ChevronLeft size={16} /> Attendance
        </button>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Choir health</h1>
          <button
            onClick={() => navigate('/admin/attendance/take')}
            className="text-sm font-medium text-white px-4 py-2 rounded-xl min-h-[44px] whitespace-nowrap"
            style={{ background: church?.primary_color ?? '#185FA5' }}
          >
            Take attendance →
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 pt-4 space-y-3">

      {/* Subtitle + period selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-500">Based on archived attendance · {totalEvents} past event{totalEvents === 1 ? '' : 's'} in period</p>
          <button onClick={() => loadStats()} title="Refresh"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <div className="flex bg-gray-100/80 rounded-xl p-0.5">
          {(['week', 'month', 'year', 'all'] as TimePeriod[]).map(p => (
            <button key={p} onClick={() => setTimePeriod(p)}
              className={`min-h-[44px] px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${timePeriod === p ? 'bg-blue-500 text-white shadow-sm font-semibold' : 'text-gray-500'}`}>
              {timePeriodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-2.5">
          <div className="text-xs text-gray-400">Members</div>
          <div className="text-xl font-bold text-gray-900">{memberStats.length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-2.5">
          <div className="text-xs text-gray-400">Events</div>
          <div className="text-xl font-bold text-gray-900">{totalEvents}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-2.5">
          <div className="text-xs text-gray-400">Regulars</div>
          <div className="text-xl font-bold text-green-600">{regularsCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-2.5">
          <div className="text-xs text-gray-400">Follow-up</div>
          <div className="text-xl font-bold text-red-500">{followupCount}</div>
        </div>
      </div>

      {/* Sort + Filter */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">Sort:</span>
          <div className="flex bg-gray-100/80 rounded-lg p-0.5">
            <button onClick={() => toggleSort('name')}
              className={`min-h-[44px] px-3 py-1 rounded-md text-xs font-medium transition-all ${sortBy === 'name' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500'}`}>
              Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
            <button onClick={() => toggleSort('rate')}
              className={`min-h-[44px] px-3 py-1 rounded-md text-xs font-medium transition-all ${sortBy === 'rate' ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500'}`}>
              Attendance {sortBy === 'rate' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100/80 rounded-lg p-0.5">
            {([['all', 'All'], ['regulars', 'Regulars'], ['followup', 'Follow-up']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setStatusFilter(key as StatusFilter)}
                className={`min-h-[44px] px-3 py-1 rounded-md text-xs font-medium transition-all ${statusFilter === key ? 'bg-white shadow-sm text-gray-900 font-semibold' : 'text-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>
          <select value={voiceFilter} onChange={e => setVoiceFilter(e.target.value)}
            className="min-h-[44px] px-3 py-1 text-xs font-medium text-gray-600 bg-white rounded-lg border border-gray-200/60 shadow-sm">
            <option value="all">All Voices</option>
            {voiceParts.map(vp => <option key={vp} value={vp}>{vp}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Member</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Voice</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Attendance</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No members match this filter</td></tr>
            ) : sorted.map(m => {
              const s = getStatus(m.attendance_rate, m.attended);
              return (
                <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${s.rowBg}`}>
                  <td className="px-4 py-2.5">
                    <div className="text-[13px] font-semibold text-gray-900">{m.first_name} {m.last_name}</div>
                    <div className="text-xs text-gray-400">{m.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${voicePartColors[m.voice_part] || 'text-gray-600 bg-gray-50'}`}>
                      {m.voice_part || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                        <div className={`h-full rounded-full ${s.barColor}`} style={{ width: `${m.attendance_rate}%` }} />
                      </div>
                      <span className={`text-[12px] font-bold whitespace-nowrap ${m.attended === 0 ? 'text-gray-400' : m.attendance_rate >= 50 ? 'text-green-600' : m.attendance_rate >= 25 ? 'text-yellow-600' : 'text-red-500'}`}>
                        {m.attended} / {m.total_events}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${s.pillBg} ${s.pillText}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      </div>
    </div>
  );
}
