import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Calendar, MessageSquare, Heart, Mic, ChevronRight, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export const MemberDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [songsCount, setSongsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [assignmentsCount, setAssignmentsCount] = useState(0);
  const [nextEvent, setNextEvent] = useState<{ title: string; date: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchCounts(); }, [user]);

  const fetchCounts = async () => {
    try {
      const { count: songs } = await supabase.from('songs').select('*', { count: 'exact', head: true });
      setSongsCount(songs || 0);

      if (user?.id) {
        const { count: favs } = await supabase.from('user_favorites').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
        setFavoritesCount(favs || 0);

        // Unread messages
        const { data: allMsgs } = await supabase.from('messages').select('id').or(`send_to.eq.all,send_to.eq.${user.id}`);
        const { data: readData } = await supabase.from('message_reads').select('message_id').eq('user_id', user.id);
        const readIds = new Set(readData?.map(r => r.message_id) || []);
        setMessagesCount((allMsgs || []).filter(m => !readIds.has(m.id)).length);

        // Pending assignments
        const { count: assigns } = await supabase.from('exercise_assignments').select('*', { count: 'exact', head: true }).eq('member_id', user.id).eq('completed', false);
        setAssignmentsCount(assigns || 0);
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: events, count: evCount } = await supabase.from('events').select('title, date', { count: 'exact' }).gte('date', today).order('date').limit(1);
      setEventsCount(evCount || 0);
      if (events?.[0]) setNextEvent(events[0]);
    } catch (e) { console.error('Dashboard fetch error:', e); }
    finally { setLoading(false); }
  };

  const firstName = (user?.name || 'Member').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4 pb-6">

      {/* Greeting */}
      <div className="pt-1">
        <p className="text-[13px] text-gray-500">{greeting}</p>
        <h1 className="text-[22px] font-bold text-gray-900">{firstName} 👋</h1>
      </div>

      {/* Alert cards */}
      {(messagesCount > 0 || assignmentsCount > 0) && (
        <div className="space-y-2">
          {messagesCount > 0 && (
            <button onClick={() => navigate('/member/messages')}
              className="w-full flex items-center gap-3 bg-blue-50 rounded-2xl px-4 py-3 active:scale-[0.98] transition-all">
              <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[13px] font-semibold text-gray-900">{messagesCount} unread message{messagesCount > 1 ? 's' : ''}</p>
                <p className="text-[11px] text-gray-500">From your director</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          )}
          {assignmentsCount > 0 && (
            <button onClick={() => navigate('/member/vocal-coach')}
              className="w-full flex items-center gap-3 bg-purple-50 rounded-2xl px-4 py-3 active:scale-[0.98] transition-all">
              <div className="w-9 h-9 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                <Mic className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[13px] font-semibold text-gray-900">{assignmentsCount} vocal assignment{assignmentsCount > 1 ? 's' : ''}</p>
                <p className="text-[11px] text-gray-500">Practice & submit recordings</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      )}

      {/* Next event */}
      {nextEvent && (
        <button onClick={() => navigate('/member/calendar')}
          className="w-full bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm p-4 active:scale-[0.98] transition-all text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-orange-500 uppercase">
                {new Date(nextEvent.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
              </span>
              <span className="text-[18px] font-bold text-gray-900 leading-none">
                {new Date(nextEvent.date + 'T00:00:00').getDate()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-orange-500 uppercase">Next Event</p>
              <p className="text-[14px] font-semibold text-gray-900 truncate">{nextEvent.title}</p>
              <p className="text-[11px] text-gray-500">{formatDate(nextEvent.date)}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </div>
        </button>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button onClick={() => navigate('/member/repertoire')}
          className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm p-3 text-center active:scale-[0.98] transition-all">
          <Music className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-[18px] font-bold text-gray-900">{loading ? '–' : songsCount}</p>
          <p className="text-[10px] text-gray-500">Songs</p>
        </button>
        <button onClick={() => navigate('/member/calendar')}
          className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm p-3 text-center active:scale-[0.98] transition-all">
          <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-[18px] font-bold text-gray-900">{loading ? '–' : eventsCount}</p>
          <p className="text-[10px] text-gray-500">Events</p>
        </button>
        <button onClick={() => navigate('/member/repertoire?tab=favorites')}
          className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm p-3 text-center active:scale-[0.98] transition-all">
          <Heart className="w-5 h-5 text-red-500 mx-auto mb-1" />
          <p className="text-[18px] font-bold text-gray-900">{loading ? '–' : favoritesCount}</p>
          <p className="text-[10px] text-gray-500">Favorites</p>
        </button>
      </div>

      {/* Menu list */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
        {[
          { label: 'Repertoire', sub: `${songsCount} songs`, icon: Music, color: 'text-purple-500 bg-purple-50', route: '/member/repertoire' },
          { label: 'Calendar', sub: `${eventsCount} upcoming`, icon: Calendar, color: 'text-blue-500 bg-blue-50', route: '/member/calendar' },
          { label: 'Messages', sub: messagesCount > 0 ? `${messagesCount} unread` : 'All read', icon: MessageSquare, color: 'text-green-500 bg-green-50', route: '/member/messages', badge: messagesCount },
          { label: 'Vocal Coach', sub: assignmentsCount > 0 ? `${assignmentsCount} pending` : 'No assignments', icon: Mic, color: 'text-purple-500 bg-purple-50', route: '/member/vocal-coach', badge: assignmentsCount },
          { label: 'Favorites', sub: `${favoritesCount} saved`, icon: Heart, color: 'text-red-500 bg-red-50', route: '/member/repertoire?tab=favorites' },
        ].map((item, i, arr) => {
          const Icon = item.icon;
          return (
            <button key={item.label} onClick={() => navigate(item.route)}
              className={`w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-all ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900">{item.label}</p>
                <p className="text-[11px] text-gray-500">{item.sub}</p>
              </div>
              {item.badge ? (
                <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              ) : null}
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
