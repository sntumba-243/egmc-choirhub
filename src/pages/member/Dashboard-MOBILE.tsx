import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Music, Calendar, MessageSquare, Heart, Mic, ChevronRight } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
}

export const MemberDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [songsCount, setSongsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [assignmentsCount, setAssignmentsCount] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [memberName, setMemberName] = useState('');
  const [voicePart, setVoicePart] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) { fetchCounts(); fetchProfile(); } }, [user]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('members').select('first_name, last_name, voice_part').eq('id', user.id).single();
    if (data) { setMemberName(data.first_name || ''); setVoicePart(data.voice_part || ''); }
  };

  const fetchCounts = async () => {
    try {
      const { count: songs } = await supabase.from('songs').select('*', { count: 'exact', head: true });
      setSongsCount(songs || 0);

      if (user?.id) {
        const { count: favs } = await supabase.from('user_favorites').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
        setFavoritesCount(favs || 0);

        const { data: allMsgs } = await supabase.from('messages').select('id, send_to, is_read');
        const myMsgs = (allMsgs || []).filter(m => m.send_to === 'all' || m.send_to === user.id);
        setMessagesCount(myMsgs.filter(m => !m.is_read).length);

        const { count: assigns } = await supabase.from('exercise_assignments').select('*', { count: 'exact', head: true }).eq('member_id', user.id).eq('completed', false);
        setAssignmentsCount(assigns || 0);
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: events, count: evCount } = await supabase
        .from('events').select('id, title, date, time, location', { count: 'exact' })
        .gte('date', today).order('date', { ascending: true }).limit(3);
      setEventsCount(evCount || 0);
      setUpcomingEvents(events || []);
    } catch (e) { console.error('Dashboard fetch error:', e); }
    finally { setLoading(false); }
  };

  const firstName = memberName || 'Member';
  const initial = firstName.charAt(0).toUpperCase();
  const partColors: Record<string, string> = {
    soprano: 'from-pink-400 to-pink-600', alto: 'from-purple-400 to-purple-600',
    tenor: 'from-blue-400 to-blue-600', bass: 'from-green-400 to-green-600',
    instrumentalist: 'from-orange-400 to-orange-600',
  };
  const avatarGradient = partColors[voicePart?.toLowerCase()] || 'from-orange-400 to-orange-600';

  const formatTime = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return m ? `${hour}:${m.toString().padStart(2, '0')} ${ampm}` : `${hour} ${ampm}`;
  };

  const formatEventDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) return (
    <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" /></div>
  );

  const menuItems = [
    { label: 'Repertoire', sub: `${songsCount} songs`, icon: Music, iconBg: 'bg-purple-100', iconColor: 'text-purple-600', route: '/member/repertoire', badge: 0 },
    { label: 'Events', sub: `${eventsCount} upcoming`, icon: Calendar, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', route: '/member/calendar', badge: 0 },
    { label: 'Messages', sub: messagesCount > 0 ? `${messagesCount} unread` : 'All read', icon: MessageSquare, iconBg: 'bg-green-100', iconColor: 'text-green-600', route: '/member/messages', badge: messagesCount },
    { label: 'Vocal Coach', sub: assignmentsCount > 0 ? `${assignmentsCount} pending` : 'No assignments', icon: Mic, iconBg: 'bg-orange-100', iconColor: 'text-orange-600', route: '/member/vocal-coach', badge: assignmentsCount },
    { label: 'Favorites', sub: `${favoritesCount} saved`, icon: Heart, iconBg: 'bg-red-100', iconColor: 'text-red-600', route: '/member/repertoire?tab=favorites', badge: 0 },
  ];

  return (
    <div className="space-y-5 pb-8">

      {/* Greeting */}
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-lg font-extrabold shadow-sm flex-shrink-0`}>
          {initial}
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-gray-900">Hi {firstName}! 🎶</h1>
          <p className="text-xs text-gray-400 font-semibold">
            {voicePart ? voicePart.charAt(0).toUpperCase() + voicePart.slice(1) : 'Member'} · EGMC Choir
          </p>
        </div>
      </div>

      {/* Notification banners — only when action needed */}
      {(messagesCount > 0 || assignmentsCount > 0) && (
        <div className="space-y-2">
          {messagesCount > 0 && (
            <button onClick={() => navigate('/member/messages')}
              className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-2.5 bg-blue-50 border border-blue-100 active:scale-[0.98] transition-all text-left">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="flex-1 text-[13px] font-semibold text-gray-800">{messagesCount} unread message{messagesCount > 1 ? 's' : ''}</p>
              <ChevronRight className="w-4 h-4 text-blue-300" />
            </button>
          )}
          {assignmentsCount > 0 && (
            <button onClick={() => navigate('/member/vocal-coach')}
              className="w-full flex items-center gap-3 rounded-2xl px-3.5 py-2.5 bg-orange-50 border border-orange-100 active:scale-[0.98] transition-all text-left">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                <Mic className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="flex-1 text-[13px] font-semibold text-gray-800">{assignmentsCount} vocal assignment{assignmentsCount > 1 ? 's' : ''}</p>
              <ChevronRight className="w-4 h-4 text-orange-300" />
            </button>
          )}
        </div>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Upcoming</p>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {upcomingEvents.map((event, i) => (
              <button key={event.id} onClick={() => navigate(`/member/events/${event.id}`)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-gray-50 transition-all ${i < upcomingEvents.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-indigo-500 uppercase leading-none">
                    {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-[16px] font-extrabold text-gray-900 leading-none">
                    {new Date(event.date + 'T00:00:00').getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">{event.title}</p>
                  <p className="text-xs text-gray-400">
                    {formatEventDate(event.date)}{event.time ? ` · ${formatTime(event.time)}` : ''}{event.location ? ` · ${event.location}` : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Menu</p>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {menuItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <button key={item.label} onClick={() => navigate(item.route)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-gray-50 transition-all ${i < menuItems.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.iconBg}`}>
                  <Icon className={`w-4 h-4 ${item.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.sub}</p>
                </div>
                {item.badge > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-200" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {!loading && upcomingEvents.length === 0 && messagesCount === 0 && assignmentsCount === 0 && (
        <div className="text-center py-6">
          <span className="text-3xl">✨</span>
          <p className="text-[13px] font-semibold text-gray-900 mt-2">You're all caught up!</p>
          <p className="text-xs text-gray-400 mt-0.5">No tasks or events right now</p>
        </div>
      )}

      {/* Scripture */}
      <div className="text-center px-4 pt-2 pb-4">
        <p className="text-[12px] text-gray-400 italic leading-relaxed">"Enter into His gates with thanksgiving, and into His courts with praise. Be thankful to Him, and bless His name."</p>
        <p className="text-xs text-gray-300 font-semibold mt-1">— Psalm 100:4</p>
      </div>
    </div>
  );
};
