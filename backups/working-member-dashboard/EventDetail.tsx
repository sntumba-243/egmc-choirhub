import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, MapPin, Clock, Music, Check, X, HelpCircle } from 'lucide-react';
import { eventsService, songsService, rsvpService, Event, Song, RSVP } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface EventDetailProps {
  eventId: string;
  onBack: () => void;
  onNavigateToSong: (songId: string) => void;
}

export const EventDetail: React.FC<EventDetailProps> = ({ eventId, onBack, onNavigateToSong }) => {
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvp, setRsvp] = useState<RSVP | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadEventAndSongs();
    if (user) {
      loadRSVP();
    }
  }, [eventId, user]);

  const loadEventAndSongs = async () => {
    try {
      const [eventsData, songsData] = await Promise.all([
        eventsService.getEvents(),
        songsService.getSongs(),
      ]);
      const foundEvent = eventsData.find(e => e.id === eventId);
      setEvent(foundEvent || null);
      setSongs(songsData);
    } catch (error) {
      console.error('Error loading event:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRSVP = async () => {
    if (!user) return;
    try {
      const userRsvp = await rsvpService.getUserRSVP(eventId, user.id);
      setRsvp(userRsvp);
    } catch (error) {
      console.error('Error loading RSVP:', error);
    }
  };

  const handleRSVP = async (status: 'yes' | 'no' | 'maybe') => {
    if (!user) return;
    setSubmitting(true);
    try {
      const newRsvp = await rsvpService.upsertRSVP({
        event_id: eventId,
        user_id: user.id,
        status,
      });
      setRsvp(newRsvp);
    } catch (error) {
      console.error('Error updating RSVP:', error);
      alert('Failed to update attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const getSongById = (id: string): Song | undefined => {
    return songs.find(s => s.id === id);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-blue-900 text-xl">Loading event...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-red-900 text-xl">Event not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-900 font-semibold hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Calendar
        </button>

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-blue-900 mb-2">{event.title}</h2>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getEventTypeColor(event.type)}`}>
              {event.type}
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-gray-700">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="font-medium">{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="font-medium">{event.time}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span className="font-medium">{event.location}</span>
          </div>
        </div>

        {event.description && (
          <div className="p-4 bg-gray-50 rounded-lg mb-6">
            <p className="text-gray-700">{event.description}</p>
          </div>
        )}

        <div className="border-t pt-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4">Will you attend?</h3>
          <div className="flex gap-3">
            <button
              onClick={() => handleRSVP('yes')}
              disabled={submitting}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all disabled:opacity-50 ${
                rsvp?.status === 'yes'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              <Check className="w-5 h-5" />
              Yes
            </button>
            <button
              onClick={() => handleRSVP('maybe')}
              disabled={submitting}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all disabled:opacity-50 ${
                rsvp?.status === 'maybe'
                  ? 'bg-yellow-600 text-white shadow-lg'
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }`}
            >
              <HelpCircle className="w-5 h-5" />
              Maybe
            </button>
            <button
              onClick={() => handleRSVP('no')}
              disabled={submitting}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all disabled:opacity-50 ${
                rsvp?.status === 'no'
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              <X className="w-5 h-5" />
              No
            </button>
          </div>
          {rsvp && (
            <p className="text-center text-sm text-gray-600 mt-3">
              You responded: <span className="font-semibold capitalize">{rsvp.status}</span>
            </p>
          )}
        </div>
      </div>

      {event.setlist && event.setlist.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
            <Music className="w-6 h-6" />
            Setlist ({event.setlist.length} songs)
          </h3>
          <div className="space-y-2">
            {event.setlist.map((songId, index) => {
              const song = getSongById(songId);
              if (!song) return null;
              return (
                <button
                  key={songId}
                  onClick={() => onNavigateToSong(songId)}
                  className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-blue-50 hover:shadow-md transition-all text-left group"
                >
                  <span className="text-lg font-bold text-gray-500 w-8 group-hover:text-blue-600">{index + 1}.</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 group-hover:text-blue-900">{song.title}</div>
                    <div className="text-sm text-gray-600">{song.composer}</div>
                  </div>
                  <div className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Music className="w-5 h-5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
