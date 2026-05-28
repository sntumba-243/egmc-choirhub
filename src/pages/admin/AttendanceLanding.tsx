import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Calendar, BarChart3 } from 'lucide-react';
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

const formatTodayHuman = () => {
  const d = new Date();
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
};

const hexWithAlpha = (hex: string, alpha: number) => {
  const h = hex.replace('#', '');
  const expanded = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${expanded}${a}`;
};

export default function AttendanceLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { church } = useChurch();
  const churchId = user?.church_id || church?.id;

  const primary = church?.primary_color ?? '#185FA5';
  const secondary = church?.secondary_color ?? '#0C447C';
  const accent = church?.accent_color ?? '#f59e0b';

  const [events, setEvents] = useState<EventLite[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceInfo>>(new Map());
  const [sectionStats, setSectionStats] = useState<SectionStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!churchId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Active members (exclude guests)
        const { data: members } = await supabase
          .from('members')
          .select('id, voice_part')
          .eq('church_id', churchId)
          .in('role', ['admin', 'member', 'section_leader']);
        const memberList = members || [];
        const totalActive = memberList.length;

        // Recent events — 7 most recent for this church (incl. globals)
        const { data: evData } = await supabase
          .from('events')
          .select('id, title, date, time, type, location')
          .or(`church_id.eq.${churchId},is_global.eq.true`)
          .order('date', { ascending: false })
          .limit(7);
        if (cancelled) return;
        const recent: EventLite[] = evData || [];
        setEvents(recent);

        const eventIds = recent.map(e => e.id);
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
        for (const e of recent) {
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

        // Section breakdown across last 4 events
        const last4Ids = new Set(recent.slice(0, 4).map(e => e.id));
        const sections = new Map<string, { present: number; total: number }>();
        for (const vp of SECTION_ORDER) sections.set(vp, { present: 0, total: 0 });

        for (const m of memberList) {
          const vp = m.voice_part || '';
          if (!SECTION_ORDER.includes(vp)) continue;
          sections.get(vp)!.total += last4Ids.size;
        }
        const memberById = new Map(memberList.map(m => [m.id, m]));
        for (const r of attRows) {
          if (!last4Ids.has(r.event_id)) continue;
          if (r.status !== 'yes') continue;
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
  }, [churchId]);

  const today = todayYMD();
  const todayEvent = events.find(e => e.date === today) || null;
  const recentEvents = events;
  const snapshotEvents = events.slice(0, 4);

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      {/* Header */}
      <div
        className="px-5 py-4"
        style={{ background: `var(--church-primary, ${primary})` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-white font-medium" style={{ fontSize: '18px' }}>Attendance</h1>
            <p className="text-sm text-white opacity-60 truncate">
              {church?.short_name || church?.name || 'ChoirHub'}
            </p>
          </div>
          <div className="text-sm text-white opacity-50 whitespace-nowrap pt-1">
            {formatTodayHuman()}
          </div>
        </div>
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-0">
        {/* LEFT COLUMN — Today + recent events */}
        <div>
          {/* Today card */}
          <div className="px-3 pt-3">
            {loading ? (
              <div
                className="rounded-xl animate-pulse"
                style={{ background: hexWithAlpha(primary, 0.12), height: 116 }}
              />
            ) : todayEvent ? (
              (() => {
                const info = attendanceMap.get(todayEvent.id);
                const taken = info?.taken ?? false;
                return (
                  <div
                    className="rounded-xl px-5 py-4"
                    style={{ background: `var(--church-secondary, ${secondary})` }}
                  >
                    <div className="text-xs uppercase tracking-wider text-white opacity-60">
                      Today
                    </div>
                    <div className="text-lg font-medium text-white mt-1">{todayEvent.title}</div>
                    <div className="text-sm text-white opacity-70 mt-1">
                      {formatTime(todayEvent.time)}
                      {todayEvent.location ? ` · ${todayEvent.location}` : ''}
                    </div>
                    <div className="flex items-center justify-between mt-3 gap-3">
                      <div className="text-xs text-white opacity-50">
                        {taken
                          ? `${info?.present ?? 0} of ${info?.total ?? 0} present`
                          : 'attendance not yet taken'}
                      </div>
                      <button
                        onClick={() => navigate(`/admin/attendance/take/${todayEvent.id}`)}
                        className="text-sm font-medium text-white px-4 py-2 rounded-lg whitespace-nowrap"
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none' }}
                      >
                        Take attendance →
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div
                className="rounded-xl px-5 py-4 border"
                style={{ borderColor: hexWithAlpha(primary, 0.2), background: hexWithAlpha(primary, 0.04) }}
              >
                <div className="text-sm font-medium text-gray-700">No event scheduled today</div>
                <button
                  onClick={() => recentEvents.length > 0 && navigate(`/admin/attendance/take/${recentEvents[0].id}`)}
                  className="text-xs font-medium mt-1"
                  style={{ color: `var(--church-primary, ${primary})` }}
                >
                  Take attendance for a past event →
                </button>
              </div>
            )}
          </div>

          {/* Recent events */}
          <div className="px-3 mt-5">
            <div
              className="text-xs uppercase tracking-wider mb-2 px-1 font-medium"
              style={{ color: `var(--church-primary, ${primary})`, opacity: 0.7 }}
            >
              Recent events
            </div>

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : recentEvents.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: hexWithAlpha(primary, 0.1) }}
                >
                  <Calendar className="w-6 h-6" style={{ color: `var(--church-primary, ${primary})` }} />
                </div>
                <div className="text-sm font-medium text-gray-900">No events yet</div>
                <button
                  onClick={() => navigate('/admin/events')}
                  className="text-xs font-medium mt-2"
                  style={{ color: `var(--church-primary, ${primary})` }}
                >
                  Create your first event →
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {recentEvents.map(ev => {
                  const info = attendanceMap.get(ev.id);
                  const taken = info?.taken ?? false;
                  return (
                    <li key={ev.id}>
                      <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center flex-col flex-shrink-0"
                          style={{
                            background: hexWithAlpha(primary, 0.1),
                            color: `var(--church-primary, ${primary})`,
                          }}
                        >
                          <div className="text-xl font-medium leading-none">{dayNumber(ev.date)}</div>
                          <div className="text-[9px] font-semibold tracking-wider mt-0.5">{monthShort(ev.date)}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{ev.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {formatTime(ev.time)}
                            {ev.location ? ` · ${ev.location}` : ''}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {taken ? (
                            <span
                              className="text-[11px] font-medium rounded-full"
                              style={{
                                background: hexWithAlpha(accent, 0.15),
                                color: `var(--church-accent, ${accent})`,
                                padding: '2px 8px',
                              }}
                            >
                              {info?.present ?? 0}/{info?.total ?? 0}
                            </span>
                          ) : (
                            <button
                              onClick={() => navigate(`/admin/attendance/take/${ev.id}`)}
                              className="text-xs font-medium"
                              style={{ color: `var(--church-primary, ${primary})` }}
                            >
                              Take →
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* View stats link */}
          <div className="px-3 mt-5">
            <button
              onClick={() => navigate('/admin/attendance/stats')}
              className="w-full bg-gray-50 hover:bg-gray-100 rounded-xl p-4 flex items-center justify-between transition-colors"
            >
              <div className="text-left">
                <div className="text-sm font-medium text-gray-700">Attendance statistics</div>
                <div className="text-xs text-gray-400 mt-0.5">Regulars, follow-up, trends</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </button>
          </div>

          <div className="h-8" />
        </div>

        {/* RIGHT COLUMN — Snapshot (tablet+) */}
        <div className="hidden md:block border-l border-gray-100 bg-gray-50/40 min-h-full">
          <div className="px-4 pt-4">
            <div
              className="text-xs uppercase tracking-wider mb-3 font-medium"
              style={{ color: `var(--church-primary, ${primary})`, opacity: 0.7 }}
            >
              Snapshot
            </div>

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : snapshotEvents.length === 0 ? (
              <div className="text-xs text-gray-400">No recent attendance to show.</div>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {snapshotEvents.map(ev => {
                    const info = attendanceMap.get(ev.id);
                    const taken = info?.taken ?? false;
                    const pct = info && info.total > 0 ? Math.round((info.present / info.total) * 100) : 0;
                    return (
                      <li key={ev.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-medium text-gray-900 truncate">{ev.title}</div>
                          {taken ? (
                            <span
                              className="text-[11px] font-medium rounded-full whitespace-nowrap"
                              style={{
                                background: hexWithAlpha(accent, 0.15),
                                color: `var(--church-accent, ${accent})`,
                                padding: '1px 7px',
                              }}
                            >
                              {info?.present}/{info?.total}
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-400 whitespace-nowrap">Not taken</span>
                          )}
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${taken ? pct : 0}%`,
                              background: `var(--church-primary, ${primary})`,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {sectionStats.length > 0 && (
                  <div className="mt-5">
                    <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-2 font-medium">
                      By voice part · last {Math.min(snapshotEvents.length, 4)}
                    </div>
                    <ul className="space-y-2">
                      {sectionStats.map(s => {
                        const colors = voicePartBar[s.voicePart] || voicePartBar.Soprano;
                        const pct = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0;
                        return (
                          <li key={s.voicePart}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className={`font-medium ${colors.text}`}>{s.voicePart}</span>
                              <span className="text-gray-500">{pct}%</span>
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
                  </div>
                )}

                <button
                  onClick={() => navigate('/admin/attendance/stats')}
                  className="w-full mt-5 text-xs font-medium flex items-center justify-center gap-1"
                  style={{ color: `var(--church-primary, ${primary})` }}
                >
                  View full stats <BarChart3 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
