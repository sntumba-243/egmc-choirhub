import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Music, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface Song {
  id: string;
  title: string;
  composer: string;
}

export const EventForm: React.FC = () => {
  const navigate = useNavigate();
  const { id: eventId } = useParams();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [requiresRsvp, setRequiresRsvp] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Setlist
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [searchSong, setSearchSong] = useState('');

  useEffect(() => {
    fetchSongs();
    if (eventId) loadEvent();
  }, [eventId]);

  const fetchSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, composer')
        .order('title', { ascending: true });

      if (error) throw error;
      setAvailableSongs(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      if (data) {
        setTitle(data.title);
        setDate(data.date);
        setTime(data.time);
        setLocation(data.location);
        setDescription(data.description || '');
        setType(data.type || '');
        setRequiresRsvp(data.requires_rsvp);
       const { data: eventSongs } = await supabase
  .from('event_songs')
  .select('song_id')
  .eq('event_id', eventId);

if (eventSongs && eventSongs.length > 0) {
  setSelectedSongIds(eventSongs.map(es => es.song_id));
} else if (data.setlist && data.setlist.length > 0) {
  // Fallback to setlist column if event_songs is empty
  setSelectedSongIds(data.setlist);
}
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load event');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const eventData = {
        title,
        date,
        time,
        location,
        description,
        type,
        requires_rsvp: requiresRsvp,
        setlist: selectedSongIds
      };

      if (eventId) {
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', eventId);
        if (error) throw error;
        toast.success('Event updated');
        try { 
          await supabase.from('event_songs').delete().eq('event_id', eventId);
  if (selectedSongIds.length > 0) {
    const eventSongs = selectedSongIds.map(songId => ({
      event_id: eventId,
      song_id: songId
    }));
    const { error: syncError } = await supabase.from('event_songs').insert(eventSongs);
    if (syncError) console.error('Failed to sync songs:', syncError);
  }
} catch (err) {
  console.error('Error syncing to event_songs:', err);
}
      } else {
        const { error } = await supabase
          .from('events')
          .insert([eventData]);
        if (error) throw error;
        toast.success('Event created');
        try {
  if (selectedSongIds.length > 0 && data?.id) {
    const eventSongs = selectedSongIds.map(songId => ({
      event_id: data.id,
      song_id: songId
    }));
    const { error: syncError } = await supabase.from('event_songs').insert(eventSongs);
    if (syncError) console.error('Failed to sync songs on create:', syncError);
  }
} catch (err) {
  console.error('Error syncing to event_songs on create:', err);
}
      }

      navigate('/admin/events');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const addSong = (songId: string) => {
    if (!selectedSongIds.includes(songId)) {
      setSelectedSongIds([...selectedSongIds, songId]);
    }
    setSearchSong('');
  };

  const removeSong = (songId: string) => {
    setSelectedSongIds(selectedSongIds.filter(id => id !== songId));
  };

  const selectedSongs = availableSongs.filter(s => selectedSongIds.includes(s.id));
  const filteredAvailableSongs = availableSongs.filter(s => 
    !selectedSongIds.includes(s.id) &&
    searchSong &&
    ((s.title && s.title.toLowerCase().includes(searchSong.toLowerCase())) ||
     (s.composer && s.composer.toLowerCase().includes(searchSong.toLowerCase())))
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin/events')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold">{eventId ? 'Edit Event' : 'Add New Event'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Event Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Thanksgiving Services"
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              placeholder="e.g. EGMC Main Hall"
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Type (Optional)</option>
            <option value="Service">Service</option>
            <option value="Rehearsal">Rehearsal</option>
            <option value="Performance">Performance</option>
            <option value="Social">Social Event</option>
            <option value="Meeting">Meeting</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Add event details..."
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Setlist Section */}
        <div className="border-t pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Music className="w-5 h-5 text-indigo-600" />
            <label className="text-sm font-medium text-gray-700">Setlist ({selectedSongs.length} songs)</label>
          </div>

          {/* Selected Songs */}
          {selectedSongs.length > 0 && (
            <div className="mb-4 space-y-2">
              {selectedSongs.map((song, index) => (
                <div key={song.id} className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-indigo-600">#{index + 1}</span>
                    <div>
                      <div className="font-medium">{song.title}</div>
                      <div className="text-sm text-gray-600">{song.composer}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSong(song.id)}
                    className="p-1 hover:bg-indigo-100 rounded"
                  >
                    <X className="w-4 h-4 text-indigo-600" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Songs */}
          <div>
            <input
              type="text"
              value={searchSong}
              onChange={(e) => setSearchSong(e.target.value)}
              placeholder="Search songs to add..."
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 mb-2"
            />
            {searchSong && (
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                {filteredAvailableSongs.map((song) => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => addSong(song.id)}
                    className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <div className="font-medium">{song.title}</div>
                    <div className="text-sm text-gray-600">{song.composer}</div>
                  </button>
                ))}
                {filteredAvailableSongs.length === 0 && (
                  <div className="p-4 text-center text-gray-500">No songs found</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
          <input
            type="checkbox"
            id="requires_rsvp"
            checked={requiresRsvp}
            onChange={(e) => setRequiresRsvp(e.target.checked)}
            className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
          />
          <label htmlFor="requires_rsvp" className="text-sm font-medium text-gray-700 cursor-pointer">
            Require RSVP for this event
          </label>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/admin/events')}
            className="flex-1 px-6 py-3 border text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Saving...' : (eventId ? 'Update Event' : 'Create Event')}
          </button>
        </div>
      </form>
    </div>
  );
};
