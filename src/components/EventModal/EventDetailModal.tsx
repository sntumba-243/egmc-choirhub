import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Clock, MapPin, Music, X, Users, Check, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
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
}

interface EventSong {
  id: string;
  song_id: string;
  songs: {
    id: string;
    title: string;
    composer: string;
    pdf_url?: string;
  };
}

interface EventDetailModalProps {
  event: Event;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [eventSongs, setEventSongs] = useState<EventSong[]>([]);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  useEffect(() => {
    fetchEventSongs();
    checkRsvpStatus();
  }, [event.id]);

  const fetchEventSongs = async () => {
    try {
      const { data } = await supabase
        .from('event_songs')
        .select(`
          id,
          song_id,
          songs (id, title, composer, pdf_url)
        `)
        .eq('event_id', event.id);

      setEventSongs(data || []);
    } catch (error) {
      console.error('Error fetching event songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkRsvpStatus = async () => {
    if (!user?.id) return;

    try {
      const { data } = await supabase
        .from('rsvps')
        .select('status')
        .eq('event_id', event.id)
        .eq('member_id', user.id)
        .single();

      setRsvpStatus(data?.status || null);
    } catch (error) {
      // No RSVP found
    }
  };

  const handleRsvp = async (status: 'attending' | 'not_attending') => {
    if (!user?.id) {
      toast.error('Please log in to RSVP');
      return;
    }

    setRsvpLoading(true);
    try {
      if (rsvpStatus) {
        await supabase
          .from('rsvps')
          .update({ status })
          .eq('event_id', event.id)
          .eq('member_id', user.id);
      } else {
        await supabase
          .from('rsvps')
          .insert({
            event_id: event.id,
            member_id: user.id,
            status
          });
      }

      setRsvpStatus(status);
      toast.success(status === 'attending' ? 'You\'re attending!' : 'RSVP updated');
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast.error('Failed to update RSVP');
    } finally {
      setRsvpLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold">{event.title}</h2>
              {event.type && (
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full mt-1 inline-block">
                  {event.type}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Date, Time, Location */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center text-gray-700">
              <Calendar className="w-5 h-5 text-purple-600 mr-3" />
              <span>{formatDate(event.date)}</span>
            </div>
            {event.time && (
              <div className="flex items-center text-gray-700">
                <Clock className="w-5 h-5 text-purple-600 mr-3" />
                <span>{formatTime(event.time)}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center text-gray-700">
                <MapPin className="w-5 h-5 text-purple-600 mr-3" />
                <span>{event.location}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-4">
              <p className="text-gray-600 text-sm">{event.description}</p>
            </div>
          )}

          {/* RSVP Section */}
          {event.requires_rsvp && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Users className="w-5 h-5 mr-2 text-purple-600" />
                RSVP
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRsvp('attending')}
                  disabled={rsvpLoading}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                    rsvpStatus === 'attending'
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-green-500'
                  }`}
                >
                  {rsvpStatus === 'attending' && <Check className="w-4 h-4 inline mr-1" />}
                  Attending
                </button>
                <button
                  onClick={() => handleRsvp('not_attending')}
                  disabled={rsvpLoading}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                    rsvpStatus === 'not_attending'
                      ? 'bg-red-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-red-500'
                  }`}
                >
                  {rsvpStatus === 'not_attending' && <X className="w-4 h-4 inline mr-1" />}
                  Can't Make It
                </button>
              </div>
            </div>
          )}

          {/* Event Songs */}
          {eventSongs.length > 0 && (
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Music className="w-5 h-5 mr-2 text-purple-600" />
                Songs for this Event ({eventSongs.length})
              </h3>
              <div className="space-y-2">
                {eventSongs.map((es) => (
                  <button
                    key={es.id}
                    onClick={() => {
                      onClose();
                      if (es.songs.pdf_url) {
                        navigate('/pdf-viewer', { 
                          state: { 
                            pdfUrl: es.songs.pdf_url,
                            title: es.songs.title
                          } 
                        });
                      } else {
                        navigate(`/member/repertoire/${es.songs.id}`);
                      }
                    }}
                    className="w-full flex items-center justify-between bg-white rounded-lg p-3 hover:shadow-md transition-all text-left"
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{es.songs.title}</p>
                      <p className="text-xs text-gray-500">{es.songs.composer}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
