#!/bin/bash

echo "=== Phase 3.5: Events by Church ==="

# =============================================
# 3.5.1 Global Events Page for Super Admin
# =============================================

cat > src/pages/super-admin/GlobalEvents.tsx << 'GEOF'
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDbClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Plus, Clock, MapPin, Trash2, Edit, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

interface GlobalEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
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

  useEffect(() => {
    fetchEvents();
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
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load global events');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.time || !form.location) {
      toast.error('Please fill in all required fields');
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
            is_global: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Event updated!');
      } else {
        const { error } = await supabase
          .from('events')
          .insert([{
            ...form,
            is_global: true,
            church_id: user?.church_id,
            requires_rsvp: true,
          }]);
        if (error) throw error;
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

  const handleEdit = (event: GlobalEvent) => {
    setForm({
      title: event.title,
      description: event.description || '',
      date: event.date,
      time: event.time,
      location: event.location,
      type: event.type || 'concert',
    });
    setEditingId(event.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this global event? All churches will no longer see it.')) return;
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
    setForm({ title: '', description: '', date: '', time: '', location: '', type: 'concert' });
    setEditingId(null);
    setShowForm(false);
  };

  const isPast = (date: string) => new Date(date + 'T23:59:59') < new Date();
  const upcoming = events.filter(e => !isPast(e.date));
  const past = events.filter(e => isPast(e.date));

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2 rounded-lg">
            <Globe className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Global Events</h1>
            <p className="text-xs text-gray-600">Visible to all churches</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
              <input type="time" value={form.time} onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
              <input type="text" value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500">
                <option value="concert">Concert</option>
                <option value="rehearsal">Rehearsal</option>
                <option value="social">Social / Gathering</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-6 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:bg-gray-400">
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
              <div key={event.id} className="bg-white rounded-lg p-4 border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 rounded-lg p-2 text-center flex-shrink-0 w-12">
                    <div className="text-lg font-bold text-amber-700">
                      {new Date(event.date + 'T00:00:00').getDate()}
                    </div>
                    <div className="text-xs text-amber-600 uppercase">
                      {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1">
                      {event.title}
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Global</span>
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {event.time}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(event)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(event.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500">
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
                    <h3 className="font-semibold text-gray-600 text-sm">{event.title}</h3>
                    <p className="text-xs text-gray-400">{event.date} • {event.location}</p>
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
          <p className="text-xs text-gray-400 mt-1">Create events that all churches can see</p>
        </div>
      )}
    </div>
  );
};
GEOF

echo "  [1/2] Created GlobalEvents page"

# =============================================
# 3.5.2 Update ChurchDetail to show church events
# =============================================

# We'll append the events section to the ChurchDetail page
# First, let me create a replacement that adds events

cat > /tmp/church_events_section.txt << 'CESEOF'

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Church Events
          </h2>
        </div>
        {churchEvents.length > 0 ? (
          <div className="space-y-2">
            {churchEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                <div className="bg-green-100 rounded-lg p-2 text-center flex-shrink-0 w-11">
                  <div className="text-base font-bold text-green-700">
                    {new Date(event.date + 'T00:00:00').getDate()}
                  </div>
                  <div className="text-[10px] text-green-600 uppercase">
                    {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-xs text-gray-500">{event.time} • {event.location}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No events for this church yet</p>
        )}
      </div>
CESEOF

echo "  [2/2] Events section prepared"

echo ""
echo "=== MANUAL STEPS ==="
echo ""
echo "1. Add import to App.tsx:"
echo '   import { GlobalEvents } from "./pages/super-admin/GlobalEvents";'
echo ""
echo "2. Add route inside the super-admin routes in App.tsx:"
echo '   <Route path="events" element={<GlobalEvents />} />'
echo "   (Replace the existing events route if there is one for super-admin)"
echo ""
echo "3. In src/pages/super-admin/ChurchDetail.tsx, add 'churchEvents' state and fetch."
echo "   I'll handle this with sed commands next."
