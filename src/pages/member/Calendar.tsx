import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Clock, MapPin, Users, Grid, List, ArrowUpDown, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  location: string;
  type?: string;
  requires_rsvp: boolean;
}

interface RSVP {
  event_id: string;
  status: 'yes' | 'no' | 'maybe';
}

type ViewMode = 'cards' | 'list';
type SortField = 'date' | 'title' | 'type' | 'time' | 'location';
type SortDirection = 'asc' | 'desc';

export const MemberCalendar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, RSVP>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    fetchEvents();
    fetchRSVPs();
  }, [user?.church_id]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .or(`church_id.eq.${user?.church_id},is_global.eq.true`)
        .order('date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const fetchRSVPs = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('event_rsvps')
        .select('event_id, status')
        .eq('member_id', user.id);

      if (error) throw error;

      const rsvpMap: Record<string, RSVP> = {};
      data?.forEach((rsvp) => {
        rsvpMap[rsvp.event_id] = rsvp;
      });
      setRsvps(rsvpMap);
    } catch (error) {
      console.error('Error fetching RSVPs:', error);
    }
  };

  const handleRSVP = async (eventId: string, status: 'yes' | 'no' | 'maybe') => {
    try {
      if (!user) {
        toast.error('You must be logged in to RSVP');
        return;
      }

      const { error } = await supabase
        .from('event_rsvps')
        .upsert(
        {
          event_id: eventId,
          member_id: user.id,
          status,
        },
        {
          onConflict: 'event_id,member_id'
        }
      );

      if (error) throw error;

      setRsvps((prev) => ({
        ...prev,
        [eventId]: { event_id: eventId, status },
      }));

      toast.success(`RSVP updated to "${status}"`);
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast.error('Failed to update RSVP');
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedEvents = () => {
    let filtered = events;
    
    // Apply timeline filter
    if (timelineFilter === 'upcoming') {
      filtered = events.filter(e => !isPast(e.date, e.time));
    } else if (timelineFilter === 'past') {
      filtered = events.filter(e => isPast(e.date, e.time));
    }
    
    return [...filtered].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'date' || sortField === 'time') {
        aVal = new Date(`${a.date} ${a.time}`).getTime();
        bVal = new Date(`${b.date} ${b.time}`).getTime();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const isToday = (dateString: string) => {
    const eventDate = new Date(dateString);
    const today = new Date();
    return eventDate.toDateString() === today.toDateString();
  };

  const isPast = (dateString: string, timeString: string) => {
    const eventDateTime = new Date(`${dateString}T${timeString}`);
    return eventDateTime < new Date();
  };

  const isFuture = (dateString: string, timeString: string) => {
    const eventDateTime = new Date(`${dateString}T${timeString}`);
    return eventDateTime > new Date() && !isToday(dateString);
  };

  const sortedEvents = getSortedEvents();

  if (loading) {
    return <div className="p-8 text-center">Loading events...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Events</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">{events.length} upcoming event{events.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center">
          {/* View Toggle - iOS style */}
          <div className="hidden sm:flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span className="text-sm">Cards</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="text-sm">List</span>
            </button>
          </div>
        </div>
      </div>

      
      {/* Timeline Filter Buttons */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mt-1">
        <button
          onClick={() => setTimelineFilter('upcoming')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            timelineFilter === 'upcoming'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Upcoming ({events.filter(e => !isPast(e.date, e.time)).length})
        </button>
<button
          onClick={() => setTimelineFilter('past')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            timelineFilter === 'past'
              ? 'bg-gray-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Past ({events.filter(e => isPast(e.date, e.time)).length})
        </button>
        <button
          onClick={() => setTimelineFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            timelineFilter === 'all'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({events.length})
        </button>
      </div>

      {/* Cards View - Mobile Responsive */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {sortedEvents.map((event) => {
            const rsvp = rsvps[event.id];
            return (
              <div
                key={event.id}
                onClick={() => navigate(`/member/events/${event.id}`)}
                className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-orange-300 cursor-pointer overflow-hidden"
              >
                {/* Header with iOS gradient */}
                <div className="relative p-2.5 pb-1.5 sm:p-2 sm:pb-1.5 bg-gradient-to-br from-orange-50/40 via-amber-50/30 to-yellow-50/30">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-orange-600 transition-colors">
                      {event.title}
                    </h3>
                    {event.type && (
                      <span className="inline-flex items-center px-2 py-0.5 bg-white/90 backdrop-blur-sm text-orange-600 text-xs font-semibold rounded-full shadow-sm border border-orange-200/50 whitespace-nowrap">
                        {event.type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-2.5 pt-2 sm:p-2 sm:pt-1.5 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-blue-500 flex items-center justify-center shadow-sm">
                      <Calendar className="w-3 h-3 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-xs font-medium">{formatDate(event.date)}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-purple-500 flex items-center justify-center shadow-sm">
                      <Clock className="w-3 h-3 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-xs">{formatTime(event.time)}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-teal-500 flex items-center justify-center shadow-sm">
                      <MapPin className="w-3 h-3 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-xs truncate">{event.location}</span>
                  </div>

                  {/* RSVP Status */}
                  {event.requires_rsvp && (
                    <div className="pt-1 min-h-[28px] flex items-center">
                      {rsvp ? (
                        <div className="flex items-center gap-1.5">
                          {rsvp.status === 'yes' && (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="text-xs font-semibold text-green-600">You're attending!</span>
                            </>
                          )}
                          {rsvp.status === 'no' && (
                            <>
                              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                              <span className="text-xs font-semibold text-red-600">Not attending</span>
                            </>
                          )}
                          {rsvp.status === 'maybe' && (
                            <>
                              <Users className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                              <span className="text-xs font-semibold text-yellow-600">Maybe attending</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 italic">No RSVP yet</span>
                      )}
                    </div>
                  )}
                </div>

                {/* RSVP Buttons */}
                {event.requires_rsvp && (
                  <div className="flex gap-1.5 px-2.5 pb-2.5 pt-1.5 sm:px-2 sm:pb-2 sm:pt-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRSVP(event.id, 'yes');
                      }}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                        rsvp?.status === 'yes'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-green-50 hover:text-green-700'
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Yes
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRSVP(event.id, 'maybe');
                      }}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                        rsvp?.status === 'maybe'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-yellow-50 hover:text-yellow-700'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      Maybe
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRSVP(event.id, 'no');
                      }}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                        rsvp?.status === 'no'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-700'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      No
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* List View - Mobile Responsive */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th 
                    onClick={() => handleSort('title')}
                    className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Event
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('date')}
                    className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Date
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('time')}
                    className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Time
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('location')}
                    className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Location
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('type')}
                    className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Type
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Your RSVP
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {sortedEvents.map((event) => {
                  const rsvp = rsvps[event.id];
                  return (
                    <tr 
                      key={event.id}
                      onClick={() => navigate(`/member/events/${event.id}`)}
                      className="hover:bg-orange-50/30 cursor-pointer transition-all group"
                    >
                      <td className="px-3 sm:px-4 py-3">
                        <div className="font-semibold text-sm text-gray-900 group-hover:text-orange-600 transition-colors">
                          {event.title}
                        </div>
                        {event.description && (
                          <div className="text-xs text-gray-500 truncate max-w-xs mt-0.5">{event.description}</div>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center shadow-sm flex-shrink-0">
                            <Calendar className="w-3 h-3 text-white" strokeWidth={2.5} />
                          </div>
                          <span className="text-xs font-medium text-gray-700">{formatDate(event.date)}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-purple-500 flex items-center justify-center shadow-sm flex-shrink-0">
                            <Clock className="w-3 h-3 text-white" strokeWidth={2.5} />
                          </div>
                          <span className="text-xs text-gray-700">{formatTime(event.time)}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-teal-500 flex items-center justify-center shadow-sm flex-shrink-0">
                            <MapPin className="w-3 h-3 text-white" strokeWidth={2.5} />
                          </div>
                          <span className="text-xs text-gray-700">{event.location}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        {event.type && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700 shadow-sm">
                            {event.type}
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        {event.requires_rsvp ? (
                          <div className="flex items-center justify-center gap-1">
                            {rsvp?.status === 'yes' && (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                <span className="text-xs font-semibold text-green-600">Yes</span>
                              </>
                            )}
                            {rsvp?.status === 'no' && (
                              <>
                                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                <span className="text-xs font-semibold text-red-600">No</span>
                              </>
                            )}
                            {rsvp?.status === 'maybe' && (
                              <>
                                <Users className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                                <span className="text-xs font-semibold text-yellow-600">Maybe</span>
                              </>
                            )}
                            {!rsvp && (
                              <span className="text-xs text-gray-400 italic">Not set</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile scroll hint */}
          <div className="sm:hidden px-4 py-2 bg-gray-50 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">← Scroll horizontally to see more →</p>
          </div>
        </div>
      )}

      {/* Empty State - Mobile Responsive */}
      {events.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-16 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-orange-600" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No upcoming events</h3>
          <p className="text-sm sm:text-base text-gray-600">Check back later for new events</p>
        </div>
      )}
    </div>
  );
};
