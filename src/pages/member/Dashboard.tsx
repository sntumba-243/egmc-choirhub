import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Calendar, MessageSquare, Heart, Mic, ChevronRight, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../contexts/ChurchContext';
import { supabase } from '../../lib/supabase';

export const MemberDashboard = () => {
  const { user } = useAuth();
  const { church } = useChurch();
  const navigate = useNavigate();

  const [songsCount, setSongsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [assignmentsCount, setAssignmentsCount] = useState(0);
  const [nextEvent, setNextEvent] = useState<{ title: string; date: string; time?: string; location?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchCounts(); }, [user?.church_id]);

  const getAuthUid = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  };

  const fetchCounts = async () => {
    try {
      const authUid = await getAuthUid();

      const { count: songs } = await supabase.from('songs').select('*', { count: 'exact', head: true });
      setSongsCount(songs || 0);

      if (user?.id) {
        // user_favorites uses auth.uid()
        if (authUid) {
          const { count: favs } = await supabase.from('user_favorites').select('*', { count: 'exact', head: true }).eq('user_id', authUid);
          setFavoritesCount(favs || 0);
        }

        // Unread messages
        const { data: allMsgs } = await supabase.from('messages').select('id, send_to, is_read').eq('church_id', user?.church_id);
        const myMsgs = (allMsgs || []).filter(m => m.send_to === 'all' || m.send_to === user.id);
        setMessagesCount(myMsgs.filter(m => !m.is_read).length);

        // Assignments use members.id
        const { count: assigns } = await supabase.from('exercise_assignments').select('*', { count: 'exact', head: true }).eq('member_id', user.id);
        setAssignmentsCount(assigns || 0);
      }
      const today = new Date().toISOString().split('T')[0];
      const { data: events, count: evCount } = await supabase
        .from('events')
        .select('title, date, time, location', { count: 'exact' })
        .or(`church_id.eq.${user?.church_id},is_global.eq.true`)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(1);
      setEventsCount(evCount || 0);
      if (events?.[0]) setNextEvent(events[0]);
      if (events?.[0]) setNextEvent(events[0]);
    } catch (e) { console.error('Dashboard fetch error:', e); }
    finally { setLoading(false); }
  };

  const firstName = (user?.name || 'Member').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const parseDate = (d: string) => {
    if (!d) return new Date();
    // Handle both "2026-02-28" and "2026-02-28T16:00:00+00:00"
    if (d.includes('T')) return new Date(d);
    return new Date(d + 'T00:00:00');
  };

  const formatEventDate = (d: string) => {
    const date = parseDate(d);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getEventMonth = (d: string) => parseDate(d).toLocaleDateString('en-US', { month: 'short' });
  const getEventDay = (d: string) => parseDate(d).getDate();

  const formatTime = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  const v = (n: number) => loading ? '–' : n;

  return (
    <div className="space-y-4 pb-8">
      

        {/* Greeting */}
        <div className="pt-1">
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#c47a30' }}>
            {greeting}
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#2c1810', marginTop: '2px' }}>
            {firstName} 👋
          </h1>
        </div>

        {/* Alert pills */}
        {(messagesCount > 0 || assignmentsCount > 0) && (
          <div className="space-y-2">
            {messagesCount > 0 && (
              <button onClick={() => navigate('/member/messages')}
                className="w-full flex items-center gap-3 active:scale-[0.98] transition-all"
                style={{ background: '#FFF5EB', border: '1px solid #FFE0C4', borderRadius: '16px', padding: '12px 16px' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#FF6B35', animation: 'pulse 2s infinite' }} />
                <span className="flex-1 text-left" style={{ fontSize: '13px', color: '#5a3a1e', fontWeight: 600 }}>
                  {messagesCount} unread message{messagesCount > 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'white', background: '#FF6B35', borderRadius: '10px', padding: '2px 9px' }}>
                  {messagesCount}
                </span>
              </button>
            )}
            {assignmentsCount > 0 && (
              <button onClick={() => navigate('/member/vocal-coach')}
                className="w-full flex items-center gap-3 active:scale-[0.98] transition-all"
                style={{ background: '#F5F3FF', border: '1px solid #E9E5FF', borderRadius: '16px', padding: '12px 16px' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#7C3AED', animation: 'pulse 2s infinite' }} />
                <span className="flex-1 text-left" style={{ fontSize: '13px', color: '#3B1F7E', fontWeight: 600 }}>
                  {assignmentsCount} vocal assignment{assignmentsCount > 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'white', background: '#7C3AED', borderRadius: '10px', padding: '2px 9px' }}>
                  {assignmentsCount}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Hero Event Card */}
        {nextEvent && (
          <button onClick={() => navigate('/member/calendar')}
            className="w-full text-left active:scale-[0.98] transition-all relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #FF8C42 0%, #FF6B35 50%, #E85D26 100%)',
              borderRadius: '22px', padding: '20px', color: 'white',
            }}>
            <div className="absolute rounded-full" style={{ top: '-30px', right: '-30px', width: '110px', height: '110px', background: 'rgba(255,255,255,0.1)' }} />
            <div className="absolute rounded-full" style={{ bottom: '-20px', left: '-20px', width: '80px', height: '80px', background: 'rgba(255,255,255,0.06)' }} />
            <p style={{ fontSize: '10px', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>Next Event</p>
            <p className="relative z-10" style={{ fontSize: '19px', fontWeight: 700, margin: '6px 0 4px' }}>{nextEvent.title}</p>
            <p className="relative z-10" style={{ fontSize: '12px', opacity: 0.9 }}>{formatEventDate(nextEvent.date)}{nextEvent.time ? ` · ${formatTime(nextEvent.time)}` : ''}{nextEvent.location ? ` · ${nextEvent.location}` : ''}</p>
            <div className="absolute flex items-center justify-center"
              style={{ bottom: '18px', right: '18px', width: '34px', height: '34px', background: 'rgba(255,255,255,0.18)', borderRadius: '50%' }}>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Music, num: v(songsCount), label: 'Songs', bg: '#F3E8FF', color: '#a855f7', route: '/member/repertoire' },
            { icon: Calendar, num: v(eventsCount), label: 'Events', bg: '#DBEAFE', color: '#3b82f6', route: '/member/calendar' },
            { icon: Heart, num: v(favoritesCount), label: 'Favorites', bg: '#FEE2E2', color: '#ef4444', route: '/member/repertoire?tab=favorites' },
          ].map((s) => (
            <button key={s.label} onClick={() => navigate(s.route)}
              className="active:scale-[0.96] transition-all"
              style={{
                background: 'white', borderRadius: '18px', padding: '14px 10px',
                textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.03)',
              }}>
              <div className="mx-auto flex items-center justify-center"
                style={{ width: '36px', height: '36px', borderRadius: '12px', background: s.bg, fontSize: '16px', marginBottom: '6px' }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <p style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a1a' }}>{s.num}</p>
              <p style={{ fontSize: '10px', color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '1px' }}>{s.label}</p>
            </button>
          ))}
        </div>

        {/* Quick Access - Bento Grid */}
        <div>
          <p style={{ fontSize: '11px', color: '#aaa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px', paddingLeft: '4px' }}>
            Quick Access
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: Music, label: 'Repertoire', sub: `${v(songsCount)} songs`, bg: '#F3E8FF', color: '#a855f7', route: '/member/repertoire' },
              { icon: Calendar, label: 'Calendar', sub: `${v(eventsCount)} upcoming`, bg: '#DBEAFE', color: '#3b82f6', route: '/member/calendar' },
              { icon: MessageSquare, label: 'Messages', sub: messagesCount > 0 ? `${messagesCount} unread` : 'All read', bg: '#DCFCE7', color: '#22c55e', route: '/member/messages', badge: messagesCount },
              { icon: Mic, label: 'Vocal Coach', sub: assignmentsCount > 0 ? `${assignmentsCount} pending` : 'No assignments', bg: '#FEF3C7', color: '#f59e0b', route: '/member/vocal-coach', badge: assignmentsCount },
              { icon: Heart, label: 'Favorites', sub: `${v(favoritesCount)} saved`, bg: '#FEE2E2', color: '#ef4444', route: '/member/repertoire?tab=favorites' },
              { icon: Settings, label: 'Profile', sub: 'Settings', bg: '#F0FDF4', color: '#22c55e', route: '/member/profile' },
            ].map((item) => (
              <button key={item.label} onClick={() => navigate(item.route)}
                className="relative flex items-center gap-3 text-left active:scale-[0.97] transition-all"
                style={{
                  background: 'white', borderRadius: '18px', padding: '16px 14px',
                  border: '1px solid rgba(0,0,0,0.03)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                }}>
                <div className="flex items-center justify-center flex-shrink-0"
                  style={{ width: '42px', height: '42px', borderRadius: '14px', background: item.bg, fontSize: '18px' }}>
                  <item.icon className="w-5 h-5" style={{ color: item.bg === '#F3E8FF' ? '#a855f7' : item.bg === '#DBEAFE' ? '#3b82f6' : item.bg === '#DCFCE7' ? '#22c55e' : item.bg === '#FEF3C7' ? '#f59e0b' : item.bg === '#FEE2E2' ? '#ef4444' : '#22c55e' }} />
                </div>
                <div className="min-w-0">
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>{item.label}</p>
                  <p style={{ fontSize: '10px', color: '#999', fontWeight: 500, marginTop: '1px' }}>{item.sub}</p>
                </div>
                {item.badge ? (
                  <span className="absolute flex items-center justify-center"
                    style={{ top: '10px', right: '10px', fontSize: '10px', fontWeight: 700, color: 'white', background: '#ef4444', borderRadius: '8px', padding: '1px 7px', minWidth: '20px' }}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>


      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};
