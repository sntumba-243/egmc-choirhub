import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar as CalendarIcon, MapPin, Clock, Music, Check, X, HelpCircle, Bell } from 'lucide-react';
import { eventsService, rsvpService, Event, RSVP } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export const MemberCalendar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedDateFromState = location.state?.selectedDate;
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, RSVP>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>(
    selectedDateFromState ? 'all' : 'upcoming'
  );

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (user && events.length > 0) {
      loadRSVPs();
    }
  }, [user, events]);

  const loadEvents = async () => {
    try {
      const data = await eventsService.getEvents();
      setEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const loadRSVPs = async () => {
    if (!user) return;
    try {
      const rsvpMap: Record<string, RSVP> = {};
      for (const event of events) {
        const rsvp = await rsvpService.getUserRSVP(event.id, user.id);
        if (rsvp) {
          rsvpMap[event.id] = rsvp;
        }
      }
      setRsvps(rsvpMap);
    } catch (error) {
      console.error('Error loading RSVPs:', error);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getEventTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      rehearsal: 'bg-blue-100 text-blue-700 border-blue-200',
      concert: 'bg-purple-100 text-purple-700 border-purple-200',
      social: 'bg-green-100 text-green-700 border-green-200',
      other: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return colors[type.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const needsResponse = (eventId: string): boolean => {
    return !rsvps[eventId];
  };

  const getRSVPBadge = (eventId: string) => {
    const rsvp = rsvps[eventId];
    if (!rsvp) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
          <Bell className="w-3 h-3" />
          Response Needed
        </div>
      );
    }
    if (rsvp.status === 'yes') {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
          <Check className="w-3 h-3" />
          Attending
        </div>
      );
    } else if (rsvp.status === 'maybe') {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
          <HelpCircle className="w-3 h-3" />
          Maybe
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
          <X className="w-3 h-3" />
          Not Attending
        </div>
      );
    }
  };

  const filteredEvents = events.filter(event => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.date + 'T00:00:00');
    if (filter === 'upcoming') {
      return eventDate >= now;
    } else if (filter === 'past') {
      return eventDate < now;
    }
    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.date + 'T00:00:00').getTime();
    const dateB = new Date(b.date + 'T00:00:00').getTime();
    return filter === 'past' ? dateB - dateA : dateA - dateB;
  });

  const upcomingEventsNeedingResponse = filteredEvents.filter(event => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.date + 'T00:00:00');
    return eventDate >= now && needsResponse(event.id);
  }).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-3"></div>
        <p className="text-gray-600 text-sm">Loading events...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600 text-sm mt-1">{filteredEvents.length} events</p>
        </div>
      </div>
      {upcomingEventsNeedingResponse > 0 && filter === 'upcoming' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <Bell className="w-5 h-5 text-yellow-700" />
          <span className="text-sm font-semibold text-yellow-900">
            {upcomingEventsNeedingResponse} event{upcomingEventsNeedingResponse > 1 ? 's' : ''} need{upcomingEventsNeedingResponse === 1 ? 's' : ''} your response
          </span>
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setFilter('all')} className={'px-6 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ' + (filter === 'all' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
          All
        </button>
        <button onClick={() => setFilter('upcoming')} className={'px-6 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ' + (filter === 'upcoming' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
          Upcoming
        </button>
        <button onClick={() => setFilter('past')} className={'px-6 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ' + (filter === 'past' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
          Past
        </button>
      </div>
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12">
          <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{filter === 'upcoming' ? 'No upcoming events' : 'No events found'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => (
            <button key={event.id} onClick={() => navigate('/member/calendar/' + event.id)} className={'w-full p-5 border-2 rounded-xl hover:shadow-lg transition-all text-left ' + getEventTypeColor(event.type) + (needsResponse(event.id) && new Date(event.date) >= new Date() ? ' ring-2 ring-yellow-400' : '')}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">{event.title}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wide px-2 py-1 bg-white bg-opacity-50 rounded">{event.type}</span>
                    {getRSVPBadge(event.id)}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="w-4 h-4" />
                  <span className="font-medium">{formatDate(event.date)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{event.time}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location}</span>
                </div>
                {event.setlist && event.setlist.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Music className="w-4 h-4" />
                    <span className="font-semibold">{event.setlist.length} songs in setlist</span>
                  </div>
                )}
              </div>
              {event.description && (
                <p className="text-sm mt-3 line-clamp-2 opacity-80">{event.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
