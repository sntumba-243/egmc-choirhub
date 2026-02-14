import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Calendar, Clock, MapPin, ArrowLeft, Edit, Users, Music, Eye, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description?: string;
  type: string;
}

interface RSVP {
  id: string;
  status: string;
  members: {
    first_name: string;
    last_name: string;
    voice_part: string;
  };
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

export const AdminEventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [eventSongs, setEventSongs] = useState<EventSong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEventAndRsvps();
    fetchEventSongs();
  }, [id]);

  const fetchEventAndRsvps = async () => {
    console.log('Fetching RSVPs for event:', id);
    try {
      const [eventRes, rsvpsRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).single(),
        supabase
          .from('rsvps')
          .select('id, status, members(first_name, last_name, voice_part)')
          .eq('event_id', id)
      ]);

      if (eventRes.error) throw eventRes.error;
      setEvent(eventRes.data);
      console.log('RSVPs response:', rsvpsRes);
      setRsvps(rsvpsRes.data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };


  const fetchEventSongs = async () => {
    console.log('🎵 Starting fetchEventSongs for event:', id);
    try {
      const { data, error } = await supabase
        .from('event_songs')
        .select(`
          id,
          song_id,
          songs:song_id (
            id,
            title,
            composer,
            language,
            sheet_music_url
          )
        `)
        .eq('event_id', id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }
      
      console.log('✅ Event songs loaded:', data?.length, 'songs');
      console.log('📦 Full data:', data);
      setEventSongs(data || []);
    } catch (error) {
      console.error('💥 Error loading event songs:', error);
    }
  };
  const removeSongFromEvent = async (eventSongId: string, songTitle: string) => {
    if (!confirm(`Remove "${songTitle}" from this event?`)) return;

    try {
      const { error } = await supabase
        .from('event_songs')
        .delete()
        .eq('id', eventSongId);

      if (error) throw error;

      setEventSongs(eventSongs.filter(es => es.id !== eventSongId));
      toast.success('Song removed from event');
    } catch (error) {
      console.error('Error removing song:', error);
      toast.error('Failed to remove song');
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
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Event not found</h2>
          <button
            onClick={() => navigate('/admin/events')}
            className="text-indigo-600 hover:text-indigo-700"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const rsvpCounts = {
    yes: rsvps.filter(r => r.status === 'yes').length,
    maybe: rsvps.filter(r => r.status === 'maybe').length,
    no: rsvps.filter(r => r.status === 'no').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/events')}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Events
        </button>
        <button
          onClick={() => navigate(`/admin/events/${id}/edit`)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Edit className="w-4 h-4" />
          Edit Event
        </button>
      </div>

      {/* Event Details */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">{event.title}</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Date</p>
              <p className="font-semibold">{formatDate(event.date)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Time</p>
              <p className="font-semibold">{event.time}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <MapPin className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Location</p>
              <p className="font-semibold">{event.location}</p>
            </div>
          </div>
        </div>

        {event.description && (
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
          </div>
        )}
      </div>

      {/* Songs Section */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Music className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Songs for This Event</h2>
              <p className="text-sm text-gray-600">{eventSongs.length} song{eventSongs.length !== 1 ? 's' : ''} assigned</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/admin/repertoire', { state: { addToEvent: id } })}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Songs
          </button>
        </div>

        {eventSongs.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
            <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No songs yet</h3>
            <p className="text-gray-600 mb-6">Add songs from your repertoire to this event</p>
            <button
              onClick={() => navigate('/admin/repertoire', { state: { addToEvent: id } })}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Browse Repertoire
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {eventSongs.map((eventSong) => {
              const song = eventSong.songs;
              if (!song) return null;

              return (
                <div
                  key={eventSong.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Music className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{song.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
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

                  <div className="flex items-center gap-2">
                    {song.sheet_music_url && (
                      <button
                        onClick={() => viewPDF(song)}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View PDF
                      </button>
                    )}
                    <button
                      onClick={() => removeSongFromEvent(eventSong.id, song.title)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove from event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RSVPs Section */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 p-3 rounded-lg">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">RSVPs</h2>
            <p className="text-sm text-gray-600">{rsvps.length} total response{rsvps.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* RSVP Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{rsvpCounts.yes}</div>
            <div className="text-sm text-gray-600 mt-1">Attending</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600">{rsvpCounts.maybe}</div>
            <div className="text-sm text-gray-600 mt-1">Maybe</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-3xl font-bold text-red-600">{rsvpCounts.no}</div>
            <div className="text-sm text-gray-600 mt-1">Not Attending</div>
          </div>
        </div>

        {/* RSVP Details */}
        {['yes', 'maybe', 'no'].map(status => {
          const statusRsvps = rsvps.filter(r => r.status === status);
          if (statusRsvps.length === 0) return null;

          const statusConfig = {
            yes: { label: 'Attending', color: 'green' },
            maybe: { label: 'Maybe', color: 'yellow' },
            no: { label: 'Not Attending', color: 'red' }
          };

          const config = statusConfig[status as keyof typeof statusConfig];

          return (
            <div key={status} className="mb-6 last:mb-0">
              <h3 className={`font-semibold text-${config.color}-600 mb-3`}>
                {config.label} ({statusRsvps.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {statusRsvps.map(rsvp => (
                  <div key={rsvp.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium">
                      {rsvp.members.first_name} {rsvp.members.last_name}
                    </div>
                    <div className="text-sm text-gray-600">{rsvp.members.voice_part}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {rsvps.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No RSVPs yet
          </div>
        )}
      </div>
    </div>
  );
};
