import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Calendar, Clock, MapPin, Music, Eye, Trash2, Search, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import SheetMusicViewer from '../../components/SheetMusicViewer';

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
  status: string;
  member_id: string;
  members: {
    first_name: string;
    last_name: string;
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
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [eventSongs, setEventSongs] = useState<EventSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [allSongs, setAllSongs] = useState<any[]>([]);
  const [songSearch, setSongSearch] = useState('');
  const [viewingSong, setViewingSong] = useState<any>(null);

  useEffect(() => {
    fetchEventAndRsvps();
    fetchEventSongs();
  }, [id]);

  const fetchEventAndRsvps = async () => {
    try {
      const [eventRes, rsvpsRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).single(),
        supabase
          .from('event_rsvps')
          .select('member_id, status')
          .eq('event_id', id)
      ]);

      if (eventRes.error) throw eventRes.error;

      // Verify event belongs to user's church (unless global)
      if (eventRes.data && !eventRes.data.is_global && user?.church_id && eventRes.data.church_id !== user.church_id) {
        toast.error('Access denied');
        navigate('/admin/events');
        return;
      }

      setEvent(eventRes.data);

      // member_id stores auth.uid(), which equals members.id
      const rsvpData = rsvpsRes.data || [];
      if (rsvpData.length > 0) {
        const memberIds = rsvpData.map(r => r.member_id);
        const { data: members } = await supabase
          .from('members')
          .select('id, first_name, last_name')
          .in('id', memberIds);

        const memberMap = new Map(
          (members || []).map(m => [m.id, { first_name: m.first_name, last_name: m.last_name }])
        );

        setRsvps(
          rsvpData
            .filter(r => memberMap.has(r.member_id))
            .map(r => ({
              status: r.status,
              member_id: r.member_id,
              members: memberMap.get(r.member_id)!,
            }))
        );
      } else {
        setRsvps([]);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load event details');
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
          songs:song_id (
            id,
            title,
            composer,
            language,
            sheet_music_url,
            updated_at
          )
        `)
        .eq('event_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setEventSongs(data || []);
    } catch (error) {
      console.error('Error loading event songs:', error);
    }
  };

  const fetchAllSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, composer, language')
        .order('title', { ascending: true });
      if (error) throw error;
      setAllSongs(data || []);
    } catch (error) {
      console.error('Error loading songs:', error);
    }
  };

  const addSongToEvent = async (songId: string) => {
    try {
      const { error } = await supabase
        .from('event_songs')
        .insert({ event_id: id, song_id: songId });
      if (error) {
        if (error.message?.includes('duplicate')) {
          toast.error('Song already in setlist');
          return;
        }
        throw error;
      }
      toast.success('Song added');
      fetchEventSongs();
    } catch (error) {
      console.error('Error adding song:', error);
      toast.error('Failed to add song');
    }
  };

  const openSongPicker = () => {
    if (allSongs.length === 0) fetchAllSongs();
    setShowSongPicker(true);
    setSongSearch('');
  };

  const removeSongFromEvent = async (eventSongId: string, songTitle: string) => {
    if (!confirm(`Remove "${songTitle}"?`)) return;

    try {
      const { error } = await supabase
        .from('event_songs')
        .delete()
        .eq('id', eventSongId);

      if (error) throw error;

      setEventSongs(eventSongs.filter(es => es.id !== eventSongId));
      toast.success('Song removed');
    } catch (error) {
      console.error('Error removing song:', error);
      toast.error('Failed to remove song');
    }
  };

  const viewPDF = (song: any) => {
    if (song.sheet_music_url) {
      setViewingSong(song);
    } else {
      toast.error('No PDF available');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Event not found</h2>
          <button onClick={() => navigate('/admin/events')} className="text-sm text-indigo-600">
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
    <div className="max-w-5xl mx-auto space-y-4 p-4">
      {/* Minimal Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/events')}
          className="text-sm text-gray-700 hover:text-gray-900 font-medium"
        >
          ← Back
        </button>
        <button
          onClick={() => navigate(`/admin/events/${id}/edit`)}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Edit
        </button>
      </div>

      {/* Event Details - Vibrant */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h1 className="text-xl font-bold text-gray-900 mb-3">{event.title}</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-600">Date</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{formatDate(event.date)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-600">Time</p>
              <p className="text-sm font-semibold text-gray-900">{event.time}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-600" />
            <div className="min-w-0">
              <p className="text-xs text-gray-600">Location</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{event.location}</p>
            </div>
          </div>
        </div>

        {event.description && (
          <div className="border-t pt-3">
            <p className="text-sm text-gray-700">{event.description}</p>
          </div>
        )}
      </div>

      {/* Songs Section - Vibrant */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900">
            Setlist ({eventSongs.length})
          </h2>

          <button
            onClick={openSongPicker}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            + Add
          </button>
        </div>

        {eventSongs.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <Music className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-600 mb-3">No songs added</p>
            <button
              onClick={openSongPicker}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              + Add Songs
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {eventSongs.map((eventSong, index) => {
              const song = eventSong.songs;
              if (!song) return null;

              return (
                <div
                  key={eventSong.id}
                  className="flex items-center justify-between p-2 bg-indigo-50 rounded hover:bg-indigo-100 border border-indigo-100"
                >
                  <div 
                    className={`flex items-center gap-2 flex-1 min-w-0 ${song.sheet_music_url ? 'cursor-pointer' : ''}`}
                    onClick={() => song.sheet_music_url && viewPDF(song)}
                  >
                    <span className="text-xs font-bold text-indigo-700">#{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-semibold text-gray-900 truncate ${song.sheet_music_url ? 'hover:text-indigo-700' : ''}`}>
                        {song.title}
                      </h4>
                      <p className="text-xs text-gray-700 truncate">{song.composer}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {song.sheet_music_url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          viewPDF(song);
                        }}
                        className="p-2 min-h-[44px] min-w-[44px] text-green-600 hover:bg-green-100 rounded"
                        title="View PDF"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSongFromEvent(eventSong.id, song.title);
                      }}
                      className="p-2 min-h-[44px] min-w-[44px] text-red-600 hover:bg-red-100 rounded"
                      title="Remove"
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

      {/* RSVPs Section - Vibrant */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3">
          RSVPs ({rsvps.length})
        </h2>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-3 bg-green-100 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-700">{rsvpCounts.yes}</div>
            <div className="text-xs font-medium text-green-700">Attending</div>
          </div>
          <div className="text-center p-3 bg-yellow-100 rounded-lg border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-700">{rsvpCounts.maybe}</div>
            <div className="text-xs font-medium text-yellow-700">Maybe</div>
          </div>
          <div className="text-center p-3 bg-red-100 rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-700">{rsvpCounts.no}</div>
            <div className="text-xs font-medium text-red-700">Not Attending</div>
          </div>
        </div>

        {['yes', 'maybe', 'no'].map(status => {
          const statusRsvps = rsvps.filter(r => r.status === status);
          if (statusRsvps.length === 0) return null;

          const labels = { yes: 'Attending', maybe: 'Maybe', no: 'Not Attending' };

          return (
            <div key={status} className="mb-3 last:mb-0">
              <h3 className="text-xs font-bold text-gray-700 mb-2">
                {labels[status as keyof typeof labels]} ({statusRsvps.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {statusRsvps.map((rsvp, idx) => (
                  <div key={idx} className="p-2 bg-gray-100 rounded border border-gray-200 text-xs">
                    <div className="font-semibold text-gray-900 truncate">
                      {rsvp.members.first_name} {rsvp.members.last_name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {rsvps.length === 0 && (
          <div className="text-center py-4 text-xs text-gray-600">
            No RSVPs yet
          </div>
        )}
      </div>

      {/* Song Picker Modal */}
      {showSongPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Songs to Setlist</h2>
              <button onClick={() => setShowSongPicker(false)} className="p-2 min-h-[44px] min-w-[44px] hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={songSearch}
                  onChange={(e) => setSongSearch(e.target.value)}
                  placeholder="Search songs..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {(() => {
                const existingSongIds = new Set(eventSongs.map(es => es.song_id));
                const filtered = allSongs.filter(s =>
                  !existingSongIds.has(s.id) &&
                  (songSearch === '' ||
                    s.title?.toLowerCase().includes(songSearch.toLowerCase()) ||
                    s.composer?.toLowerCase().includes(songSearch.toLowerCase()))
                );

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-8 text-sm text-gray-500">
                      {songSearch ? 'No matching songs found' : 'All songs already in setlist'}
                    </div>
                  );
                }

                return filtered.map(song => (
                  <button
                    key={song.id}
                    onClick={() => addSongToEvent(song.id)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-indigo-50 transition text-left group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-700">{song.title}</div>
                      <div className="text-xs text-gray-500 truncate">{song.composer} · {song.language}</div>
                    </div>
                    <Plus className="w-4 h-4 text-indigo-500 flex-shrink-0 ml-2" />
                  </button>
                ));
              })()}
            </div>

            <div className="p-3 border-t">
              <button
                onClick={() => setShowSongPicker(false)}
                className="w-full px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingSong && <SheetMusicViewer url={viewingSong.sheet_music_url} title={viewingSong.title} version={viewingSong.updated_at} onClose={() => setViewingSong(null)} />}
    </div>
  );
};
