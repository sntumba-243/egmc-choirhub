import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Star, Music, Calendar, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

interface Song {
  id: string;
  title: string;
  composer: string;
  language: string;
  sheet_music_url?: string;
}

interface Event {
  id: string;
  title: string;
  date: string;
  type: string;
}

export const AdminFavorites = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [showEventModal, setShowEventModal] = useState(false);

  useEffect(() => {
    fetchFavorites();
    fetchUpcomingEvents();
  }, []);

  const fetchFavorites = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select(`
          song_id,
          songs (*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const favSongs = data?.map((fav: any) => fav.songs).filter(Boolean) || [];
      setFavorites(favSongs);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, date, type')
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true })
        .limit(10);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const removeFavorite = async (songId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('song_id', songId);

      if (error) throw error;

      setFavorites(favorites.filter(s => s.id !== songId));
      toast.success('Removed from favorites');
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Failed to remove favorite');
    }
  };

  const toggleSongSelection = (songId: string) => {
    const newSelection = new Set(selectedSongs);
    if (newSelection.has(songId)) {
      newSelection.delete(songId);
    } else {
      newSelection.add(songId);
    }
    setSelectedSongs(newSelection);
  };

  const addSongsToEvent = async (eventId: string) => {
    if (selectedSongs.size === 0) {
      toast.error('No songs selected');
      return;
    }

    try {
      // Check if event_songs table exists and add songs
      const songsToAdd = Array.from(selectedSongs).map(songId => ({
        event_id: eventId,
        song_id: songId,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('event_songs')
        .insert(songsToAdd);

      if (error) throw error;

      toast.success(`Added ${selectedSongs.size} songs to event`);
      setSelectedSongs(new Set());
      setShowEventModal(false);
    } catch (error: any) {
      console.error('Error adding songs to event:', error);
      
      // If event_songs table doesn't exist, show helpful message
      if (error.message?.includes('relation "event_songs" does not exist')) {
        toast.error('Event songs table not set up yet. Check setup instructions.');
      } else {
        toast.error('Failed to add songs to event');
      }
    }
  };

  const viewPDF = (song: Song) => {
    if (song.sheet_music_url) {
      navigate('/pdf-viewer', {
        state: {
          url: song.sheet_music_url,
          title: song.title,
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading favorites...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
          <h1 className="text-3xl font-bold text-gray-900">Favorite Songs</h1>
        </div>

        {selectedSongs.size > 0 && (
          <button
            onClick={() => setShowEventModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Add {selectedSongs.size} to Event
          </button>
        )}
      </div>

      {/* Empty State */}
      {favorites.length === 0 && (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Favorites Yet</h2>
          <p className="text-gray-600 mb-6">
            Star songs in the repertoire to add them to your favorites
          </p>
          <button
            onClick={() => navigate('/admin/repertoire')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Browse Repertoire
          </button>
        </div>
      )}

      {/* Favorites List */}
      {favorites.length > 0 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <p className="text-sm text-gray-600">
              {favorites.length} favorite song{favorites.length !== 1 ? 's' : ''}
              {selectedSongs.size > 0 && ` · ${selectedSongs.size} selected`}
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {favorites.map((song) => (
              <div
                key={song.id}
                className={`p-4 hover:bg-gray-50 transition-colors ${
                  selectedSongs.has(song.id) ? 'bg-indigo-50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedSongs.has(song.id)}
                    onChange={() => toggleSongSelection(song.id)}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  />

                  {/* Song Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Music className="w-4 h-4 text-gray-400" />
                      <h3 className="font-semibold text-gray-900">{song.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
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

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {song.sheet_music_url && (
                      <button
                        onClick={() => viewPDF(song)}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        View PDF
                      </button>
                    )}
                    <button
                      onClick={() => removeFavorite(song.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove from favorites"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Selection Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Add to Event
            </h2>

            {events.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No upcoming events</p>
                <button
                  onClick={() => {
                    setShowEventModal(false);
                    navigate('/admin/events');
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create Event
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => addSongsToEvent(event.id)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{event.title}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(event.date).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowEventModal(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
