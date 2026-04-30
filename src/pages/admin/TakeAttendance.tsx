import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Check, ChevronDown, ChevronUp, Search, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../contexts/ChurchContext';
import {
  getEventAttendanceWithMembers,
  markMemberAttendance,
  summaryFromRows,
  type MemberAttendanceRow,
  type EventAttendanceSummary,
} from '../../lib/attendanceService';

interface EventLite {
  id: string;
  title: string;
  date: string;
  time: string;
  type?: string | null;
  location?: string | null;
}

const voicePartColors: Record<string, string> = {
  Soprano: 'text-pink-600 bg-pink-50',
  Alto: 'text-purple-600 bg-purple-50',
  Tenor: 'text-blue-600 bg-blue-50',
  Bass: 'text-green-600 bg-green-50',
  Instrumentalist: 'text-orange-600 bg-orange-50',
};

const voicePartCircleColors: Record<string, string> = {
  Soprano: 'bg-pink-500',
  Alto: 'bg-purple-500',
  Tenor: 'bg-blue-500',
  Bass: 'bg-green-500',
  Instrumentalist: 'bg-orange-500',
};

const formatDate = (dateString: string) => {
  const d = new Date(dateString + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
};

const formatTime = (timeString: string) => {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const initialsOf = (first: string, last: string) =>
  `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?';

export default function TakeAttendance() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId?: string }>();
  const { user } = useAuth();
  const { church } = useChurch();

  const [events, setEvents] = useState<EventLite[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [event, setEvent] = useState<EventLite | null>(null);
  const [rows, setRows] = useState<MemberAttendanceRow[]>([]);
  const [optimistic, setOptimistic] = useState<Map<string, 'yes' | 'no'>>(new Map());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const [voiceFilter, setVoiceFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showCloseSheet, setShowCloseSheet] = useState(false);

  const churchId = user?.church_id || church?.id;

  // Load event-selector list
  useEffect(() => {
    if (eventId || !churchId) return;
    let cancelled = false;
    (async () => {
      setEventsLoading(true);
      try {
        const today = new Date();
        const start = new Date(today); start.setDate(today.getDate() - 14);
        const end = new Date(today); end.setDate(today.getDate() + 7);
        const fmt = (d: Date) => d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0');
        const { data, error } = await supabase
          .from('events')
          .select('id, title, date, time, type, location, church_id, is_global')
          .or(`church_id.eq.${churchId},is_global.eq.true`)
          .gte('date', fmt(start))
          .lte('date', fmt(end))
          .order('date', { ascending: false });
        if (cancelled) return;
        if (error) {
          console.error('TakeAttendance events:', error.message);
          setEvents([]);
        } else {
          setEvents(data || []);
        }
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, churchId]);

  // Load the event + attendance rows for the selected event
  useEffect(() => {
    if (!eventId || !churchId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: ev, error: evErr } = await supabase
          .from('events')
          .select('id, title, date, time, type, location')
          .eq('id', eventId)
          .single();
        if (cancelled) return;
        if (evErr || !ev) {
          toast.error('Event not found');
          navigate('/admin/attendance/take');
          return;
        }
        setEvent(ev);
        const data = await getEventAttendanceWithMembers(eventId, churchId);
        if (cancelled) return;
        setRows(data);
        setOptimistic(new Map());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, churchId, navigate]);

  const handleToggle = async (row: MemberAttendanceRow) => {
    if (!event || !churchId) return;
    const memberId = row.member.id;
    const current = optimistic.get(memberId) ?? row.status;
    const next: 'yes' | 'no' = current === 'yes' ? 'no' : 'yes';

    setOptimistic(prev => {
      const m = new Map(prev);
      m.set(memberId, next);
      return m;
    });
    setSaving(prev => {
      const s = new Set(prev);
      s.add(memberId);
      return s;
    });

    const ok = await markMemberAttendance(
      event.id,
      event.title,
      event.date,
      memberId,
      churchId,
      next
    );

    setSaving(prev => {
      const s = new Set(prev);
      s.delete(memberId);
      return s;
    });

    if (!ok) {
      setOptimistic(prev => {
        const m = new Map(prev);
        if (current === null) m.delete(memberId);
        else m.set(memberId, current);
        return m;
      });
      toast.error(`Could not save ${row.member.first_name}`);
    }
  };

  const handleMarkAllPresent = async () => {
    if (!event || !churchId) return;
    const targets = rows.filter(r => (optimistic.get(r.member.id) ?? r.status) === null);
    if (targets.length === 0) {
      toast('Everyone is already marked');
      return;
    }
    setOptimistic(prev => {
      const m = new Map(prev);
      for (const r of targets) m.set(r.member.id, 'yes');
      return m;
    });
    setSaving(prev => {
      const s = new Set(prev);
      for (const r of targets) s.add(r.member.id);
      return s;
    });
    let failures = 0;
    await Promise.all(
      targets.map(async r => {
        const ok = await markMemberAttendance(
          event.id, event.title, event.date, r.member.id, churchId!, 'yes'
        );
        if (!ok) failures++;
      })
    );
    setSaving(new Set());
    if (failures > 0) {
      toast.error(`${failures} could not be saved`);
    } else {
      toast.success(`Marked ${targets.length} present`);
    }
  };

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (voiceFilter !== 'all' && r.member.voice_part !== voiceFilter) return false;
      if (q) {
        const name = `${r.member.first_name || ''} ${r.member.last_name || ''}`.toLowerCase();
        if (!name.includes(q) && !(r.member.email || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, voiceFilter, search]);

  const grouped = useMemo(() => {
    const order = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Instrumentalist'];
    const groups = new Map<string, MemberAttendanceRow[]>();
    for (const r of visibleRows) {
      const key = r.member.voice_part || 'Other';
      const bucket = order.includes(key) ? key : 'Other';
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket)!.push(r);
    }
    return [...order, 'Other']
      .filter(k => groups.has(k))
      .map(k => ({ key: k, rows: groups.get(k)! }));
  }, [visibleRows]);

  const summary: EventAttendanceSummary = useMemo(
    () => summaryFromRows(rows, optimistic),
    [rows, optimistic]
  );

  const markedCount = summary.present + summary.absent;
  const percent = summary.total > 0 ? Math.round((markedCount / summary.total) * 100) : 0;

  // ─────────── Event selector ───────────
  if (!eventId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Take Attendance</h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">Select an event to mark who attended</p>
          </div>
          <button
            onClick={() => navigate('/admin/attendance')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            View Stats
          </button>
        </div>

        {eventsLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-16 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No recent or upcoming events</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-6">Create an event before taking attendance.</p>
            <button
              onClick={() => navigate('/admin/events/new')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              + Add Event
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {events.map(ev => (
              <button
                key={ev.id}
                onClick={() => navigate(`/admin/attendance/take/${ev.id}`)}
                className="group text-left bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-blue-300 p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                    {ev.title}
                  </h3>
                  {ev.type && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full whitespace-nowrap">
                      {ev.type}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" strokeWidth={2.5} />
                    <span className="text-xs font-medium">{formatDate(ev.date)}</span>
                    {ev.time && <span className="text-xs text-gray-400">· {formatTime(ev.time)}</span>}
                  </div>
                  {ev.location && (
                    <div className="text-xs text-gray-500 truncate">{ev.location}</div>
                  )}
                </div>
                <div className="mt-3 text-xs font-semibold text-blue-600 group-hover:text-blue-800">
                  Take Attendance →
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─────────── Attendance sheet ───────────
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-2/3" />
        <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3" />
        <div className="h-2 bg-gray-100 rounded-full animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="space-y-2 mt-4">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/admin/attendance/take')}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Events
        </button>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No active members</h3>
          <p className="text-sm text-gray-600 mb-6">Add members to your church before taking attendance.</p>
          <button
            onClick={() => navigate('/admin/members/new')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            + Add Member
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-32">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/admin/attendance/take')}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Events
        </button>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">{event?.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {event && formatDate(event.date)}
          {event?.time && <span className="text-gray-400"> · {formatTime(event.time)}</span>}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-sm text-gray-500 whitespace-nowrap">
            {markedCount} / {summary.total} marked
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-3">
          <div className="text-xs text-gray-400">Present</div>
          <div className="text-xl font-bold text-green-600">{summary.present}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-3">
          <div className="text-xs text-gray-400">Absent</div>
          <div className="text-xl font-bold text-red-500">{summary.absent}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-3">
          <div className="text-xs text-gray-400">Unmarked</div>
          <div className="text-xl font-bold text-gray-500">{summary.unmarked}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-3">
          <div className="text-xs text-gray-400">Rate</div>
          <div className="text-xl font-bold text-blue-600">{summary.rate}%</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllPresent}
            disabled={summary.unmarked === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" /> Mark all present
          </button>
          <select
            value={voiceFilter}
            onChange={e => setVoiceFilter(e.target.value)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-200 shadow-sm"
          >
            <option value="all">All voices</option>
            <option value="Soprano">Soprano</option>
            <option value="Alto">Alto</option>
            <option value="Tenor">Tenor</option>
            <option value="Bass">Bass</option>
          </select>
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white rounded-lg border border-gray-200 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300"
          />
        </div>
      </div>

      {/* Members grouped by voice part */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-sm text-gray-500">
          No members match this filter
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(group => {
            const isCollapsed = collapsed.has(group.key);
            const groupPresent = group.rows.filter(r => (optimistic.get(r.member.id) ?? r.status) === 'yes').length;
            const groupTotal = group.rows.length;
            return (
              <div key={group.key} className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
                <button
                  onClick={() => {
                    setCollapsed(prev => {
                      const s = new Set(prev);
                      if (s.has(group.key)) s.delete(group.key); else s.add(group.key);
                      return s;
                    });
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${voicePartColors[group.key] || 'text-gray-600 bg-gray-50'}`}>
                      {group.key}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">
                      {groupPresent} / {groupTotal}
                    </span>
                  </div>
                  {isCollapsed
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronUp className="w-4 h-4 text-gray-400" />}
                </button>
                {!isCollapsed && (
                  <ul className="divide-y divide-gray-50 lg:grid lg:grid-cols-2 lg:divide-y-0">
                    {group.rows.map(r => {
                      const eff = optimistic.get(r.member.id) ?? r.status;
                      const isSaving = saving.has(r.member.id);
                      const circleColor = voicePartCircleColors[r.member.voice_part || ''] || 'bg-gray-400';
                      return (
                        <li key={r.member.id} className="flex items-center gap-3 px-4 py-3 lg:border-b lg:border-gray-50">
                          <div className={`w-9 h-9 rounded-full ${circleColor} flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0`}>
                            {initialsOf(r.member.first_name, r.member.last_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {r.member.first_name} {r.member.last_name}
                            </div>
                            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                              {r.member.voice_part && (
                                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${voicePartColors[r.member.voice_part] || 'text-gray-600 bg-gray-50'}`}>
                                  {r.member.voice_part}
                                </span>
                              )}
                              {r.markedByAdmin && <span>· admin</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggle(r)}
                            disabled={isSaving}
                            aria-label={
                              eff === 'yes' ? 'Mark absent' : eff === 'no' ? 'Mark present' : 'Mark present'
                            }
                            className={`relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all ${
                              eff === 'yes'
                                ? 'bg-green-500 text-white shadow-sm hover:bg-green-600'
                                : eff === 'no'
                                  ? 'bg-red-500 text-white shadow-sm hover:bg-red-600'
                                  : 'bg-white border-2 border-gray-300 text-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {isSaving ? (
                              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : eff === 'yes' ? (
                              <Check className="w-5 h-5" strokeWidth={3} />
                            ) : eff === 'no' ? (
                              <X className="w-5 h-5" strokeWidth={3} />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky footer */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 lg:left-64 z-20"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {summary.unmarked > 0
              ? <>{summary.unmarked} unmarked · default present</>
              : <>All members marked</>}
          </div>
          <button
            onClick={() => setShowCloseSheet(true)}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900"
          >
            Close Session
          </button>
        </div>
      </div>

      {/* Confirm sheet */}
      {showCloseSheet && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center sm:justify-center bg-black/50" onClick={() => setShowCloseSheet(false)}>
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
          >
            <h3 className="text-lg font-semibold text-gray-900">Close attendance for {event?.title}?</h3>
            <p className="mt-2 text-sm text-gray-600">
              {summary.unmarked} unmarked member{summary.unmarked === 1 ? '' : 's'} will be treated as present (default).
            </p>
            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                onClick={() => setShowCloseSheet(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Keep Taking Attendance
              </button>
              <button
                onClick={() => {
                  setShowCloseSheet(false);
                  toast.success('Session closed');
                  navigate('/admin/attendance');
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-800 hover:bg-gray-900"
              >
                Close Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
