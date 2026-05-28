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

const voicePartColors: Record<string, string> = {
  Soprano: 'text-pink-600 bg-pink-50',
  Alto: 'text-purple-600 bg-purple-50',
  Tenor: 'text-blue-600 bg-blue-50',
  Bass: 'text-green-600 bg-green-50',
  Instrumentalist: 'text-orange-600 bg-orange-50',
};

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

  const [phase, setPhase] = useState<Phase>(eventId ? 'prompt' : 'selector');

  // Selector phase
  const [events, setEvents] = useState<EventLite[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Selected event (used in prompt/sheet/saved phases)
  const [selectedEvent, setSelectedEvent] = useState<EventLite | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(false);

  // Sheet phase state
  const [rows, setRows] = useState<MemberAttendanceRow[]>([]);
  const [entries, setEntries] = useState<Map<string, Entry>>(new Map());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [rsvpBannerVisible, setRsvpBannerVisible] = useState(false);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [search, setSearch] = useState('');

  // Load selector events
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

  // Load selected event when eventId in URL
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

  const loadMembersAndRsvps = useCallback(async () => {
    if (!selectedEvent || !churchId) return { rows: [] as MemberAttendanceRow[], rsvps: new Map<string, 'yes' | 'no' | 'maybe'>() };
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
    // null → yes, yes → no, no → yes
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

  // Computed counts (yes + null counted as present per spec)
  const counts = useMemo(() => {
    let yesCount = 0, noCount = 0, nullCount = 0;
    for (const r of rows) {
      const e = entries.get(r.member.id);
      const s = e?.status ?? null;
      if (s === 'yes') yesCount++;
      else if (s === 'no') noCount++;
      else nullCount++;
    }
    const present = yesCount + nullCount;
    return {
      yes: yesCount,
      no: noCount,
      nullCount,
      present,
      absent: noCount,
      checkLater: nullCount,
      total: rows.length,
    };
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

  const renderMemberRow = (r: MemberAttendanceRow) => {
    const entry = entries.get(r.member.id);
    const status = entry?.status ?? null;
    const rsvp = entry?.rsvpStatus ?? null;
    const isSaving = saving.has(r.member.id);
    const avatarBg = voicePartAvatarBg[r.member.voice_part || 'Unassigned'] || 'bg-gray-400';

    let subText: React.ReactNode = null;
    let subClass = '';
    if (status === 'yes') { subText = 'Present'; subClass = 'text-green-600'; }
    else if (status === 'no') { subText = 'Absent'; subClass = 'text-red-600'; }
    else { subText = 'Check later'; subClass = 'text-gray-400'; }

    let rsvpSuffix: React.ReactNode = null;
    const differs =
      (rsvp === 'yes' && status !== 'yes') ||
      (rsvp === 'no' && status !== 'no');
    if (differs) {
      const rsvpLabel = rsvp === 'yes' ? 'Going' : 'Cant come';
      rsvpSuffix = <span className="text-gray-400"> · RSVP: {rsvpLabel}</span>;
    }

    const ariaLabel = status === 'yes'
      ? `Mark ${r.member.first_name} ${r.member.last_name} absent`
      : `Mark ${r.member.first_name} ${r.member.last_name} present`;

    return (
      <li
        key={r.member.id}
        className="px-4 py-3 flex items-center gap-3 bg-white border-b border-gray-100"
      >
        <div
          className={`w-9 h-9 rounded-full ${avatarBg} flex items-center justify-center text-white text-xs font-medium flex-shrink-0`}
        >
          {initialsOf(r.member.first_name, r.member.last_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate">
            {r.member.first_name} {r.member.last_name}
          </div>
          <div className="text-xs mt-0.5">
            <span className={subClass}>{subText}</span>
            {rsvpSuffix}
          </div>
        </div>
        <button
          onClick={() => toggleEntry(r.member.id)}
          disabled={isSaving}
          aria-label={ariaLabel}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer disabled:cursor-wait"
        >
          <span
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isSaving
                ? 'border-2 border-gray-200 border-t-gray-500 animate-spin'
                : status === 'yes'
                  ? 'bg-green-600'
                  : status === 'no'
                    ? 'bg-red-600'
                    : 'bg-white border-2 border-gray-300'
            }`}
          >
            {!isSaving && status === 'yes' && (
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {!isSaving && status === 'no' && (
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {!isSaving && status === null && (
              <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="6" />
              </svg>
            )}
          </span>
        </button>
      </li>
    );
  };

  // ───────────────── selector phase ─────────────────
  if (phase === 'selector') {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Take Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">Choose the event you're running today</p>
        </div>

        {eventsLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{ev.title}</h3>
                        {today && (
                          <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded-full uppercase tracking-wider">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        {ev.time && <span>{formatTime(ev.time)}</span>}
                        {ev.type && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded">
                            {ev.type}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
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
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
        </div>
      );
    }
    return (
      <div className="-m-4 sm:-m-6 lg:-m-8 min-h-[calc(100vh-4rem)] flex flex-col">
        <div className="bg-gray-900 px-6 py-5">
          <div className="text-white text-lg font-semibold">{selectedEvent.title}</div>
          <div className="text-gray-300 text-sm mt-1">{formatLongDate(selectedEvent.date)}{selectedEvent.time ? ` · ${formatTime(selectedEvent.time)}` : ''}</div>
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
      <div className="-m-4 sm:-m-6 lg:-m-8 pb-32">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-gray-900 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setPhase('prompt')}
            aria-label="Back"
            className="text-white p-1 -ml-1 hover:bg-gray-800 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
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

        {/* Search */}
        <div className="bg-white px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300"
            />
            {searchActive && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Headline bar */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-gray-900">{counts.present}</span>
            <span className="text-base text-gray-400">of {counts.total}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {(counts.absent > 0 || counts.checkLater > 0) && (
            <div className="text-xs text-gray-500 mt-1">
              {counts.absent} absent · {counts.checkLater} to check later
            </div>
          )}
        </div>

        {/* Members — flat list when searching, grouped by voice part otherwise */}
        {searchActive ? (
          filteredRows.length === 0 ? (
            <div className="bg-white px-4 py-12 text-center text-sm text-gray-500">
              No members match "{search.trim()}"
            </div>
          ) : (
            <ul>
              {filteredRows.map(renderMemberRow)}
            </ul>
          )
        ) : (
          <div>
            {grouped.map(group => {
              const sectionEntries = group.rows.map(r => entries.get(r.member.id));
              const sectionYes = sectionEntries.filter(e => e?.status === 'yes').length;
              const sectionNo = sectionEntries.filter(e => e?.status === 'no').length;
              const sectionNull = sectionEntries.filter(e => (e?.status ?? null) === null).length;
              const sectionTotal = group.rows.length;
              const isCollapsed = collapsed.has(group.key);

              let summaryNode;
              if (sectionYes === sectionTotal) {
                summaryNode = <span className="text-green-600 text-xs">All here</span>;
              } else if (sectionNo > 0 && sectionNull === 0) {
                summaryNode = <span className="text-red-600 text-xs">{sectionNo} missing</span>;
              } else if (sectionNull > 0) {
                summaryNode = <span className="text-gray-400 text-xs">{sectionNull} to check</span>;
              } else {
                summaryNode = <span className="text-red-600 text-xs">{sectionNo} missing</span>;
              }

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
                    className="w-full bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {group.key}
                      </span>
                      {summaryNode}
                    </div>
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {!isCollapsed && (
                    <ul>
                      {group.rows.map(renderMemberRow)}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Sticky footer */}
        <div
          className="fixed bottom-0 left-0 right-0 bg-gray-900 px-4 py-3 flex justify-between items-center z-30 lg:left-64"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
        >
          <div>
            <div className="text-white font-semibold text-sm">
              {counts.present} of {counts.total}
            </div>
            <div className="text-gray-400 text-xs">{counts.checkLater} to check later</div>
          </div>
          <button
            onClick={() => setShowSaveSheet(true)}
            className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-medium text-sm"
          >
            Save attendance
          </button>
        </div>

        {/* Confirm save bottom sheet */}
        {showSaveSheet && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setShowSaveSheet(false)}
            />
            <div
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl px-6 py-6 z-50"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
            >
              <h3 className="font-semibold text-lg text-gray-900">Save attendance?</h3>
              <p className="text-sm text-gray-500 mt-2">
                {selectedEvent.title} · {counts.checkLater} to check later counted as present.
              </p>
              <button
                onClick={async () => {
                  // Persist null-status (check later) members as 'yes' on save
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
      <div className="-m-4 sm:-m-6 lg:-m-8">
        <div className="bg-gray-900 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/attendance')}
            aria-label="Back"
            className="text-white p-1 -ml-1 hover:bg-gray-800 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
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
            <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${rate}%` }} />
          </div>
          <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
            <div className="text-amber-800 font-medium">{warmMessage}</div>
          </div>
          <div className="mt-6 space-y-2">
            {grouped.map(group => {
              const sectionYes = group.rows.filter(r => (entries.get(r.member.id)?.status ?? null) !== 'no').length;
              const total = group.rows.length;
              const allHere = sectionYes === total;
              return (
                <div key={group.key} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700">{group.key}</span>
                  <span className={`text-sm ${allHere ? 'text-green-600' : 'text-gray-500'}`}>
                    {allHere ? 'All here' : `${sectionYes} of ${total} here`}
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
