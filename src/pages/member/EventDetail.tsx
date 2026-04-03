import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Calendar, Clock, MapPin, Music, Eye, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
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
    language: string;
    sheet_music_url?: string;
  };
}

export const EventDetail = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [eventSongs, setEventSongs] = useState<EventSong[]>([]);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [rsvpCount, setRsvpCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      fetchEventSongs();
      checkRsvpStatus();
      fetchRsvpCount();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const { data: eventData, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      setEvent(eventData);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const fetchEventSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('event_songs')
        .select(`
          id,
          song_id,
          songs (
            id,
            title,
            composer,
            language,
            sheet_music_url
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setEventSongs(data || []);
    } catch (error) {
      console.error('Error loading event songs:', error);
    }
  };

  const checkRsvpStatus = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('event_rsvps')
        .select('status')
        .eq('event_id', eventId)
        .eq('member_id', user.id)
        .single();

      if (data) {
        setRsvpStatus(data.status);
      }
    } catch (error) {
      console.log('No RSVP found yet');
    }
  };

  const fetchRsvpCount = async () => {
    try {
      const { count, error } = await supabase
        .from('event_rsvps')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'yes');

      if (!error && count !== null) {
        setRsvpCount(count);
      }
    } catch (error) {
      console.error('Error fetching RSVP count:', error);
    }
  };

  const handleRsvp = async (status: 'yes' | 'no' | 'maybe') => {
    if (!user || !event) return;

    try {
      const { error } = await supabase
        .from('event_rsvps')
        .upsert({
          event_id: event.id,
          member_id: user.id,
          status,
        }, { onConflict: 'event_id,member_id' });

      if (error) throw error;

      setRsvpStatus(status);
      // Update count optimistically
      setRsvpCount((prev) => {
        let delta = 0;
        if (status === 'yes' && rsvpStatus !== 'yes') delta = 1;
        if (status !== 'yes' && rsvpStatus === 'yes') delta = -1;
        return Math.max(0, prev + delta);
      });
      toast.success(`RSVP: ${status}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update RSVP');
    }
  };

  const viewPDF = (song: any) => {
    if (song.sheet_music_url) {
      navigate('/pdf-viewer', { state: { url: song.sheet_music_url, title: song.title } });
    } else {
      toast.error('No PDF available');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
    </div>;
  }

  if (!event) {
    return <div className="text-center p-8">
      <p className="text-sm text-gray-700 mb-3">Event not found</p>
      <button onClick={() => navigate('/member/calendar')} className="text-sm text-orange-600 font-medium">Back to Calendar</button>
    </div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-4">
      <button onClick={() => navigate('/member/calendar')} className="text-sm text-gray-700 hover:text-gray-900 font-medium">
        ← Back
      </button>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-4 text-white">
          <h1 className="text-xl font-bold">{event.title}</h1>
          {event.type && (
            <span className="text-xs font-medium opacity-90 mt-1 inline-block">{event.type}</span>
          )}
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-600" />
              <div className="min-w-0">
                <div className="text-xs text-gray-600">Date</div>
                <div className="text-sm font-semibold text-gray-900 truncate">{formatDate(event.date)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <div className="min-w-0">
                <div className="text-xs text-gray-600">Time</div>
                <div className="text-sm font-semibold text-gray-900">{formatTime(event.time)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-600" />
              <div className="min-w-0">
                <div className="text-xs text-gray-600">Location</div>
                <div className="text-sm font-semibold text-gray-900 truncate">{event.location}</div>
              </div>
            </div>
          </div>

          {event.description && (
            <div className="border-t pt-3">
              <p className="text-sm text-gray-700">{event.description}</p>
            </div>
          )}

          {eventSongs.length > 0 && (
            <div className="border-t pt-3">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Setlist ({eventSongs.length})</h3>
              <div className="space-y-1.5">
                {eventSongs.map((eventSong, index) => {
                  const song = eventSong.songs;
                  if (!song) return null;

                  return (
                    <div
                      key={eventSong.id}
                      onClick={() => song.sheet_music_url && viewPDF(song)}
                      className={`flex items-center justify-between p-2 bg-orange-50 rounded hover:bg-orange-100 border border-orange-100 ${
                        song.sheet_music_url ? 'cursor-pointer' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-bold text-orange-700">#{index + 1}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-semibold text-gray-900 truncate ${song.sheet_music_url ? 'hover:text-orange-700' : ''}`}>
                            {song.title}
                          </h4>
                          <p className="text-xs text-gray-700 truncate">{song.composer}</p>
                        </div>
                      </div>

                      {song.sheet_music_url && (
                        <Eye className="w-4 h-4 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vibrant RSVP */}
          {event.requires_rsvp && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-700">Will you attend?</h3>
                {rsvpCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-500">{rsvpCount} attending</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRsvp('yes')}
                  className={`flex-1 py-2.5 rounded text-sm font-bold transition ${
                    rsvpStatus === 'yes'
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'
                  }`}
                >
                  Yes
                </button>
                <button
                  onClick={() => handleRsvp('maybe')}
                  className={`flex-1 py-2.5 rounded text-sm font-bold transition ${
                    rsvpStatus === 'maybe'
                      ? 'bg-yellow-600 text-white shadow-md'
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-200'
                  }`}
                >
                  Maybe
                </button>
                <button
                  onClick={() => handleRsvp('no')}
                  className={`flex-1 py-2.5 rounded text-sm font-bold transition ${
                    rsvpStatus === 'no'
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
