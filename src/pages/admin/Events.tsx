import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, Users, Plus, Edit, Trash2, Filter } from 'lucide-react';
import { eventsService, Event } from '../../lib/database';

interface AdminEventsProps {
  onNavigateToForm: (eventId?: string) => void;
}

export const AdminEvents: React.FC<AdminEventsProps> = ({ onNavigateToForm }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    filterEvents();
  }, [events, timeFilter, typeFilter]);

  const loadEvents = async () => {
    try {
      const data = await eventsService.getEvents();
      setEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterEvents = () => {
    let result = [...events];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (timeFilter === 'upcoming') {
      result = result.filter(event => new Date(event.date) >= now);
    } else if (timeFilter === 'past') {
      result = result.filter(event => new Date(event.date) < now);
    }

    if (typeFilter !== 'all') {
      result = result.filter(event => event.type === typeFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return timeFilter === 'past' ? dateB - dateA : dateA - dateB;
    });

    setFilteredEvents(result);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await eventsService.deleteEvent(deleteConfirm.id);
      setEvents(events.filter(e => e.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  const getEventTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      rehearsal: 'bg-blue-100 text-blue-700',
      concert: 'bg-purple-100 text-purple-700',
      social: 'bg-green-100 text-green-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return colors[type.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getMockRsvpCount = (): number => {
    return Math.floor(Math.random() * 20) + 5;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-blue-900">Events Management</h2>
            <p className="text-gray-600 mt-1">{filteredEvents.length} events</p>
          </div>
          <button
            onClick={() => onNavigateToForm()}
            className="bg-blue-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Event
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeFilter === 'all'
                  ? 'bg-blue-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Show All
            </button>
            <button
              onClick={() => setTimeFilter('upcoming')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeFilter === 'upcoming'
                  ? 'bg-blue-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Upcoming Only
            </button>
            <button
              onClick={() => setTimeFilter('past')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeFilter === 'past'
                  ? 'bg-blue-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Past Only
            </button>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Types</option>
              <option value="rehearsal">Rehearsal</option>
              <option value="concert">Concert</option>
              <option value="social">Social</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">
              {timeFilter === 'upcoming' ? 'No upcoming events' : 'No events found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map(event => (
              <div
                key={event.id}
                className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onNavigateToForm(event.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-blue-900 flex-1">{event.title}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getEventTypeColor(event.type)}`}
                  >
                    {event.type}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{formatDate(event.date)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{event.time}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{event.location}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-700">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold">{getMockRsvpCount()} attending</span>
                  </div>
                </div>

                {event.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{event.description}</p>
                )}

                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onNavigateToForm(event.id);
                    }}
                    className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-lg font-semibold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setDeleteConfirm(event);
                    }}
                    className="flex-1 bg-red-50 text-red-700 py-2 rounded-lg font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-blue-900 mb-3">Confirm Delete</h3>
            <p className="text-gray-700 mb-2">
              Delete <strong>{deleteConfirm.title}</strong>?
            </p>
            <p className="text-gray-600 text-sm mb-6">
              This will remove all RSVPs. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
