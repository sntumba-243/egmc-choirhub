import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Calendar, MapPin, Music, ChevronUp, ChevronDown, X, Users, Check, HelpCircle, XCircle } from 'lucide-react';
import { eventsService, songsService, rsvpService, membersService, Event, Song, RSVP, Member } from '../../lib/database';

interface EventFormProps {
  eventId?: string;
  onBack: () => void;
}

export const EventForm: React.FC<EventFormProps> = ({ eventId, onBack }) => {
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    type: 'rehearsal',
    description: '',
    setlist: [] as string[],
  });
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState('');
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    loadSongs();
    loadMembers();
    if (eventId) {
      loadEvent();
      loadRSVPs();
    }
  }, [eventId]);

  const loadSongs = async () => {
    try {
      const data = await songsService.getSongs();
      setSongs(data);
    } catch (error) {
      console.error('Error loading songs:', error);
    }
  };

  const loadMembers = async () => {
    try {
      const data = await membersService.getMembers();
      setMembers(data);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const loadRSVPs = async () => {
    if (!eventId) return;
    try {
      const data = await rsvpService.getRSVPs(eventId);
      setRsvps(data);
    } catch (error) {
      console.error('Error loading RSVPs:', error);
    }
  };

  const loadEvent = async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const events = await eventsService.getEvents();
      const event = events.find(e => e.id === eventId);
      if (event) {
        setFormData({
          title: event.title,
          date: event.date,
          time: event.time,
          location: event.location,
          type: event.type,
          description: event.description || '',
          setlist: event.setlist || [],
        });
      }
    } catch (error) {
      console.error('Error loading event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.date || !formData.time || !formData.location.trim() || !formData.type) {
      alert('Title, Date, Time, Location, and Type are required');
      return;
    }

    setSaving(true);
    try {
      const eventData: Partial<Event> = {
        title: formData.title.trim(),
        date: formData.date,
        time: formData.time,
        location: formData.location.trim(),
        type: formData.type as 'rehearsal' | 'concert' | 'social' | 'other',
        description: formData.description.trim() || undefined,
        setlist: formData.setlist.length > 0 ? formData.setlist : undefined,
      };

      if (eventId) {
        await eventsService.updateEvent(eventId, eventData);
      } else {
        await eventsService.createEvent(eventData);
      }

      setSuccess(true);
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const addSongToSetlist = (songId: string) => {
    if (!formData.setlist.includes(songId)) {
      setFormData({ ...formData, setlist: [...formData.setlist, songId] });
    }
  };

  const removeSongFromSetlist = (songId: string) => {
    setFormData({
      ...formData,
      setlist: formData.setlist.filter(id => id !== songId),
    });
  };

  const moveSongUp = (index: number) => {
    if (index === 0) return;
    const newSetlist = [...formData.setlist];
    [newSetlist[index - 1], newSetlist[index]] = [newSetlist[index], newSetlist[index - 1]];
    setFormData({ ...formData, setlist: newSetlist });
  };

  const moveSongDown = (index: number) => {
    if (index === formData.setlist.length - 1) return;
    const newSetlist = [...formData.setlist];
    [newSetlist[index], newSetlist[index + 1]] = [newSetlist[index + 1], newSetlist[index]];
    setFormData({ ...formData, setlist: newSetlist });
  };

  const getSongById = (id: string): Song | undefined => {
    return songs.find(s => s.id === id);
  };

  const availableSongs = songs.filter(song => !formData.setlist.includes(song.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading event...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-900 font-semibold hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Events
        </button>

        <h2 className="text-2xl font-bold text-blue-900 mb-2">
          {eventId ? 'Edit Event' : 'Create New Event'}
        </h2>
        <p className="text-gray-600">
          {eventId ? 'Update event information' : 'Add a new event to the calendar'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Event Details
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Event Title <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Time <span className="text-red-600">*</span>
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={e => setFormData({ ...formData, time: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Location <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., St. Mary's Church"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Event Type <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="rehearsal">Rehearsal</option>
                <option value="concert">Concert</option>
                <option value="social">Social</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description <span className="text-gray-500 text-xs">(optional)</span>
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Add any additional details about the event..."
              />
            </div>

          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
            <Music className="w-5 h-5" />
            Setlist
          </h3>
          <p className="text-sm text-gray-600 mb-4">Select songs for this event (optional)</p>

          {availableSongs.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Add Song</label>
              <select
                value={selectedSongId}
                onChange={e => {
                  setSelectedSongId(e.target.value);
                  if (e.target.value) {
                    addSongToSetlist(e.target.value);
                    setSelectedSongId('');
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a song to add...</option>
                {availableSongs.map(song => (
                  <option key={song.id} value={song.id}>
                    {song.title} - {song.composer}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.setlist.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700 mb-2">Selected Songs</p>
              {formData.setlist.map((songId, index) => {
                const song = getSongById(songId);
                if (!song) return null;
                return (
                  <div
                    key={songId}
                    className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-bold text-gray-500 w-8">{index + 1}.</span>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{song.title}</div>
                      <div className="text-sm text-gray-600">{song.composer}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveSongUp(index)}
                        disabled={index === 0}
                        className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSongDown(index)}
                        disabled={index === formData.setlist.length - 1}
                        className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSongFromSetlist(songId)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No songs added to setlist yet</p>
          )}
        </div>

        {eventId && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Attendance ({rsvps.length} responses)
            </h3>
            <p className="text-sm text-gray-600 mb-4">See who has responded to this event</p>

            {rsvps.length > 0 ? (
              <div className="space-y-1">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-green-700 font-semibold mb-1">
                      <Check className="w-4 h-4" />
                      <span className="text-lg">{rsvps.filter(r => r.status === 'yes').length}</span>
                    </div>
                    <div className="text-xs text-green-600">Attending</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-yellow-700 font-semibold mb-1">
                      <HelpCircle className="w-4 h-4" />
                      <span className="text-lg">{rsvps.filter(r => r.status === 'maybe').length}</span>
                    </div>
                    <div className="text-xs text-yellow-600">Maybe</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-red-700 font-semibold mb-1">
                      <XCircle className="w-4 h-4" />
                      <span className="text-lg">{rsvps.filter(r => r.status === 'no').length}</span>
                    </div>
                    <div className="text-xs text-red-600">Not Attending</div>
                  </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {['yes', 'maybe', 'no'].map(status => {
                    const statusRsvps = rsvps.filter(r => r.status === status);
                    if (statusRsvps.length === 0) return null;

                    const statusColors = {
                      yes: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: Check },
                      maybe: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: HelpCircle },
                      no: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
                    }[status];

                    const Icon = statusColors.icon;

                    return (
                      <div key={status} className="border-t pt-2">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 capitalize">
                          {status === 'yes' ? 'Attending' : status === 'maybe' ? 'Maybe' : 'Not Attending'}
                        </h4>
                        <div className="space-y-1">
                          {statusRsvps.map(rsvp => {
                            const member = members.find(m => m.id === rsvp.user_id);
                            return (
                              <div
                                key={rsvp.id}
                                className={`flex items-center gap-3 p-3 ${statusColors.bg} border ${statusColors.border} rounded-lg`}
                              >
                                <Icon className={`w-4 h-4 ${statusColors.text}`} />
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900">
                                    {member?.name || 'Unknown Member'}
                                  </div>
                                  {member?.voice_part && (
                                    <div className="text-xs text-gray-600 capitalize">{member.voice_part}</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No responses yet</p>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-md p-6 flex gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-900 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Event'}
          </button>
        </div>
      </form>

      {success && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
            <span className="text-green-600 text-sm">✓</span>
          </div>
          Event saved successfully!
        </div>
      )}
    </div>
  );
};
