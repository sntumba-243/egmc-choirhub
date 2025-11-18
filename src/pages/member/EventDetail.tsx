import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Calendar, Clock, MapPin, Music, ArrowLeft, Users, Eye } from 'lucide-react';
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
  
  console.log('EventDetail - eventId from useParams:', eventId);
  console.log('EventDetail - user:', user);
  
  const [event, setEvent] = useState<Event | null>(null);
  const [eventSongs, setEventSongs] = useState<EventSong[]>([]);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      fetchEventSongs();
      checkRsvpStatus();
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
      console.log('Event songs loaded:', data?.length);
      setEventSongs(data || []);
    } catch (error) {
      console.error('Error loading event songs:', error);
    }
  };

  const checkRsvpStatus = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('rsvps')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .single();

      if (data) {
        setRsvpStatus(data.status);
      }
    } catch (error) {
      console.log('No RSVP found yet');
    }
  };

  const handleRsvp = async (status: string) => {
    if (!user || !event) return;

    // Map UI values to database values
    const dbStatusMap: { [key: string]: string } = {
      'attending': 'yes',
      'not attending': 'no',
      'maybe': 'maybe'
    };
    
    const dbStatus = dbStatusMap[status] || status;

    try {
      if (rsvpStatus) {
        const { error } = await supabase
          .from('rsvps')
          .update({ status: dbStatus })
          .eq('event_id', event.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rsvps')
          .insert([{
            event_id: event.id,
            user_id: user.id,
            status: dbStatus
          }]);

        if (error) throw error;
      }

      setRsvpStatus(status);
      toast.success(`RSVP updated: ${status}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update RSVP');
    }
  };

  const viewPDF = (song: any) => {
    if (song.sheet_music_url) {
      navigate('/pdf-viewer', {
        state: {
          url: song.sheet_music_url,
          title: song.title,
        },
      });
    } else {
      toast.error('No PDF available for this song');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return <div className="flex justify-center p-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>;
  }

  if (!event) {
    return <div className="text-center p-12">
      <p className="text-gray-600 mb-4">Event not found</p>
      <button onClick={() => navigate('/member/calendar')} className="text-indigo-600">Back to Calendar</button>
    </div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <button onClick={() => navigate('/member/calendar')} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700">
        <ArrowLeft className="w-5 h-5" />
        Back to Calendar
      </button>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{event.title}</h1>
          {event.type && (
            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm">
              {event.type}
            </span>
          )}
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <div>
                <div className="text-sm text-gray-600">Date</div>
                <div className="font-semibold">{formatDate(event.date)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-indigo-600" />
              <div>
                <div className="text-sm text-gray-600">Time</div>
                <div className="font-semibold">{formatTime(event.time)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-indigo-600" />
              <div>
                <div className="text-sm text-gray-600">Location</div>
                <div className="font-semibold">{event.location}</div>
              </div>
            </div>
          </div>

          {event.description && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <p className="text-gray-700">{event.description}</p>
            </div>
          )}

          {/* Songs Section */}
          {eventSongs.length > 0 && (
            <div className="border-t pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Music className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold">Songs for This Event ({eventSongs.length})</h3>
              </div>
              <div className="space-y-3">
                {eventSongs.map((eventSong, index) => {
                  const song = eventSong.songs;
                  if (!song) return null;

                  return (
                    <div
                      key={eventSong.id}
                      onClick={() => song.sheet_music_url && viewPDF(song)}
                      className={`flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-indigo-50 transition-all ${
                        song.sheet_music_url ? 'cursor-pointer' : ''
                      }`}
                      title={song.sheet_music_url ? 'Click to view sheet music' : ''}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-sm font-semibold text-indigo-600 bg-indigo-100 w-8 h-8 rounded-full flex items-center justify-center">
                          #{index + 1}
                        </span>
                        <Music className="w-5 h-5 text-gray-400" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{song.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-600">{song.composer}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              song.language === 'English' ? 'bg-blue-100 text-blue-800' :
                              song.language === 'French' ? 'bg-purple-100 text-purple-800' :
                              song.language === 'Lingala' ? 'bg-green-100 text-green-800' :
                              song.language === 'Tshiluba' ? 'bg-yellow-100 text-yellow-800' :
                              song.language === 'Swahili' ? 'bg-teal-100 text-teal-800' :
                              song.language === 'Kikongo' ? 'bg-orange-100 text-orange-800' :
                              song.language === 'Portuguese' ? 'bg-pink-100 text-pink-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {song.language}
                            </span>
                          </div>
                        </div>
                      </div>

                      {song.sheet_music_url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            viewPDF(song);
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="View sheet music"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {event.requires_rsvp && (
            <div className="border-t pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold">RSVP</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleRsvp('attending')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    rsvpStatus === 'attending'
                      ? 'bg-green-600 text-white'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  ✓ Attending
                </button>
                <button
                  onClick={() => handleRsvp('maybe')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    rsvpStatus === 'maybe'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                  }`}
                >
                  ? Maybe
                </button>
                <button
                  onClick={() => handleRsvp('not attending')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    rsvpStatus === 'not attending'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                  }`}
                >
                  ✗ Not Attending
                </button>
              </div>
              {rsvpStatus && (
                <p className="text-sm text-gray-600 mt-3 text-center">
                  Your RSVP: <strong className="capitalize">{rsvpStatus}</strong>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
