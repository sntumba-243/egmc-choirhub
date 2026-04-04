import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { isMobile } from '../../utils/mobile-helpers';
import '../../styles/mobile-optimization.css';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  type: 'rehearsal' | 'performance' | 'other';
  created_at: string;
}

interface RSVP {
  id: string;
  user_id: string;
  event_id: string;
  status: 'yes' | 'no' | 'maybe';
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export function AdminEventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const mobile = isMobile();

  useEffect(() => {
    if (id) {
      loadEventDetails();
    }
  }, [id]);

  async function loadEventDetails() {
    try {
      setLoading(true);
      setError(null);

      // Load event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Load RSVPs with user profiles
      const { data: rsvpData, error: rsvpError } = await supabase
        .from('event_rsvps')
        .select(`
          id,
          user_id,
          event_id,
          status,
          created_at,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq('event_id', id)
        .order('created_at', { ascending: false });

      if (rsvpError) throw rsvpError;
      setRsvps(rsvpData || []);

    } catch (err) {
      console.error('Error loading event details:', err);
      setError('Failed to load event details');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteEvent() {
    if (!id) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;

      navigate('/admin/events');
    } catch (err) {
      console.error('Error deleting event:', err);
      setError('Failed to delete event');
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'yes':
        return 'bg-green-100 text-green-800';
      case 'no':
        return 'bg-red-100 text-red-800';
      case 'maybe':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusEmoji(status: string) {
    switch (status) {
      case 'yes':
        return '✅';
      case 'no':
        return '❌';
      case 'maybe':
        return '❓';
      default:
        return '⏸️';
    }
  }

  function getEventTypeColor(type: string) {
    switch (type) {
      case 'rehearsal':
        return 'bg-blue-100 text-blue-800';
      case 'performance':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  const yesCount = rsvps.filter(r => r.status === 'yes').length;
  const noCount = rsvps.filter(r => r.status === 'no').length;
  const maybeCount = rsvps.filter(r => r.status === 'maybe').length;

  if (loading) {
    return (
      <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800">{error || 'Event not found'}</p>
          <button
            onClick={() => navigate('/admin/events')}
            className={mobile ? 'mobile-button mobile-button-primary mt-4' : 'mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'}
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={mobile ? 'mobile-container' : 'container mx-auto px-4 py-8'}>
      {/* Back Button */}
      <button
        onClick={() => navigate('/admin/events')}
        className={mobile ? 'mobile-button mobile-button-secondary mb-4' : 'mb-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300'}
      >
        ← Back to Events
      </button>

      {/* Event Details Card */}
      <div className={mobile ? 'mobile-card mb-4' : 'bg-white rounded-lg shadow-md p-6 mb-6'}>
        <div className="flex flex-col gap-4">
          {/* Title and Type */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEventTypeColor(event.type)}`}>
                {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
              </span>
            </div>
            <h1 className={mobile ? 'text-2xl font-bold text-gray-900' : 'text-3xl font-bold text-gray-900'}>
              {event.title}
            </h1>
          </div>

          {/* Date and Time */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-700">
              <span className="text-xl">📅</span>
              <span className="font-medium">{formatDate(event.date)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <span className="text-xl">🕐</span>
              <span className="font-medium">{event.time}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <span className="text-xl">📍</span>
              <span className="font-medium">{event.location}</span>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="mt-2 pt-4 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
            <button
              onClick={() => navigate(`/admin/events/edit/${id}`)}
              className={mobile ? 'mobile-button mobile-button-primary flex-1' : 'flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'}
            >
              ✏️ Edit Event
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className={mobile ? 'mobile-button bg-red-600 hover:bg-red-700 text-white' : 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700'}
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      {/* RSVP Summary Card */}
      <div className={mobile ? 'mobile-card mb-4' : 'bg-white rounded-lg shadow-md p-6 mb-6'}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">RSVP Summary</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-3xl mb-1">✅</div>
            <div className="text-2xl font-bold text-green-800">{yesCount}</div>
            <div className="text-sm text-green-600">Attending</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-3xl mb-1">❌</div>
            <div className="text-2xl font-bold text-red-800">{noCount}</div>
            <div className="text-sm text-red-600">Not Attending</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-3xl mb-1">❓</div>
            <div className="text-2xl font-bold text-yellow-800">{maybeCount}</div>
            <div className="text-sm text-yellow-600">Maybe</div>
          </div>
        </div>
      </div>

      {/* RSVP List */}
      <div className={mobile ? 'mobile-card' : 'bg-white rounded-lg shadow-md p-6'}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          RSVPs ({rsvps.length})
        </h2>
        
        {rsvps.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-2xl mb-2">📭</p>
            <p>No RSVPs yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rsvps.map((rsvp) => (
              <div
                key={rsvp.id}
                className={mobile ? 'mobile-card bg-gray-50' : 'p-4 bg-gray-50 rounded-lg'}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {rsvp.profiles?.full_name || 'Unknown User'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {rsvp.profiles?.email}
                    </p>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(rsvp.status)}`}>
                      {getStatusEmoji(rsvp.status)} {rsvp.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={mobile ? 'mobile-card bg-white max-w-sm w-full' : 'bg-white rounded-lg p-6 max-w-sm w-full'}>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Event?</h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete "{event.title}" and all associated RSVPs. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={mobile ? 'mobile-button mobile-button-secondary flex-1' : 'flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300'}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                className={mobile ? 'mobile-button bg-red-600 hover:bg-red-700 text-white flex-1' : 'flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700'}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
