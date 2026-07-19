import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getAuthUid } from '../../lib/authUid';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, Music, Calendar, MessageSquare, TrendingUp, TrendingDown, 
  Plus, Mail, AlertTriangle, Bell
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useChurch } from '../../contexts/ChurchContext';

interface Stats {
  totalMembers: number;
  totalSongs: number;
  upcomingEvents: number;
  totalMessages: number;
  membersTrend: number;
  songsTrend: number;
  eventsTrend: number;
  messagesTrend: number;
}

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  rsvp_count?: number;
}

interface Alert {
  id: string;
  type: "warning" | "info";
  message: string;
  action: string;
  actionLabel: string;
  eventId?: string;
  data?: any;
}

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { church } = useChurch();
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    totalSongs: 0,
    upcomingEvents: 0,
    totalMessages: 0,
    membersTrend: 0,
    songsTrend: 0,
    eventsTrend: 0,
    messagesTrend: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [allRsvpAlerts, setAllRsvpAlerts] = useState<Alert[]>([]); // Store all RSVP alerts
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState<string>(
    user?.first_name || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'
  );

  useEffect(() => {
    fetchAllData();
  }, [user]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchAdminName(),
        fetchUpcomingEvents(),
        fetchAlerts(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminName = async () => {
    try {
      if (user?.id) {
        const { data } = await supabase
          .from('members')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        const fallback = user?.first_name || user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
        setAdminName(data?.first_name || fallback);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const [membersRes, songsRes, eventsRes, messagesRes] = await Promise.all([
        supabase.from('members').select('id, created_at').eq('church_id', user?.church_id),
        supabase.from('songs').select('id, created_at'),
        supabase.from('events').select('id').eq('church_id', user?.church_id).gte('date', new Date().toISOString().split('T')[0]),
        supabase.from('messages').select('id, created_at').eq('church_id', user?.church_id)
      ]);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const membersTrend = membersRes.data?.filter(m => new Date(m.created_at) > sevenDaysAgo).length || 0;
      const songsTrend = songsRes.data?.filter(s => new Date(s.created_at) > sevenDaysAgo).length || 0;
      const messagesTrend = messagesRes.data?.filter(m => new Date(m.created_at) > sevenDaysAgo).length || 0;

      setStats({
        totalMembers: membersRes.data?.length || 0,
        totalSongs: songsRes.data?.length || 0,
        upcomingEvents: eventsRes.data?.length || 0,
        totalMessages: messagesRes.data?.length || 0,
        membersTrend,
        songsTrend,
        eventsTrend: 0,
        messagesTrend,
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      const { data } = await supabase
        .from('events')
        .select('*').eq('church_id', user?.church_id)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(3);

      setUpcomingEvents(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchAlerts = async () => {
    try {
      const alertsList: Alert[] = [];
      const allAlertsList: Alert[] = [];
      
      // Get events in next 7 days
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const { data: upcomingEventsData } = await supabase
        .from("events")
        .select("id, title, date")
        .gte("date", new Date().toISOString().split("T")[0])
        .lte("date", sevenDaysFromNow.toISOString().split("T")[0])
        .order("date", { ascending: true });
      
      // Get total active members (excluding inactive)
      const { count: totalMembers } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq('church_id', user?.church_id).neq('role', 'inactive');
      
      if (upcomingEventsData && totalMembers) {
        let eventsNeedingRsvps = 0;
        let mostUrgentEvent = null;
        let mostUrgentMissing = 0;
        let mostUrgentDays = 0;
        
        for (const event of upcomingEventsData) {
          // Get RSVP count for this event
          const { count: rsvpCount } = await supabase
            .from("event_rsvps")
            .select("*", { count: "exact", head: true })
            .eq("event_id", event.id);
          
          const missingRsvps = totalMembers - (rsvpCount || 0);
          
          // Count events with missing RSVPs
          if (missingRsvps > 0) {
            eventsNeedingRsvps++;
            
            const daysUntil = Math.ceil(
              (new Date(event.date + 'T00:00:00').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            );
            
            const dayText = daysUntil === 0 ? 'today' : 
                           daysUntil === 1 ? 'tomorrow' : 
                           `in ${daysUntil} days`;
            
            // Store all alerts for expansion
            allAlertsList.push({
              id: `rsvp-${event.id}`,
              type: "warning",
              message: `${event.title} ${dayText} - ${missingRsvps} of ${totalMembers} members haven't RSVP'd`,
              action: `/admin/events/${event.id}`,
              actionLabel: "View Event",
              eventId: event.id,
              data: { missingRsvps, totalMembers, daysUntil }
            });
            
            // Track the most urgent (soonest) event
            if (!mostUrgentEvent) {
              mostUrgentEvent = event;
              mostUrgentMissing = missingRsvps;
              mostUrgentDays = daysUntil;
            }
          }
        }
        
        // Only show alert for the most urgent event
        if (mostUrgentEvent) {
          const dayText = mostUrgentDays === 0 ? 'today' : 
                         mostUrgentDays === 1 ? 'tomorrow' : 
                         `in ${mostUrgentDays} days`;
          
          // If there are more events needing RSVPs, mention it
          const additionalText = eventsNeedingRsvps > 1 
            ? ` (+${eventsNeedingRsvps - 1} more event${eventsNeedingRsvps > 2 ? 's' : ''} need RSVPs)`
            : '';
          
          alertsList.push({
            id: `rsvp-${mostUrgentEvent.id}`,
            type: "warning",
            message: `${mostUrgentEvent.title} ${dayText} - ${mostUrgentMissing} of ${totalMembers} members haven't RSVP'd${additionalText}`,
            action: `/admin/events`,
            actionLabel: "View All Events",
            eventId: mostUrgentEvent.id,
            data: { missingRsvps: mostUrgentMissing, totalMembers, daysUntil: mostUrgentDays, totalEventsNeedingRsvps: eventsNeedingRsvps }
          });
        }
      }
      
      setAlerts(alertsList);
      setAllRsvpAlerts(allAlertsList);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    }
  };

  const sendEventReminders = async () => {
    if (!confirm('Send RSVP reminders to members who haven\'t responded?')) return;
    
    try {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const { data: events } = await supabase
        .from("events")
        .select("id, title, date")
        .gte("date", new Date().toISOString().split("T")[0])
        .lte("date", sevenDaysFromNow.toISOString().split("T")[0]);
      
      if (!events || events.length === 0) {
        toast.error("No upcoming events to send reminders for");
        return;
      }
      
      // Only get non-admin active members
      const { data: members } = await supabase
        .from("members")
        .select("id, first_name, last_name, email, role")
        .eq('church_id', user?.church_id).neq('role', 'inactive')
        .neq("role", "admin");
      
      if (!members) return;
      
      // Check for already-sent reminders today to prevent duplicates
      const today = new Date().toISOString().split("T")[0];
      const { data: existingReminders } = await supabase
        .from("messages")
        .select("send_to, subject")
        .like("subject", "RSVP Reminder:%")
        .gte("created_at", today + "T00:00:00");
      
      const alreadySent = new Set(
        existingReminders?.map(r => r.send_to + "|" + r.subject) || []
      );
      
      let remindersSent = 0;
      const authId = await getAuthUid();

      for (const event of events) {
        const { data: rsvps } = await supabase
          .from("rsvps")
          .select("member_id")
          .eq("event_id", event.id);
        
        const rsvpMemberIds = new Set(rsvps?.map(r => r.member_id) || []);
        const reminderSubject = "RSVP Reminder: " + event.title;
        
        for (const member of members) {
          const dupeKey = member.id + "|" + reminderSubject;
          if (!rsvpMemberIds.has(member.id) && !alreadySent.has(dupeKey)) {
            const memberName = `${member.first_name} ${member.last_name}`;
            await supabase.from("messages").insert({
              send_to: member.id,
              subject: reminderSubject,
              body: `Hi ${member.first_name}, please RSVP for ${event.title} on ${new Date(event.date + 'T00:00:00').toLocaleDateString()}. Your response helps us plan better!`,
              is_important: false,
              sender_id: authId,
              church_id: user?.church_id,
              created_at: new Date().toISOString(),
              sent_date: new Date().toISOString(),
              recipients: memberName
            });
            remindersSent++;
          }
        }
      }
      
      if (remindersSent === 0) {
        toast.success("All members have already been reminded or RSVP'd!");
      } else {
        toast.success(`Sent ${remindersSent} reminders for ${events.length} event(s)`);
      }
      
      fetchAlerts();
    } catch (error) {
      console.error("Error sending reminders:", error);
      toast.error("Failed to send reminders");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Members', 
      value: stats.totalMembers, 
      icon: Users, 
      trend: stats.membersTrend,
      color: 'blue',
      route: '/admin/members'
    },
    { 
      label: 'Songs', 
      value: stats.totalSongs, 
      icon: Music, 
      trend: stats.songsTrend,
      color: 'purple',
      route: '/admin/repertoire'
    },
    { 
      label: 'Events', 
      value: stats.upcomingEvents, 
      icon: Calendar, 
      trend: stats.eventsTrend,
      color: 'green',
      route: '/admin/events'
    },
    { 
      label: 'Messages', 
      value: stats.totalMessages, 
      icon: MessageSquare, 
      trend: stats.messagesTrend,
      color: 'orange',
      route: '/admin/messages'
    },
  ];

  return (
    <div className="space-y-4 pb-8">
      {/* Compact Header */}
      <div className="flex items-center gap-3">
        <div className="bg-indigo-100 p-2 rounded-lg">
          <Music className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-xs text-gray-600">Welcome, {adminName}</p>
        </div>
      </div>

      {/* Compact Stats Cards */}
      <div>
        <h2 className="text-base font-bold mb-2 flex items-center gap-2">
          <span>📊</span> 
          <span>Quick Stats</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            const colorMap = {
              blue: 'bg-blue-100',
              purple: 'bg-purple-100',
              green: 'bg-green-100',
              orange: 'bg-orange-100'
            };
            
            return (
              <button
                key={stat.label}
                onClick={() => navigate(stat.route)}
                className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-all text-left border border-gray-100"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={`${colorMap[stat.color as keyof typeof colorMap]} p-2 rounded-lg`}>
                    <Icon className="w-4 h-4 text-gray-700" />
                  </div>
                  {stat.trend !== 0 && (
                    <div className={`flex items-center gap-0.5 text-xs font-medium ${
                      stat.trend > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span>{stat.trend > 0 ? '+' : ''}{stat.trend}</span>
                    </div>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-600">{stat.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compact Quick Actions */}
      <div>
        <h2 className="text-base font-bold mb-2 flex items-center gap-2">
          <span>🎯</span> 
          <span>Quick Actions</span>
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => navigate('/admin/events/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center text-green-700">
              <Calendar className="w-4 h-4" />
            </span>
            New event
          </button>

          <button
            onClick={() => navigate('/admin/messages/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Mail className="w-4 h-4" />
            </span>
            Message
          </button>

          <button
            onClick={() => navigate('/admin/members/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
              <Plus className="w-4 h-4" />
            </span>
            New member
          </button>
        </div>
      </div>

      {/* Compact Upcoming Events */}
      <div>
        <h2 className="text-base font-bold mb-2 flex items-center gap-2">
          <span>📅</span> 
          <span>Upcoming Events</span>
        </h2>
        <button
          onClick={sendEventReminders}
          className="flex items-center gap-2 px-4 py-1.5 mb-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors min-h-[44px]"
        >
          <Bell className="w-3 h-3" />
          Send RSVP Reminders
        </button>
        <div className="space-y-2">
          {upcomingEvents.length === 0 ? (
            <div className="bg-white rounded-lg p-6 text-center border border-gray-100">
              <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No upcoming events</p>
            </div>
          ) : (
            upcomingEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => navigate(`/admin/events/${event.id}`)}
                className="w-full bg-white rounded-lg p-3 border border-gray-100 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-100 rounded-lg p-2 text-center flex-shrink-0">
                    <div className="text-lg font-bold text-indigo-600">
                      {new Date(event.date + 'T00:00:00').getDate()}
                    </div>
                    <div className="text-xs text-indigo-600 uppercase">
                      {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-0.5 text-sm">{event.title}</h3>
                    <p className="text-xs text-gray-600">{event.time}</p>
                    <p className="text-xs text-gray-600">📍 {event.location}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
