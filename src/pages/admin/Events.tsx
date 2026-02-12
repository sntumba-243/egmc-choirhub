import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Calendar, Plus, Edit, Trash2, MapPin, Clock, Users, Grid, List, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description?: string;
  type?: string;
  requires_rsvp: boolean;
  setlist?: string[];
}

type ViewMode = 'cards' | 'list';
type SortField = 'title' | 'date' | 'time' | 'location' | 'type';
type SortDirection = 'asc' | 'desc';

export const AdminEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);

      // Fetch RSVP counts for each event
      if (data) {
        const counts: Record<string, number> = {};
        for (const event of data) {
          if (event.requires_rsvp) {
            const { count } = await supabase
              .from('rsvps')
              .select('*', { count: 'exact', head: true })
              .eq('event_id', event.id)
              .eq('status', 'yes');
            counts[event.id] = count || 0;
          }
        }
        setRsvpCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) throw error;
        toast.success('Event deleted successfully');
        fetchEvents();
      } catch (error) {
        console.error('Error deleting event:', error);
        toast.error('Failed to delete event');
      }
    }
  };

  const handleResetRsvps = async (eventId: string, title: string) => {
    if (window.confirm(`Reset all RSVPs for "${title}"?`)) {
      try {
        const { error } = await supabase
          .from('rsvps')
          .delete()
          .eq('event_id', eventId);
        
        if (error) throw error;
        toast.success('RSVPs reset successfully');
        fetchEvents();
      } catch (error) {
        console.error('Error resetting RSVPs:', error);
        toast.error('Failed to reset RSVPs');
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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

      if (sortField === 'date') {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      } else if (sortField === 'time') {
        aVal = a.time || '';
        bVal = b.time || '';
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
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
          <p className="text-sm sm:text-base text-gray-500 mt-1">{events.length} total event{events.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* View Toggle - iOS style */}
          <div className="hidden sm:flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-600 shadow-sm'
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
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="text-sm">List</span>
            </button>
          </div>

          <button
            onClick={() => navigate('/admin/events/new')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm font-medium">Add Event</span>
          </button>
        </div>
      </div>

      
      {/* Timeline Filter Buttons */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mt-1">
        <button
          onClick={() => setTimelineFilter('upcoming')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            timelineFilter === 'upcoming'
              ? 'bg-blue-500 text-white shadow-sm'
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
              ? 'bg-teal-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({events.length})
        </button>
      </div>

      {/* Cards View - Mobile Responsive Grid */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {sortedEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => navigate(`/admin/events/${event.id}`)}
              className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-blue-300 cursor-pointer overflow-hidden"
            >
              {/* Header with iOS gradient - MORE COMPACT */}
              <div className="relative p-3 pb-2 sm:p-2.5 sm:pb-2 bg-gradient-to-br from-blue-50/40 via-cyan-50/30 to-teal-50/30">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                    {event.title}
                  </h3>
                  {event.type && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-white/90 backdrop-blur-sm text-blue-600 text-xs font-semibold rounded-full shadow-sm border border-blue-200/50 whitespace-nowrap">
                      {event.type}
                    </span>
                  )}
                </div>
              </div>

              {/* Content - MORE COMPACT */}
              <div className="p-3 pt-2 sm:p-2.5 sm:pt-2 space-y-1">
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

                {event.requires_rsvp && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-green-500 flex items-center justify-center shadow-sm">
                      <Users className="w-3 h-3 text-white" strokeWidth={2.5} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-green-600">
                        {rsvpCounts[event.id] || 0}
                      </span>
                      <span className="text-xs text-gray-500">RSVPs</span>
                      {rsvpCounts[event.id] > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetRsvps(event.id, event.title);
                          }}
                          className="ml-0.5 text-xs text-red-500 hover:text-red-600 font-medium"
                          title="Reset RSVPs"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* iOS style balanced icon buttons */}
              <div className="flex gap-2 px-3 pb-3 pt-2 sm:px-2.5 sm:pb-2.5 sm:pt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/admin/events/${event.id}/edit`);
                  }}
                  className="flex items-center justify-center p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 hover:text-gray-900 transition-colors"
                  title="Edit"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => handleDelete(e, event.id, event.title)}
                  className="flex items-center justify-center p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View - iOS themed - Mobile Responsive */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th 
                    onClick={() => handleSort('title')}
                    className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      Title
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
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    RSVPs
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {sortedEvents.map((event) => (
                  <tr 
                    key={event.id}
                    onClick={() => navigate(`/admin/events/${event.id}`)}
                    className="hover:bg-blue-50/30 cursor-pointer transition-all group"
                  >
                    <td className="px-3 sm:px-4 py-3">
                      <div className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">{event.title}</div>
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
                        <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 shadow-sm">
                          {event.type}
                        </span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                      {event.requires_rsvp && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-lg bg-green-500 flex items-center justify-center shadow-sm flex-shrink-0">
                            <Users className="w-3 h-3 text-white" strokeWidth={2.5} />
                          </div>
                          <span className="text-xs font-bold text-green-600">
                            {rsvpCounts[event.id] || 0}
                          </span>
                          {rsvpCounts[event.id] > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetRsvps(event.id, event.title);
                              }}
                              className="text-xs text-red-500 hover:text-red-600 font-medium"
                              title="Reset RSVPs"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/events/${event.id}/edit`);
                          }}
                          className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, event.id, event.title)}
                          className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No events yet</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">Create your first event to get started</p>
          <button
            onClick={() => navigate('/admin/events/new')}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Add Event
          </button>
        </div>
      )}
    </div>
  );
};
