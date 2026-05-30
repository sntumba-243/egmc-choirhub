import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, ArrowLeft, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../contexts/ChurchContext';
import {
  getEventAttendanceWithMembers,
  markMemberAttendance,
  bulkMarkAllPresent,
  getRSVPsForEvent,
  type MemberAttendanceRow,
} from '../../lib/attendanceService';

type Phase = 'selector' | 'prompt' | 'sheet' | 'saved';

interface EventLite {
  id: string;
  title: string;
  date: string;
  time: string;
  type?: string | null;
  location?: string | null;
}

interface Entry {
  status: 'yes' | 'no' | null;
  rsvpStatus: 'yes' | 'no' | 'maybe' | null;
}

const voicePartAvatarBg: Record<string, string> = {
  Soprano: 'bg-pink-500',
  Alto: 'bg-purple-500',
  Tenor: 'bg-blue-500',
  Bass: 'bg-green-500',
  Instrumentalist: 'bg-orange-500',
  Unassigned: 'bg-gray-400',
};

const SECTION_ORDER = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Instrumentalist', 'Unassigned'];

const todayYMD = () => {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
};

const fmtYMD = (d: Date) =>
  d.getFullYear() + '-' +
  String(d.getMonth() + 1).padStart(2, '0') + '-' +
  String(d.getDate()).padStart(2, '0');

const formatLongDate = (dateString: string) => {
  const d = new Date(dateString + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
};

const formatTime = (timeString?: string | null) => {
  if (!timeString) return '';
  const [hh, mm] = timeString.split(':');
  const hour = parseInt(hh, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${mm} ${ampm}`;
};

const initialsOf = (first: string, last: string) =>
  `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?';

const dayNumber = (dateString: string) => {
  const d = new Date(dateString + 'T00:00:00');
  return d.getDate();
};

const monthShort = (dateString: string) => {
  const d = new Date(dateString + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
};

const isSameDayAsToday = (dateString: string) => dateString === todayYMD();

export default function TakeAttendance() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId?: string }>();
  const { user } = useAuth();
  const { church } = useChurch();
  const churchId = user?.church_id || church?.id;

  // Focus mode — hide sidebar + mobile header while on this page
  useEffect(() => {
    document.body.classList.add('attendance-focus-mode');
    return () => document.body.classList.remove('attendance-focus-mode');
  }, []);

  const [phase, setPhase] = useState<Phase>(eventId ? 'prompt' : 'selector');

  // Selector phase
  const [events, setEvents] = useState<EventLite[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Selected event
  const [selectedEvent, setSelectedEvent] = useState<EventLite | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(false);

  // Sheet state
  const [rows, setRows] = useState<MemberAttendanceRow[]>([]);
  const [entries, setEntries] = useState<Map<string, Entry>>(new Map());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [rsvpBannerVisible, setRsvpBannerVisible] = useState(false);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [search, setSearch] = useState('');

  // Selector list
  useEffect(() => {
    if (eventId || !churchId) return;
    let cancelled = false;
    (async () => {
      setEventsLoading(true);
      try {
        const today = new Date();
        const start = new Date(today); start.setDate(today.getDate() - 14);
        const end = new Date(today); end.setDate(today.getDate() + 7);
        const { data, error } = await supabase
          .from('events')
          .select('id, title, date, time, type, location, church_id, is_global')
          .or(`church_id.eq.${churchId},is_global.eq.true`)
          .gte('date', fmtYMD(start))
          .lte('date', fmtYMD(end))
          .order('date', { ascending: true });
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

  // Load selected event
  useEffect(() => {
    if (!eventId || !churchId) return;
    let cancelled = false;
    (async () => {
      setLoadingEvent(true);
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, date, time, type, location')
          .eq('id', eventId)
          .single();
        if (cancelled) return;
        if (error || !data) {
          toast.error('Event not found');
          navigate('/admin/attendance/take');
          return;
        }
        setSelectedEvent(data);
        setPhase('prompt');
      } finally {
        if (!cancelled) setLoadingEvent(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, churchId, navigate]);

  // Sync phase to URL: if eventId is dropped (back navigation), return to selector
  useEffect(() => {
    if (!eventId) setPhase('selector');
  }, [eventId]);

  const loadMembersAndRsvps = useCallback(async () => {
    if (!selectedEvent || !churchId) {
      return { rows: [] as MemberAttendanceRow[], rsvps: new Map<string, 'yes' | 'no' | 'maybe'>() };
    }
    const [memberRows, rsvpList] = await Promise.all([
      getEventAttendanceWithMembers(selectedEvent.id, churchId),
      getRSVPsForEvent(selectedEvent.id),
    ]);
    const rsvpMap = new Map<string, 'yes' | 'no' | 'maybe'>();
    for (const r of rsvpList) rsvpMap.set(r.member_id, r.status);
    return { rows: memberRows, rsvps: rsvpMap };
  }, [selectedEvent, churchId]);

  const handleEveryoneHere = async () => {
    if (!selectedEvent || !churchId) return;
    const { rows: memberRows, rsvps } = await loadMembersAndRsvps();
    const map = new Map<string, Entry>();
    for (const r of memberRows) {
      map.set(r.member.id, { status: 'yes', rsvpStatus: rsvps.get(r.member.id) ?? null });
    }
    setRows(memberRows);
    setEntries(map);
    setRsvpBannerVisible(false);
    setPhase('sheet');
    bulkMarkAllPresent(
      selectedEvent.id,
      selectedEvent.title,
      selectedEvent.date,
      memberRows.map(r => r.member.id),
      churchId
    ).then(ok => { if (!ok) toast.error('Some records could not be saved'); });
  };

  const handleMarkIndividually = async () => {
    if (!selectedEvent || !churchId) return;
    const { rows: memberRows, rsvps } = await loadMembersAndRsvps();
    const map = new Map<string, Entry>();
    let prefilledCount = 0;
    for (const r of memberRows) {
      const rsvp = rsvps.get(r.member.id) ?? null;
      let status: 'yes' | 'no' | null = null;
      if (rsvp === 'yes') { status = 'yes'; prefilledCount++; }
      else if (rsvp === 'no') { status = 'no'; prefilledCount++; }
      map.set(r.member.id, { status, rsvpStatus: rsvp });
    }
    setRows(memberRows);
    setEntries(map);
    setRsvpBannerVisible(prefilledCount > 0);
    setPhase('sheet');
  };

  const toggleEntry = async (memberId: string) => {
    if (!selectedEvent || !churchId) return;
    const cur = entries.get(memberId);
    if (!cur) return;
    const next: 'yes' | 'no' = cur.status === 'yes' ? 'no' : 'yes';
    const prevStatus = cur.status;

    setEntries(prev => {
      const m = new Map(prev);
      m.set(memberId, { ...cur, status: next });
      return m;
    });
    setSaving(prev => {
      const s = new Set(prev);
      s.add(memberId);
      return s;
    });

    const ok = await markMemberAttendance(
      selectedEvent.id,
      selectedEvent.title,
      selectedEvent.date,
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
      setEntries(prev => {
        const m = new Map(prev);
        m.set(memberId, { ...cur, status: prevStatus });
        return m;
      });
      toast.error('Could not save');
    }
  };

  const handleMarkRemaining = async () => {
    if (!selectedEvent || !churchId) return;
    const remainingIds = rows
      .filter(r => (entries.get(r.member.id)?.status ?? null) === null)
      .map(r => r.member.id);
    if (remainingIds.length === 0) return;
    setEntries(prev => {
      const m = new Map(prev);
      for (const id of remainingIds) {
        const cur = m.get(id);
        if (cur) m.set(id, { ...cur, status: 'yes' });
      }
      return m;
    });
    const ok = await bulkMarkAllPresent(
      selectedEvent.id,
      selectedEvent.title,
      selectedEvent.date,
      remainingIds,
      churchId
    );
    if (!ok) toast.error('Some records could not be saved');
  };

  const counts = useMemo(() => {
    let yesCount = 0, noCount = 0, nullCount = 0;
    for (const r of rows) {
      const s = entries.get(r.member.id)?.status ?? null;
      if (s === 'yes') yesCount++;
      else if (s === 'no') noCount++;
      else nullCount++;
    }
    const present = yesCount + nullCount;
    return { yes: yesCount, no: noCount, nullCount, present, absent: noCount, checkLater: nullCount, total: rows.length };
  }, [rows, entries]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const full = `${r.member.first_name || ''} ${r.member.last_name || ''}`.toLowerCase();
      return full.includes(q);
    });
  }, [rows, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, MemberAttendanceRow[]>();
    for (const r of filteredRows) {
      const vp = r.member.voice_part || 'Unassigned';
      const key = SECTION_ORDER.includes(vp) ? vp : 'Unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return SECTION_ORDER
      .filter(k => groups.has(k))
      .map(k => ({ key: k, rows: groups.get(k)! }));
  }, [filteredRows]);

  const searchActive = search.trim().length > 0;

  const renderDots = (yes: number, no: number, check: number) => {
    const items: Array<'yes' | 'no' | 'check'> = [];
    for (let i = 0; i < yes; i++) items.push('yes');
    for (let i = 0; i < no; i++) items.push('no');
    for (let i = 0; i < check; i++) items.push('check');
    const visible = items.slice(0, 6);
    const overflow = items.length - visible.length;
    return (
      <div className="flex items-center gap-1">
        {visible.map((kind, i) => {
          if (kind === 'yes') return <span key={i} className="w-[9px] h-[9px] rounded-full bg-green-500" />;
          if (kind === 'no') return <span key={i} className="w-[9px] h-[9px] rounded-full bg-red-500" />;
          return <span key={i} className="w-[9px] h-[9px] rounded-full border border-gray-300 bg-white" />;
        })}
        {overflow > 0 && <span className="text-xs text-gray-400 ml-0.5">+{overflow}</span>}
      </div>
    );
  };

  const renderMemberRow = (r: MemberAttendanceRow) => {
    const entry = entries.get(r.member.id);
    const status = entry?.status ?? null;
    const isSaving = saving.has(r.member.id);
    const avatarBg = voicePartAvatarBg[r.member.voice_part || 'Unassigned'] || 'bg-gray-400';

    let subText = 'Check later';
    let subClass = 'text-gray-400';
    if (status === 'yes') { subText = 'Present'; subClass = 'text-green-600'; }
    else if (status === 'no') { subText = 'Absent'; subClass = 'text-red-500'; }

    const ariaLabel = status === 'yes'
      ? `Mark ${r.member.first_name} ${r.member.last_name} absent`
      : `Mark ${r.member.first_name} ${r.member.last_name} present`;

    return (
      <li
        key={r.member.id}
        onClick={() => toggleEntry(r.member.id)}
        role="button"
        aria-label={ariaLabel}
        className="min-h-[64px] flex items-center gap-3 px-5 border-b border-gray-100 cursor-pointer active:bg-gray-50"
      >
        <div
          className={`w-[38px] h-[38px] rounded-full ${avatarBg} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}
        >
          {initialsOf(r.member.first_name, r.member.last_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-gray-900 tracking-tight truncate">
            {r.member.first_name} {r.member.last_name}
          </div>
          <div className={`text-xs mt-1 ${subClass}`}>{subText}</div>
        </div>
        <div className="min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0">
          <span
            className={`w-[38px] h-[38px] rounded-full flex items-center justify-center transition-all ${
              isSaving
                ? 'border-2 border-gray-200 border-t-gray-500 animate-spin'
                : status === 'yes'
                  ? 'bg-green-600'
                  : status === 'no'
                    ? 'bg-red-500'
                    : 'bg-white border-2 border-gray-200'
            }`}
          >
            {!isSaving && status === 'yes' && (
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {!isSaving && status === 'no' && (
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {!isSaving && status === null && (
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="6" />
              </svg>
            )}
          </span>
        </div>
      </li>
    );
  };

  // ───────────────── selector phase ─────────────────
  if (phase === 'selector') {
    return (
      <div className="space-y-4 px-4 sm:px-6 lg:px-8 py-4">
        <button
          onClick={() => navigate('/admin/attendance')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" /> Attendance
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Take attendance</h1>
          <p className="text-sm text-gray-500 mt-1">Choose the event you're running</p>
        </div>

        {eventsLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-600 mb-4">No events in the last 14 days or next 7 days.</p>
            <button
              onClick={() => navigate('/admin/events/new')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              + Add Event
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map(ev => {
              const today = isSameDayAsToday(ev.date);
              return (
                <li key={ev.id}>
                  <button
                    onClick={() => {
                      setSelectedEvent(ev);
                      setPhase('prompt');
                      navigate(`/admin/attendance/take/${ev.id}`);
                    }}
                    className={`w-full text-left bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all p-4 flex items-center gap-4 ${today ? 'border-l-4 border-l-blue-500' : ''}`}
                  >
                    <div className="flex-shrink-0 w-14 text-center">
                      <div className="text-2xl font-bold text-gray-900 leading-none">{dayNumber(ev.date)}</div>
                      <div className="text-[11px] font-semibold text-gray-400 mt-0.5 tracking-wider">{monthShort(ev.date)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{ev.title}</h3>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {ev.time && <span>{formatTime(ev.time)}</span>}
                        {ev.type && <span className="ml-2 text-gray-400">{ev.type}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ───────────────── prompt phase ─────────────────
  if (phase === 'prompt') {
    if (loadingEvent || !selectedEvent) {
      return (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-700" />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col">
        <div
          className="bg-gray-900 px-4 flex items-center"
          style={{
            paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
            paddingBottom: '20px',
          }}
        >
          <button
            onClick={() => navigate('/admin/attendance')}
            aria-label="Back to events"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white opacity-80 hover:opacity-100 mr-2 flex-shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-white text-lg font-semibold">{selectedEvent.title}</div>
            <div className="text-gray-300 text-sm mt-1">
              {formatLongDate(selectedEvent.date)}{selectedEvent.time ? ` · ${formatTime(selectedEvent.time)}` : ''}
            </div>
          </div>
        </div>
        <div className="flex-1 bg-white px-6 py-12 flex flex-col items-center justify-start">
          <div className="w-full max-w-sm text-center">
            <div className="text-xl font-medium text-gray-900">Is everyone here today?</div>
            <div className="text-sm text-gray-500 mt-2">Your answer sets the starting point</div>
            <button
              onClick={handleEveryoneHere}
              className="bg-gray-900 text-white w-full py-4 rounded-xl mt-10 font-medium hover:bg-gray-800 transition-colors"
            >
              Yes, everyone is here
            </button>
            <button
              onClick={handleMarkIndividually}
              className="border-2 border-gray-300 text-gray-700 w-full py-4 rounded-xl mt-3 font-medium hover:bg-gray-50 transition-colors"
            >
              I will mark individually
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────── sheet phase ─────────────────
  if (phase === 'sheet') {
    if (!selectedEvent) return null;
    const progressPct = counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0;

    return (
      <div className="pb-40">
        {/* Sticky header */}
        <div
          className="sticky top-0 z-20 bg-gray-900 px-4 flex items-center gap-3"
          style={{
            paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
            paddingBottom: '12px',
          }}
        >
          <button
            onClick={() => navigate('/admin/attendance')}
            aria-label="Back to events"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white opacity-80 hover:opacity-100 mr-2 flex-shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm truncate">{selectedEvent.title}</div>
            <div className="text-gray-400 text-xs">{formatLongDate(selectedEvent.date)}</div>
          </div>
        </div>

        {/* RSVP banner */}
        {rsvpBannerVisible && (
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-between">
            <div className="text-blue-700 text-xs">Pre-filled from RSVPs — tap to correct</div>
            <button
              onClick={() => setRsvpBannerVisible(false)}
              aria-label="Dismiss"
              className="text-blue-500 text-xs font-medium ml-2 hover:text-blue-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Count bar (FIRST after header) */}
        <div className="bg-white border-b border-gray-100 px-5 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-gray-900">{counts.present}</span>
            <span className="text-lg text-gray-400 font-normal">of {counts.total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 mt-2.5 mb-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                background: `var(--church-primary, ${church?.primary_color ?? '#185FA5'})`,
              }}
            />
          </div>
          <div className="text-xs text-gray-400">
            {counts.absent} absent · {counts.checkLater} to check later
          </div>
        </div>

        {/* Search (SECOND) */}
        <div className="mx-4 my-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members"
            className="w-full bg-gray-100 rounded-xl pl-9 pr-10 py-2.5 text-base text-gray-900 placeholder-gray-400 border-none outline-none"
            style={{ fontSize: '16px' }}
          />
          {searchActive && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Members */}
        {searchActive ? (
          filteredRows.length === 0 ? (
            <div className="bg-white px-4 py-12 text-center text-sm text-gray-500">
              No members match "{search.trim()}"
            </div>
          ) : (
            <ul>{filteredRows.map(renderMemberRow)}</ul>
          )
        ) : (
          <div>
            {grouped.map(group => {
              const sectionEntries = group.rows.map(r => entries.get(r.member.id));
              const yesN = sectionEntries.filter(e => e?.status === 'yes').length;
              const noN = sectionEntries.filter(e => e?.status === 'no').length;
              const nullN = sectionEntries.filter(e => (e?.status ?? null) === null).length;
              const isCollapsed = collapsed.has(group.key);

              return (
                <div key={group.key}>
                  <button
                    onClick={() => {
                      setCollapsed(prev => {
                        const s = new Set(prev);
                        if (s.has(group.key)) s.delete(group.key);
                        else s.add(group.key);
                        return s;
                      });
                    }}
                    className="w-full min-h-[44px] flex items-center justify-between px-5 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-500">{group.key}</span>
                    <div className="flex items-center gap-2">
                      {renderDots(yesN, noN, nullN)}
                      {isCollapsed
                        ? <ChevronRight className="w-4 h-4 text-gray-400 ml-1" />
                        : <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />}
                    </div>
                  </button>

                  {!isCollapsed && <ul>{group.rows.map(renderMemberRow)}</ul>}
                </div>
              );
            })}
          </div>
        )}

        {/* Sticky footer */}
        <div
          className="fixed bottom-0 left-0 right-0 bg-gray-900 px-4 pt-3 z-30"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
        >
          {counts.nullCount > 0 && (
            <button
              onClick={handleMarkRemaining}
              className="text-xs text-gray-400 cursor-pointer hover:text-gray-200 mb-2 block"
            >
              Mark remaining {counts.nullCount} as present
            </button>
          )}
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xl font-semibold text-white tracking-tight">
                {counts.present} of {counts.total}
              </div>
              <div className="text-xs text-gray-500 mt-1">{counts.checkLater} to check later</div>
            </div>
            <button
              onClick={() => setShowSaveSheet(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-xl min-h-[48px]"
            >
              Save attendance
            </button>
          </div>
        </div>

        {/* Save confirmation sheet */}
        {showSaveSheet && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setShowSaveSheet(false)}
            />
            <div
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl px-6 py-6 z-50"
              style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}
            >
              <h3 className="font-semibold text-lg text-gray-900">Save attendance?</h3>
              <p className="text-sm text-gray-500 mt-2">
                {selectedEvent.title} · {counts.checkLater} to check later counted as present.
              </p>
              <button
                onClick={async () => {
                  if (churchId && selectedEvent) {
                    const toMark = rows
                      .filter(r => (entries.get(r.member.id)?.status ?? null) === null)
                      .map(r => r.member.id);
                    if (toMark.length > 0) {
                      const ok = await bulkMarkAllPresent(
                        selectedEvent.id,
                        selectedEvent.title,
                        selectedEvent.date,
                        toMark,
                        churchId
                      );
                      if (!ok) toast.error('Some records could not be saved');
                    }
                  }
                  setShowSaveSheet(false);
                  setPhase('saved');
                }}
                className="bg-gray-900 hover:bg-black text-white w-full py-3 rounded-xl font-medium mt-5"
              >
                Save
              </button>
              <button
                onClick={() => setShowSaveSheet(false)}
                className="border border-gray-300 text-gray-700 w-full py-3 rounded-xl mt-2 hover:bg-gray-50"
              >
                Keep marking
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ───────────────── saved phase ─────────────────
  if (phase === 'saved') {
    if (!selectedEvent) return null;
    const rate = counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0;
    let warmMessage = 'Attendance recorded for today';
    if (rate >= 90) warmMessage = 'Excellent turnout today 🎉';
    else if (rate >= 75) warmMessage = 'Great rehearsal attendance 👏';
    else if (rate >= 50) warmMessage = 'Good session today';

    return (
      <div>
        <div
          className="bg-gray-900 px-4 flex items-center gap-3"
          style={{
            paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
            paddingBottom: '12px',
          }}
        >
          <button
            onClick={() => navigate('/admin/attendance')}
            aria-label="Back to attendance"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white opacity-80 hover:opacity-100 mr-2 flex-shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm truncate">{selectedEvent.title}</div>
            <div className="text-gray-400 text-xs">{formatLongDate(selectedEvent.date)}</div>
          </div>
        </div>
        <div className="px-6 py-8 bg-white min-h-[calc(100vh-4rem)]">
          <div className="text-5xl font-bold text-gray-900">{counts.present}</div>
          <div className="text-gray-500 mt-1">of {counts.total} members were here</div>
          <div className="h-2 bg-gray-100 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${rate}%`,
                background: `var(--church-primary, ${church?.primary_color ?? '#185FA5'})`,
              }}
            />
          </div>
          <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
            <div className="text-amber-800 font-medium">{warmMessage}</div>
          </div>
          <div className="mt-6 space-y-2">
            {grouped.map(group => {
              const here = group.rows.filter(r => (entries.get(r.member.id)?.status ?? null) !== 'no').length;
              const total = group.rows.length;
              const allHere = here === total;
              return (
                <div key={group.key} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700">{group.key}</span>
                  <span className={`text-sm ${allHere ? 'text-green-600' : 'text-gray-500'}`}>
                    {allHere ? 'All here' : `${here} of ${total} here`}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-8 text-center flex flex-col gap-3">
            <button
              onClick={() => navigate('/admin/events')}
              className="text-gray-600 underline text-sm hover:text-gray-900"
            >
              Back to events
            </button>
            <button
              onClick={() => navigate('/admin/attendance')}
              className="text-gray-600 underline text-sm hover:text-gray-900"
            >
              View attendance history
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
