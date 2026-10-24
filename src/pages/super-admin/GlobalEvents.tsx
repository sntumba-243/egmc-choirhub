import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDbClient } from '../../lib/supabase';
import { createSearcher, SONG_KEYS } from '../../lib/smartSearch';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Plus, Clock, MapPin, Trash2, Edit, Globe, Music, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { endDateError, eventRangeLabel, formatEventDates, isEventPast } from '../../lib/eventDates';

interface GlobalEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  end_date?: string | null;
  time: string;
  location: string;
  type?: string;
  is_global: boolean;
}

export const GlobalEvents = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState<GlobalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    type: 'concert',
  });
  const [endDate, setEndDate] = useState('');

  const [allSongs, setAllSongs] = useState<{id: string; title: string; composer?: string}[]>([]);
  // Church targeting: no event_churches rows = all churches.
  const [churches, setChurches] = useState<{ id: string; name: string; short_name: string; is_active: boolean }[]>([]);
  const [targets, setTargets] = useState<Record<string, string[]>>({});
  const [allChurches, setAllChurches] = useState(true);
  const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [songSearch, setSongSearch] = useState('');
  useEffect(() => {
    fetchEvents();
    fetchSongs();
    fetchChurches();
  }, []);

  const fetchEvents = async () => {
    try {
      const supabase = getDbClient();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_global', true)
        .order('date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);

      const ids = (data || []).map(e => e.id);
      if (ids.length > 0) {
        const { data: rows, error: targetsError } = await supabase
          .from('event_churches')
          .select('event_id, church_id')
          .in('event_id', ids);
        if (targetsError) throw targetsError;
        const map: Record<string, string[]> = {};
        for (const r of rows || []) (map[r.event_id] = map[r.event_id] || []).push(r.church_id);
        setTargets(map);
      } else {
        setTargets({});
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load global events');
    } finally {
      setLoading(false);
    }
  };


  const fetchChurches = async () => {
    try {
      const supabase = getDbClient();
      const { data } = await supabase.from('churches').select('id, name, short_name, is_active').order('name');
      setChurches(data || []);
    } catch (e) { console.error('Error fetching churches:', e); }
  };

  // Replace the event's church targeting: no rows = all churches.
  const saveTargets = async (eventId: string) => {
    const supabase = getDbClient();
    const { error: delError } = await supabase.from('event_churches').delete().eq('event_id', eventId);
    if (delError) throw delError;
    if (!allChurches && selectedChurchIds.length > 0) {
      const { error } = await supabase
        .from('event_churches')
        .insert(selectedChurchIds.map(church_id => ({ event_id: eventId, church_id })));
      if (error) throw error;
    }
  };

  // Replace the event's setlist.
  const saveSongs = async (eventId: string) => {
    const supabase = getDbClient();
    const { error: delError } = await supabase.from('event_songs').delete().eq('event_id', eventId);
    if (delError) throw delError;
    if (selectedSongIds.length > 0) {
      const { error } = await supabase.from('event_songs').insert(
        selectedSongIds.map((songId, i) => ({ event_id: eventId, song_id: songId, song_order: i + 1 }))
      );
      if (error) throw error;
    }
  };

  const fetchSongs = async () => {
    try {
      const supabase = getDbClient();
      const { data } = await supabase.from('songs').select('id, title, composer').order('title');
      setAllSongs(data || []);
    } catch (e) { console.error('Error fetching songs:', e); }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.time || !form.location) {
      toast.error('Please fill in all required fields');
      return;
    }
    const rangeError = endDateError(form.date, endDate);
    if (rangeError) { toast.error(rangeError); return; }
    if (!allChurches && selectedChurchIds.length === 0) {
      toast.error('Select at least one church, or choose All churches');
      return;
    }

    setSaving(true);
    try {
      const supabase = getDbClient();

      if (editingId) {
        const { error } = await supabase
          .from('events')
          .update({
            ...form,
            end_date: endDate && endDate !== form.date ? endDate : null,
            is_global: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);
        if (error) throw error;

        await saveTargets(editingId);
        await saveSongs(editingId);
        toast.success('Event updated!');
      } else {
        const { data: newEvent, error } = await supabase
          .from('events')
          .insert([{
            ...form,
            end_date: endDate && endDate !== form.date ? endDate : null,
            is_global: true,
            church_id: user?.church_id,
            requires_rsvp: true,
          }])
          .select('id')
          .single();
        if (error) throw error;
        if (!newEvent) throw new Error('Event was not created');

        await saveTargets(newEvent.id);
        await saveSongs(newEvent.id);
        toast.success('Global event created!');
      }

      resetForm();
      fetchEvents();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (event: GlobalEvent) => {
    setForm({
      title: event.title,
      description: event.description || '' ,
      date: event.date,
      time: event.time,
      location: event.location,
      type: event.type || 'concert',
    });
    setEndDate(event.end_date || '');
    setEditingId(event.id);
    const eventTargets = targets[event.id] || [];
    setAllChurches(eventTargets.length === 0);
    setSelectedChurchIds(eventTargets);

    // Load existing songs for this event
    try {
      const supabase = getDbClient();
      const { data } = await supabase.from('event_songs').select('song_id').eq('event_id', event.id).order('song_order');
      setSelectedSongIds(data?.map(es => es.song_id) || []);
    } catch (e) { setSelectedSongIds([]); }

    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this global event? No church will see it any more.')) return;
    try {
      const supabase = getDbClient();
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      toast.success('Event deleted');
      fetchEvents();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to delete event');
    }
  };

  const resetForm = () => {
    setForm({ title: '' , description: '' , date: '' , time: '' , location: '' , type: 'concert' });
    setEndDate('');
    setEditingId(null);
    setSelectedSongIds([]);
    setSongSearch('' );
    setAllChurches(true);
    setSelectedChurchIds([]);
    setShowForm(false);
  };

  const isPast = (e: GlobalEvent) => isEventPast(e, ev => new Date(ev.date + 'T23:59:59') < new Date());

  // 'All churches' or e.g. 'EGMC +2'.
  const targetLabel = (eventId: string) => {
    const ids = targets[eventId] || [];
    if (ids.length === 0) return 'All churches';
    const names = ids.map(id => churches.find(c => c.id === id)?.short_name || '?').sort();
    return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
  };
  const targetTitle = (eventId: string) =>
    (targets[eventId] || []).map(id => churches.find(c => c.id === id)?.name || id).join(', ') || 'All churches';
  // Active churches, plus any inactive one an event is already targeted at.
  const pickableChurches = churches.filter(c => c.is_active || selectedChurchIds.includes(c.id));
  const upcoming = events.filter(e => !isPast(e));
  const past = events.filter(e => isPast(e));

  // Setlist picker: fuzzy, accent/typo-tolerant, ranked; empty query = all songs.
  const songSearcher = useMemo(() => createSearcher(allSongs, SONG_KEYS), [allSongs]);
  const songPickerResults = songSearcher(songSearch).slice(0, 50);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-2 rounded-lg">
            <Globe className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Global Events</h1>
            <p className="text-xs text-gray-600">Visible to all churches, or only the ones you choose</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center justify-center gap-1 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700"
        >
          <Plus className="w-4 h-4" /> New Global Event
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-bold text-lg">{editingId ? 'Edit Event' : 'Create Global Event'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From *</label>
              <input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="date" value={endDate} min={form.date || undefined} onChange={(e) => setEndDate(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-slate-500 ${endDateError(form.date, endDate) ? 'border-red-400' : 'border-gray-300'}`} />
              {endDateError(form.date, endDate) && <p className="text-xs text-red-600 mt-1">{endDateError(form.date, endDate)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
              <input type="time" value={form.time} onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
              <input type="text" value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500">
                <option value="concert">Concert</option>
                <option value="rehearsal">Rehearsal</option>
                <option value="social">Social / Gathering</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500" />
            </div>
          </div>

          {/* Church targeting */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Globe className="w-4 h-4 inline mr-1" /> Churches
            </label>
            <label className="flex items-center gap-2 text-sm min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={allChurches}
                onChange={(e) => setAllChurches(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-slate-800 focus:ring-slate-500"
              />
              <span className="font-medium">All churches</span>
            </label>
            {!allChurches && (
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 border border-gray-200 rounded-lg px-3 py-1">
                {pickableChurches.map(c => (
                  <label key={c.id} className="flex items-center gap-2 text-sm min-h-[44px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedChurchIds.includes(c.id)}
                      onChange={() => setSelectedChurchIds(prev =>
                        prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                      )}
                      className="w-4 h-4 rounded border-gray-300 text-slate-800 focus:ring-slate-500"
                    />
                    <span className="truncate">{c.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{c.short_name}</span>
                  </label>
                ))}
              </div>
            )}
            {!allChurches && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedChurchIds.length === 0
                  ? 'Select at least one church.'
                  : `Only members of ${selectedChurchIds.length} selected ${selectedChurchIds.length === 1 ? 'church' : 'churches'} will see this event.`}
              </p>
            )}
          </div>

          {/* Song Selector */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Music className="w-4 h-4 inline mr-1" /> Songs for this event ({selectedSongIds.length} selected)
            </label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search songs..."
                value={songSearch}
                onChange={(e) => setSongSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-500"
              />
            </div>
            {selectedSongIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedSongIds.map(id => {
                  const song = allSongs.find(s => s.id === id);
                  return song ? (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-medium">
                      {song.title}
                      <button type="button" onClick={() => setSelectedSongIds(prev => prev.filter(s => s !== id))}
                        className="text-slate-600 hover:text-slate-800 font-bold">×</button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
              {songPickerResults
                .map(song => (
                  <button type="button" key={song.id}
                    onClick={() => {
                      setSelectedSongIds(prev =>
                        prev.includes(song.id) ? prev.filter(id => id !== song.id) : [...prev, song.id]
                      );
                    }}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-0 flex items-center gap-2 hover:bg-gray-50 ${
                      selectedSongIds.includes(song.id) ? 'bg-slate-50' : '' 
                    }`}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                      selectedSongIds.includes(song.id) ? 'bg-slate-500 border-slate-800 text-white' : 'border-gray-300' 
                    }`}>
                      {selectedSongIds.includes(song.id) ? '✓' : '' }
                    </span>
                    <span className="truncate">{song.title}</span>
                    {song.composer && <span className="text-gray-400 text-xs ml-auto">{song.composer}</span>}
                  </button>
                ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:bg-gray-400">
              {saving ? 'Saving...' : editingId ? 'Update Event' : 'Create Event'}
            </button>
            <button type="button" onClick={resetForm}
              className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {upcoming.length > 0 && (
        <div>
          <h2 className="text-base font-bold mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Upcoming ({upcoming.length})
          </h2>
          <div className="space-y-2">
            {upcoming.map((event) => (
              <div key={event.id} className="bg-white rounded-lg p-4 border border-gray-100 flex items-center justify-between cursor-pointer hover:border-slate-200 transition" onClick={() => navigate(`/super-admin/events/${event.id}`)}>
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 rounded-lg p-2 text-center flex-shrink-0 w-12">
                    <div className="text-lg font-bold text-slate-700">
                      {new Date(event.date + 'T00:00:00').getDate()}
                    </div>
                    <div className="text-xs text-slate-600 uppercase">
                      {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1">
                      {event.title}
                      <span className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full" title={targetTitle(event.id)}>{targetLabel(event.id)}</span>
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      {eventRangeLabel(event) && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {eventRangeLabel(event)}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {event.time}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(event); }} className="p-2 hover:bg-gray-100 rounded text-gray-500">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }} className="p-2 hover:bg-red-50 rounded text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-base font-bold mb-2 text-gray-400">Past Events ({past.length})</h2>
          <div className="space-y-2 opacity-60">
            {past.map((event) => (
              <div key={event.id} className="bg-white rounded-lg p-4 border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 rounded-lg p-2 text-center flex-shrink-0 w-12">
                    <div className="text-lg font-bold text-gray-500">
                      {new Date(event.date + 'T00:00:00').getDate()}
                    </div>
                    <div className="text-xs text-gray-400 uppercase">
                      {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-600 text-sm flex items-center gap-1">
                      {event.title}
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full" title={targetTitle(event.id)}>{targetLabel(event.id)}</span>
                    </h3>
                    <p className="text-xs text-gray-400">{formatEventDates(event, d => d)} • {event.location}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(event.id)} className="p-1.5 hover:bg-red-50 rounded text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && !showForm && (
        <div className="bg-white rounded-lg p-8 text-center border border-gray-100">
          <Globe className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No global events yet</p>
          <p className="text-xs text-gray-400 mt-1">Create events for all churches or selected ones</p>
        </div>
      )}
    </div>
  );
};
