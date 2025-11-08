import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Calendar, Clock, MapPin, Edit, Users, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  requires_rsvp: boolean;
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

export const AdminEventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEventAndRsvps();
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center p-12">
        <p className="text-gray-600">Event not found</p>
      </div>
    );
  }

  const yesCount = rsvps.filter(r => r.status === 'yes').length;
  const noCount = rsvps.filter(r => r.status === 'no').length;
  const maybeCount = rsvps.filter(r => r.status === 'maybe').length;

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

      {/* RSVP Section */}
      {event.requires_rsvp && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            RSVPs ({rsvps.length})
          </h2>

          {/* RSVP Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-900">Attending</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{yesCount}</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-5 h-5 text-yellow-600" />
                <span className="font-semibold text-yellow-900">Maybe</span>
              </div>
              <p className="text-3xl font-bold text-yellow-600">{maybeCount}</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-red-900">Not Attending</span>
              </div>
              <p className="text-3xl font-bold text-red-600">{noCount}</p>
            </div>
          </div>

          {/* RSVP List */}
          {rsvps.length === 0 ? (
            <p className="text-center text-gray-600 py-8">No RSVPs yet</p>
          ) : (
            <div className="space-y-2">
              <h3 className="font-semibold mb-3">Member Responses</h3>
              {['yes', 'maybe', 'no'].map(status => {
                const statusRsvps = rsvps.filter(r => r.status === status);
                if (statusRsvps.length === 0) return null;

                const statusConfig = {
                  yes: { label: 'Attending', icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200' },
                  maybe: { label: 'Maybe', icon: HelpCircle, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
                  no: { label: 'Not Attending', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200' }
                };

                const config = statusConfig[status as keyof typeof statusConfig];
                const Icon = config.icon;

                return (
                  <div key={status} className="mb-4">
                    <div className="flex items-center gap-2 mb-2 font-medium">
                      <Icon className={`w-4 h-4 ${config.color.split(' ')[0]}`} />
                      {config.label} ({statusRsvps.length})
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {statusRsvps.map((rsvp: any) => (
                        <div
                          key={rsvp.id}
                          className={`${config.color} border rounded-lg p-3`}
                        >
                          <p className="font-semibold">
                            {rsvp.members.first_name} {rsvp.members.last_name}
                          </p>
                          <p className="text-sm opacity-75">{rsvp.members.voice_part}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
