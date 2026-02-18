import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDbClient } from '../../lib/supabase';
import { Church, Users, Music, Calendar, ArrowLeft, Edit, Shield, ShieldOff, Trash2, Clock, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

interface ChurchData {
  id: string;
  name: string;
  short_name: string;
  primary_color: string;
  secondary_color: string;
  city: string | null;
  country: string | null;
  pastor_name: string | null;
  contact_email: string | null;
}

interface MemberData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  voice_part: string;
  is_super_admin?: boolean;
}

interface EventData {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  type: string;
  is_global: boolean;
}

export const ChurchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [church, setChurch] = useState<ChurchData | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [churchEvents, setChurchEvents] = useState<EventData[]>([]);
  const [stats, setStats] = useState({ members: 0, events: 0, songsLearned: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  const fetchAll = async () => {
    try {
      const supabase = getDbClient();

      const [churchRes, membersRes, eventsRes, songStatusRes, churchEventsRes] = await Promise.all([
        supabase.from('churches').select('*').eq('id', id).single(),
        supabase.from('members').select('id, first_name, last_name, email, role, voice_part').eq('church_id', id).order('first_name'),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('church_id', id),
        supabase.from('church_song_status').select('status').eq('church_id', id),
        supabase.from('events').select('*').eq('church_id', id).order('date', { ascending: true }),
      ]);

      if (churchRes.error) throw churchRes.error;
      setChurch(churchRes.data);
      setMembers(membersRes.data || []);
      setChurchEvents(churchEventsRes.data || []);

      const learned = (songStatusRes.data || []).filter(s => s.status === 'learned').length;
      setStats({
        members: membersRes.data?.length || 0,
        events: eventsRes.count || 0,
        songsLearned: learned,
      });

      if (membersRes.data) {
        const userIds = membersRes.data.map(m => m.id);
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, is_super_admin')
            .in('id', userIds);

          if (usersData) {
            const superAdminMap = new Map(usersData.map(u => [u.id, u.is_super_admin]));
            setMembers(membersRes.data.map(m => ({ ...m, is_super_admin: superAdminMap.get(m.id) || false })));
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load church');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to deactivate this church? This will hide it from the app.")) return;
    try {
      const supabase = getDbClient();
      const { error } = await supabase.from("churches").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      toast.success("Church deactivated");
      navigate("/super-admin/churches");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to deactivate church");
    }
  };

  const toggleSuperAdmin = async (memberId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'remove super admin from' : 'make super admin';
    if (!confirm(`Are you sure you want to ${action} this member?`)) return;

    try {
      const supabase = getDbClient();
      const { error } = await supabase
        .from('users')
        .update({ is_super_admin: !currentStatus })
        .eq('id', memberId);

      if (error) throw error;
      toast.success(currentStatus ? 'Super admin removed' : 'Super admin granted');
      fetchAll();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!church) return <p>Church not found</p>;

  const isPast = (date: string) => new Date(date + 'T23:59:59') < new Date();
  const upcomingEvents = churchEvents.filter(e => !isPast(e.date));
  const pastEvents = churchEvents.filter(e => isPast(e.date));

  return (
    <div className="space-y-6 pb-8">
      <button onClick={() => navigate('/super-admin/churches')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Churches
      </button>

      {/* Church Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ background: `linear-gradient(135deg, ${church.primary_color}, ${church.secondary_color})` }}>
              {church.short_name.substring(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{church.name}</h1>
              <p className="text-sm text-gray-500">
                {church.city}{church.country ? `, ${church.country}` : ''}
                {church.pastor_name ? ` • Pastor: ${church.pastor_name}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/super-admin/churches/${id}/edit`)}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              <Edit className="w-4 h-4" /> Edit
            </button>
            <button onClick={handleDelete}
              className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>

        {/* Clickable Stat Cards */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => document.getElementById('church-members')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-blue-50 rounded-lg p-3 text-center hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.members}</p>
            <p className="text-xs text-gray-600">Members</p>
          </button>
          <button
            onClick={() => document.getElementById('church-events')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-green-50 rounded-lg p-3 text-center hover:bg-green-100 transition-colors cursor-pointer"
          >
            <Calendar className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.events}</p>
            <p className="text-xs text-gray-600">Events</p>
          </button>
          <button
            onClick={() => document.getElementById('church-songs')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-purple-50 rounded-lg p-3 text-center hover:bg-purple-100 transition-colors cursor-pointer"
          >
            <Music className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.songsLearned}</p>
            <p className="text-xs text-gray-600">Songs Learned</p>
          </button>
        </div>
      </div>

      {/* Church Events */}
      <div id="church-events" className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" /> Church Events
        </h2>

        {upcomingEvents.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Upcoming</h3>
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
                  <div className="bg-green-100 rounded-lg p-2 text-center flex-shrink-0 w-11">
                    <div className="text-base font-bold text-green-700">
                      {new Date(event.date + 'T00:00:00').getDate()}
                    </div>
                    <div className="text-[10px] text-green-600 uppercase">
                      {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {event.time}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>
                    </p>
                  </div>
                  {event.is_global && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Global</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {pastEvents.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Past</h3>
            <div className="space-y-2 opacity-60">
              {pastEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg">
                  <div className="bg-gray-100 rounded-lg p-1.5 text-center flex-shrink-0 w-10">
                    <div className="text-sm font-bold text-gray-500">
                      {new Date(event.date + 'T00:00:00').getDate()}
                    </div>
                    <div className="text-[9px] text-gray-400 uppercase">
                      {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-600">{event.title}</p>
                    <p className="text-xs text-gray-400">{event.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {churchEvents.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No events for this church yet</p>
        )}
      </div>

      {/* Song Progress */}
      <div id="church-songs" className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Music className="w-5 h-5" /> Song Progress
        </h2>
        <p className="text-sm text-gray-500 text-center py-4">
          Song status tracking will be available here — {stats.songsLearned} songs learned so far.
        </p>
      </div>

      {/* Members */}
      <div id="church-members" className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" /> Members ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
              <div>
                <p className="font-medium text-sm">
                  {member.first_name} {member.last_name}
                  {member.is_super_admin && (
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">
                      <Shield className="w-3 h-3" /> Super Admin
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">{member.email} • {member.voice_part || 'No part'} • {member.role}</p>
              </div>
              <button
                onClick={() => toggleSuperAdmin(member.id, member.is_super_admin || false)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                  member.is_super_admin
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-amber-600 hover:bg-amber-50'
                }`}
                title={member.is_super_admin ? 'Remove super admin' : 'Make super admin'}
              >
                {member.is_super_admin ? <ShieldOff className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                {member.is_super_admin ? 'Remove SA' : 'Make SA'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
