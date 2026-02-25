import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Calendar, Clock, MapPin, Users, Grid, List, ArrowUpDown, Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

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

type ViewMode = 'cards' | 'list';
type SortField = 'date' | 'title' | 'type' | 'time' | 'location';
type SortDirection = 'asc' | 'desc';

export const AdminEvents = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .or(`church_id.eq.${user?.church_id},is_global.eq.true`)
        .order('date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);

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
    if (window.confirm(`Delete "${title}"?`)) {
      try {
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) throw error;
        toast.success('Event deleted');
        fetchEvents();
      } catch (error) {
        console.error('Error deleting event:', error);
        toast.error('Failed to delete event');
      }
    }
  };

  const handleResetRsvps = async (eventId: string, title: string) => {
    if (window.confirm(`Reset all RSVPs for "${title}"? (Data will be archived for attendance tracking)`)) {
      try {
        // Get event date for archive
        const { data: event } = await supabase.from('events').select('date').eq('id', eventId).single();
        
        // Get current RSVPs before deleting
        const { data: currentRsvps } = await supabase.from('rsvps').select('member_id, status').eq('event_id', eventId);
        
        // Archive RSVPs to attendance_history
        if (currentRsvps && currentRsvps.length > 0 && event) {
          const archiveData = currentRsvps.map(r => ({
            event_id: eventId,
            member_id: r.member_id,
            event_title: title,
            event_date: event.date,
            status: r.status || 'attending',
          }));
          await supabase.from('attendance_history').upsert(archiveData, { onConflict: 'event_id,member_id,event_date' });
        }
        
        // Now safe to delete
        const { error } = await supabase.from('rsvps').delete().eq('event_id', eventId);
        if (error) throw error;
        toast.success('RSVPs archived & reset');
        fetchEvents();
      } catch (error) {
        console.error('Error resetting RSVPs:', error);
        toast.error('Failed to reset RSVPs');
      }
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

  const isPast = (dateString: string, timeString: string) => {
    const eventDateTime = new Date(`${dateString}T${timeString}`);
    return eventDateTime < new Date();
  };

  const getSortedEvents = () => {
    let filtered = events;
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
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const sortedEvents = getSortedEvents();
  if (loading) return <div className="p-8 text-center">Loading events...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Events</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">{events.length} total event{events.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode('cards')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <Grid className="w-4 h-4" /><span className="text-sm">Cards</span>
            </button>
            <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <List className="w-4 h-4" /><span className="text-sm">List</span>
            </button>
          </div>
          <button onClick={() => navigate('/admin/events/new')} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap">
            <Plus className="w-5 h-5" /><span className="text-sm font-medium">Add Event</span>
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 -mt-1">
        <button onClick={() => setTimelineFilter('upcoming')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${timelineFilter === 'upcoming' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          Upcoming ({events.filter(e => !isPast(e.date, e.time)).length})
        </button>
        <button onClick={() => setTimelineFilter('past')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${timelineFilter === 'past' ? 'bg-gray-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          Past ({events.filter(e => isPast(e.date, e.time)).length})
        </button>
        <button onClick={() => setTimelineFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${timelineFilter === 'all' ? 'bg-teal-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          All ({events.length})
        </button>
      </div>

      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {sortedEvents.map((event) => (
            <div key={event.id} onClick={() => navigate(`/admin/events/${event.id}`)} className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 hover:border-blue-300 cursor-pointer overflow-hidden">
              <div className="relative p-3 pb-2 sm:p-2.5 sm:pb-2 bg-gradient-to-br from-blue-50/40 via-cyan-50/30 to-teal-50/30">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">{event.title}</h3>
                  {event.type && <span className="inline-flex items-center px-2 py-0.5 bg-white/90 backdrop-blur-sm text-blue-600 text-xs font-semibold rounded-full shadow-sm border border-blue-200/50 whitespace-nowrap">{event.type}</span>}
                </div>
              </div>
              <div className="p-3 pt-2 sm:p-2.5 sm:pt-2 space-y-1">
                <div className="flex items-center gap-1.5 text-gray-700">
                  <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-blue-500 flex items-center justify-center shadow-sm"><Calendar className="w-3 h-3 text-white" strokeWidth={2.5} /></div>
                  <span className="text-xs font-medium">{formatDate(event.date)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-700">
                  <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-purple-500 flex items-center justify-center shadow-sm"><Clock className="w-3 h-3 text-white" strokeWidth={2.5} /></div>
                  <span className="text-xs">{formatTime(event.time)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-700">
                  <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-teal-500 flex items-center justify-center shadow-sm"><MapPin className="w-3 h-3 text-white" strokeWidth={2.5} /></div>
                  <span className="text-xs truncate">{event.location}</span>
                </div>
                {event.requires_rsvp && (
                  <div className="pt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-green-500 flex items-center justify-center shadow-sm">
                        <Users className="w-3 h-3 text-white" strokeWidth={2.5} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700">{rsvpCounts[event.id] || 0} RSVPs</span>
                      {(rsvpCounts[event.id] || 0) > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleResetRsvps(event.id, event.title); }}
                          className="text-xs text-red-500 hover:text-red-600 font-medium"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 px-3 pb-3 pt-2 sm:px-2.5 sm:pb-2.5 sm:pt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/events/${event.id}/edit`); }}
                  className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  title="Edit"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => handleDelete(e, event.id, event.title)}
                  className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th onClick={() => handleSort('title')} className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"><div className="flex items-center gap-1.5">Event<ArrowUpDown className="w-3 h-3 text-gray-400" /></div></th>
                  <th onClick={() => handleSort('date')} className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"><div className="flex items-center gap-1.5">Date<ArrowUpDown className="w-3 h-3 text-gray-400" /></div></th>
                  <th onClick={() => handleSort('time')} className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"><div className="flex items-center gap-1.5">Time<ArrowUpDown className="w-3 h-3 text-gray-400" /></div></th>
                  <th onClick={() => handleSort('location')} className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"><div className="flex items-center gap-1.5">Location<ArrowUpDown className="w-3 h-3 text-gray-400" /></div></th>
                  <th onClick={() => handleSort('type')} className="px-3 sm:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"><div className="flex items-center gap-1.5">Type<ArrowUpDown className="w-3 h-3 text-gray-400" /></div></th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">RSVPs</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {sortedEvents.map((event) => (
                  <tr key={event.id} onClick={() => navigate(`/admin/events/${event.id}`)} className="hover:bg-blue-50/30 cursor-pointer transition-all group">
                    <td className="px-3 sm:px-4 py-3">
                      <div className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">{event.title}</div>
                      {event.description && <div className="text-xs text-gray-500 truncate max-w-xs mt-0.5">{event.description}</div>}
                    </td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center shadow-sm flex-shrink-0"><Calendar className="w-3 h-3 text-white" strokeWidth={2.5} /></div><span className="text-xs font-medium text-gray-700">{formatDate(event.date)}</span></div></td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-purple-500 flex items-center justify-center shadow-sm flex-shrink-0"><Clock className="w-3 h-3 text-white" strokeWidth={2.5} /></div><span className="text-xs text-gray-700">{formatTime(event.time)}</span></div></td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-teal-500 flex items-center justify-center shadow-sm flex-shrink-0"><MapPin className="w-3 h-3 text-white" strokeWidth={2.5} /></div><span className="text-xs text-gray-700">{event.location}</span></div></td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">{event.type && <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 shadow-sm">{event.type}</span>}</td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap">{event.requires_rsvp ? (<div className="flex items-center justify-center gap-1"><Users className="w-4 h-4 text-green-600" /><span className="text-xs font-semibold text-green-600">{rsvpCounts[event.id] || 0}</span>{(rsvpCounts[event.id] || 0) > 0 && <button onClick={(e) => { e.stopPropagation(); handleResetRsvps(event.id, event.title); }} className="ml-1 text-xs text-red-500 hover:text-red-600 font-medium">Reset</button>}</div>) : <span className="text-xs text-gray-400">-</span>}</td>
                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right"><div className="flex items-center justify-end gap-1"><button onClick={(e) => { e.stopPropagation(); navigate(`/admin/events/${event.id}/edit`); }} className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"><Edit className="w-3.5 h-3.5" /></button><button onClick={(e) => handleDelete(e, event.id, event.title)} className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden px-4 py-2 bg-gray-50 border-t border-gray-200 text-center"><p className="text-xs text-gray-500">← Scroll horizontally to see more →</p></div>
        </div>
      )}

      {sortedEvents.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-16 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4 sm:mb-6"><Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" /></div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{timelineFilter === 'upcoming' && 'No upcoming events'}{timelineFilter === 'past' && 'No past events'}{timelineFilter === 'all' && 'No events yet'}</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-6">Get started by creating your first event</p>
          <button onClick={() => navigate('/admin/events/new')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"><Plus className="w-4 h-4" />Add Event</button>
        </div>
      )}
    </div>
  );
};
