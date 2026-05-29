import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../contexts/ChurchContext';

interface EventLite {
  id: string;
  title: string;
  date: string;
  time: string;
  type?: string | null;
  location?: string | null;
}

interface AttendanceInfo {
  present: number;
  total: number;
  taken: boolean;
}

interface SectionStat {
  voicePart: string;
  present: number;
  total: number;
}

const SECTION_ORDER = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Instrumentalist'];

const voicePartBar: Record<string, { fill: string; track: string; text: string }> = {
  Soprano:        { fill: 'bg-pink-500',   track: 'bg-pink-50',   text: 'text-pink-600' },
  Alto:           { fill: 'bg-purple-500', track: 'bg-purple-50', text: 'text-purple-600' },
  Tenor:          { fill: 'bg-blue-500',   track: 'bg-blue-50',   text: 'text-blue-600' },
  Bass:           { fill: 'bg-green-500',  track: 'bg-green-50',  text: 'text-green-600' },
  Instrumentalist:{ fill: 'bg-orange-500', track: 'bg-orange-50', text: 'text-orange-600' },
};

const todayYMD = () => {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
};

const dayNumber = (dateStr: string) =>
  new Date(dateStr + 'T00:00:00').getDate();

const monthShort = (dateStr: string) =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

const formatTime = (t?: string | null) => {
  if (!t) return '';
  const [hh, mm] = t.split(':');
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 || 12;
  return `${display}:${mm} ${ampm}`;
};

const formatHeaderDate = () => {
  const d = new Date();
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
};

function getContrastText(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.35 ? '#1a1a1a' : '#ffffff';
}

export default function AttendanceLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { church } = useChurch();
  const churchId = user?.church_id || church?.id;

  const primary = church?.primary_color ?? '#185FA5';
  const headerText = getContrastText(primary);

  const [events, setEvents] = useState<EventLite[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceInfo>>(new Map());
  const [sectionStats, setSectionStats] = useState<SectionStat[]>([]);
  const [monthTotals, setMonthTotals] = useState<{ present: number; possible: number; eventCount: number }>({
    present: 0,
    possible: 0,
    eventCount: 0,
  });
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!churchId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: members } = await supabase
          .from('members')
          .select('id, voice_part')
          .eq('church_id', churchId)
          .in('role', ['admin', 'member', 'section_leader']);
        const memberList = members || [];
        const totalActive = memberList.length;
        if (cancelled) return;
        setMemberCount(totalActive);

        const { data: evData } = await supabase
          .from('events')
          .select('id, title, date, time, type, location')
          .or(`church_id.eq.${churchId},is_global.eq.true`)
          .order('date', { ascending: false })
          .limit(20);
        if (cancelled) return;
        const recent: EventLite[] = evData || [];

        // Auto-redirect if there is an event today
        const today = todayYMD();
        const todayEvent = recent.find(e => e.date === today);
        if (todayEvent) {
          if (cancelled) return;
          setRedirecting(true);
          navigate(`/admin/attendance/take/${todayEvent.id}`, { replace: true });
          return;
        }

        const sevenMostRecent = recent
          .slice(0, 7)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEvents(sevenMostRecent);

        const eventIds = sevenMostRecent.map(e => e.id);
        let attRows: Array<{ event_id: string; member_id: string; status: string }> = [];
        if (eventIds.length > 0) {
          const { data } = await supabase
            .from('attendance_history')
            .select('event_id, member_id, status')
            .eq('church_id', churchId)
            .in('event_id', eventIds);
          attRows = data || [];
        }

        const map = new Map<string, AttendanceInfo>();
        for (const e of sevenMostRecent) {
          map.set(e.id, { present: 0, total: totalActive, taken: false });
        }
        for (const r of attRows) {
          const entry = map.get(r.event_id);
          if (!entry) continue;
          entry.taken = true;
          if (r.status === 'yes') entry.present++;
        }
        if (cancelled) return;
        setAttendanceMap(map);

        // This-month totals from recent events
        const now = new Date();
        const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthEvents = recent.filter(e => e.date.startsWith(monthPrefix));
        const monthIds = new Set(monthEvents.map(e => e.id));

        let monthPresent = 0;
        for (const r of attRows) {
          if (!monthIds.has(r.event_id)) continue;
          if (r.status === 'yes') monthPresent++;
        }
        const monthPossible = totalActive * monthEvents.length;
        if (cancelled) return;
        setMonthTotals({ present: monthPresent, possible: monthPossible, eventCount: monthEvents.length });

        // Section breakdown for this month
        const memberById = new Map(memberList.map(m => [m.id, m]));
        const sections = new Map<string, { present: number; total: number }>();
        for (const vp of SECTION_ORDER) sections.set(vp, { present: 0, total: 0 });
        for (const m of memberList) {
          const vp = m.voice_part || '';
          if (!SECTION_ORDER.includes(vp)) continue;
          sections.get(vp)!.total += monthEvents.length;
        }
        for (const r of attRows) {
          if (!monthIds.has(r.event_id) || r.status !== 'yes') continue;
          const m = memberById.get(r.member_id);
          if (!m) continue;
          const vp = m.voice_part || '';
          if (!SECTION_ORDER.includes(vp)) continue;
          sections.get(vp)!.present++;
        }
        if (cancelled) return;
        setSectionStats(
          SECTION_ORDER
            .map(vp => ({ voicePart: vp, ...sections.get(vp)! }))
            .filter(s => s.total > 0)
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [churchId, navigate]);

  if (redirecting) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-700" />
      </div>
    );
  }

  const monthRate = monthTotals.possible > 0
    ? Math.round((monthTotals.present / monthTotals.possible) * 100)
    : 0;

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      {/* Header */}
      <div
        style={{
          background: `var(--church-primary, ${primary})`,
          paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 18,
        }}
      >
        <div className="text-sm" style={{ color: headerText, opacity: 0.6 }}>
          {church?.short_name || church?.name || 'ChoirHub'}
        </div>
        <h1
          className="text-2xl font-semibold tracking-tight mt-0.5"
          style={{ color: headerText }}
        >
          Attendance
        </h1>
        <div className="text-sm mt-1" style={{ color: headerText, opacity: 0.4 }}>
          {formatHeaderDate()}
        </div>
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-0">
        {/* LEFT — no event card + recent events + stats link */}
        <div>
          {/* No event today card */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mx-3 mt-3">
            <div className="text-base font-medium text-gray-700">No rehearsal today</div>
            <button
              onClick={() => navigate('/admin/attendance/take')}
              className="text-sm mt-1 block py-3 min-h-[44px]"
              style={{ color: primary }}
            >
              Take attendance for a past event →
            </button>
          </div>

          {/* Recent events */}
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-5 pt-5 pb-2">
            Recent events
          </div>

          {loading ? (
            <div className="px-3 space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="px-5 py-8 text-sm text-gray-400">No past events yet.</div>
          ) : (
            <ul>
              {events.map(ev => {
                const info = attendanceMap.get(ev.id);
                const taken = info?.taken ?? false;
                const rate = info && info.total > 0
                  ? Math.round((info.present / info.total) * 100)
                  : 0;
                const badgeClass = !taken
                  ? ''
                  : rate >= 80
                    ? 'bg-green-50 text-green-700'
                    : 'bg-orange-50 text-orange-700';
                return (
                  <li
                    key={ev.id}
                    onClick={() => navigate(`/admin/attendance/take/${ev.id}`)}
                    className="min-h-[60px] flex items-center gap-4 px-5 py-3 border-b border-gray-100 cursor-pointer active:bg-gray-50"
                  >
                    <div className="min-w-[36px] flex flex-col items-center">
                      <div className="text-xl font-semibold text-gray-900 tracking-tight leading-none">
                        {dayNumber(ev.date)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">
                        {monthShort(ev.date)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{ev.title}</div>
                      <div className="text-xs text-gray-400 mt-1 truncate">
                        {formatTime(ev.time)}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {taken ? (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badgeClass}`}>
                          {info?.present} / {info?.total}
                        </span>
                      ) : (
                        <span
                          className="text-xs font-medium"
                          style={{ color: primary }}
                        >
                          Take →
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Stats link */}
          <div
            onClick={() => navigate('/admin/attendance/stats')}
            className="min-h-[60px] flex items-center justify-between px-5 py-4 border-t border-gray-100 cursor-pointer active:bg-gray-50"
          >
            <div>
              <div className="text-sm font-medium text-gray-900">Choir health</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Statistics · {memberCount} member{memberCount === 1 ? '' : 's'}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </div>

        {/* RIGHT — snapshot card (tablet+) */}
        <div className="hidden md:block">
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 m-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
              This month
            </div>
            {loading ? (
              <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ) : monthTotals.possible === 0 ? (
              <div className="text-sm text-gray-400">No events recorded yet this month.</div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-semibold tracking-tight text-gray-900">
                    {monthTotals.present}
                  </span>
                  <span className="text-lg text-gray-400">/ {monthTotals.possible}</span>
                </div>
                <div className="h-1 bg-gray-200 rounded-full mt-3 mb-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${monthRate}%`, background: `var(--church-primary, ${primary})` }}
                  />
                </div>
                <div className="text-xs text-gray-400">
                  {monthRate}% attendance · {monthTotals.eventCount} rehearsal{monthTotals.eventCount === 1 ? '' : 's'}
                </div>

                {sectionStats.length > 0 && (
                  <>
                    <hr className="my-4 border-gray-100" />
                    <ul className="space-y-2.5">
                      {sectionStats.map(s => {
                        const colors = voicePartBar[s.voicePart];
                        const pct = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0;
                        return (
                          <li key={s.voicePart}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className={`font-medium ${colors.text}`}>{s.voicePart}</span>
                              <span className="text-gray-400">{s.present} / {s.total}</span>
                            </div>
                            <div className={`h-1.5 rounded-full overflow-hidden ${colors.track}`}>
                              <div
                                className={`h-full ${colors.fill} transition-all duration-300`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}

                <button
                  onClick={() => navigate('/admin/attendance/stats')}
                  className="w-full mt-5 text-xs font-medium text-left min-h-[44px] flex items-center"
                  style={{ color: primary }}
                >
                  View full choir health →
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
