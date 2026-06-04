import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDbClient, supabase } from '../../lib/supabase';
import { Church, Users, Music, Calendar, ArrowLeft, Edit, Shield, ShieldOff, Trash2, Clock, MapPin, Plus, UserPlus, X, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { generateMemorablePassword } from '../../lib/passwordUtils';

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
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [createdAdminEmail, setCreatedAdminEmail] = useState<string>('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [memberMenuId, setMemberMenuId] = useState<string | null>(null);
  const [memberMenuPos, setMemberMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [headerMenuPos, setHeaderMenuPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    const close = () => {
      setMemberMenuId(null);
      setMemberMenuPos(null);
      setShowHeaderMenu(false);
      setHeaderMenuPos(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

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

  const deleteAdmin = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Remove ${memberEmail} from this church? This will delete their member record.`)) return;
    try {
      const db = getDbClient();
      const { error } = await db
        .from('members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
      toast.success(`${memberEmail} removed`);
      fetchAll();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to remove member');
    }
  };

  const resetPassword = async (memberEmail: string) => {
    if (!confirm(`Reset password for ${memberEmail}?`)) return;
    try {
      const password = generateMemorablePassword();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      // Find auth user by email to get their auth id
      const db = getDbClient();
      const { data: userData } = await db
        .from('users')
        .select('id')
        .eq('email', memberEmail)
        .maybeSingle();

      if (!userData) {
        toast.error('User not found in database');
        return;
      }

      // Use Edge Function to reset password
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userData.id,
            new_password: password,
          }),
        }
      );

      if (!response.ok) {
        // Fallback: try admin API directly won't work from client
        // Show the password and let super admin update manually
        toast.error('Password reset requires edge function. Deploying...');
        return;
      }

      setCreatedAdminEmail(memberEmail);
      setGeneratedPassword(password);
      setShowPasswordModal(true);
      toast.success('Password reset!');
    } catch (error: any) {
      console.error('Reset error:', error);
      toast.error(error.message || 'Failed to reset password');
    }
  };

  const assignAdmin = async () => {
    if (!adminEmail.trim()) { toast.error('Email is required'); return; }
    setAddingAdmin(true);
    try {
      const db = getDbClient();
      const email = adminEmail.trim().toLowerCase();

      // Check if user already exists
      const { data: existingUser } = await db
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        // User exists — add/promote as admin for this church
        const { data: existingMember } = await db
          .from('members')
          .select('id, role')
          .eq('email', email)
          .eq('church_id', id)
          .maybeSingle();

        if (existingMember) {
          await db.from('members').update({ role: 'admin' }).eq('id', existingMember.id);
          toast.success(`${email} promoted to admin`);
        } else {
          await db.from('members').insert({
            church_id: id,
            email: email,
            first_name: email.split('@')[0],
            last_name: '',
            member_id: email.split('@')[0].charAt(0).toUpperCase() + 'Admin',
            role: 'admin',
            voice_part: 'Soprano',
            status: 'active'
          });
          toast.success(`${email} added as admin`);
        }
        setShowAddAdmin(false);
        setAdminEmail('');
        setAdminName('');
        fetchAll();
      } else {
        // Create new user via Edge Function
        const password = generateMemorablePassword();

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-member`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              password,
              name: adminName.trim() || email.split('@')[0],
              role: 'admin',
              voice_part: 'Soprano',
              status: 'active',
              church_id: id,
            }),
          }
        );

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to create admin');
        }

        const result = await response.json();
        if (result.data?.id) {
          const nameForId = adminName.trim() || email.split('@')[0];
          const memberId = nameForId.split(' ').map((w: string) => w.charAt(0).toUpperCase()).join('') + Math.floor(Math.random() * 1000);
          await db.from('members').insert({
            church_id: id,
            email: email,
            first_name: adminName.trim() ? adminName.trim().split(' ')[0] : email.split('@')[0],
            last_name: adminName.trim() ? adminName.trim().split(' ').slice(1).join(' ') : '',
            member_id: memberId,
            role: 'admin',
            voice_part: 'Soprano',
            status: 'active',
          });
        }

        setCreatedAdminEmail(adminEmail.trim().toLowerCase());
        setGeneratedPassword(password);
        setShowAddAdmin(false);
        setShowPasswordModal(true);
        setAdminEmail('');
        setAdminName('');
        fetchAll();
      }
    } catch (error: any) {
      console.error('Admin assign error:', error);
      toast.error(error.message || 'Failed to assign admin');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleResetAttendance = async () => {
    if (!church?.id) return;
    setResetting(true);
    try {
      const supabase = getDbClient();
      const { error } = await supabase
        .from('attendance_history')
        .delete()
        .eq('church_id', church.id);
      if (error) throw error;
      toast.success(`Attendance reset for ${church.name}`);
      setShowResetModal(false);
    } catch (error: any) {
      console.error('Reset failed:', error);
      toast.error(error?.message || 'Reset failed');
    } finally {
      setResetting(false);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  if (!church) return <p>Church not found</p>;

  const isPast = (date: string) => new Date(date + 'T23:59:59') < new Date();
  const upcomingEvents = churchEvents.filter(e => !isPast(e.date));
  const pastEvents = churchEvents.filter(e => isPast(e.date));

  return (
    <div className="space-y-6 pb-8">
      <button onClick={() => navigate('/super-admin/churches')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm min-h-[44px]">
        <ArrowLeft className="w-4 h-4" /> Back to Churches
      </button>

      {/* Church Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          {/* Logo */}
          <div
            className="w-11 h-11 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-white font-bold text-sm md:text-lg flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${church.primary_color}, ${church.secondary_color})` }}
          >
            {church.short_name.substring(0, 2)}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-xl font-semibold text-gray-900 truncate leading-tight">
              {church.name}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 truncate hidden sm:block">
              {church.city}{church.country ? `, ${church.country}` : ''}
              {church.pastor_name ? ` · Pastor: ${church.pastor_name}` : ''}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 truncate sm:hidden">
              {church.city}
            </p>
          </div>

          {/* Actions: full buttons on md+, single 3-dot on mobile */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate(`/super-admin/churches/${id}/edit`)}
              className="hidden md:flex items-center gap-1.5 min-h-[44px] px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Edit className="w-4 h-4" /> Edit
            </button>
            <button
              onClick={handleDelete}
              className="hidden md:flex items-center gap-1.5 min-h-[44px] px-4 border border-red-200 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setHeaderMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                setShowHeaderMenu(true);
              }}
              className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600"
              aria-label="Church actions"
            >
              <svg width="4" height="16" viewBox="0 0 4 16" fill="currentColor">
                <circle cx="2" cy="2" r="1.5" />
                <circle cx="2" cy="8" r="1.5" />
                <circle cx="2" cy="14" r="1.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Clickable Stat Cards */}
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <button
            onClick={() => document.getElementById('church-members')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-blue-50 rounded-lg p-3 md:p-5 text-center hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-xl md:text-3xl font-bold">{stats.members}</p>
            <p className="text-xs text-gray-600">Members</p>
          </button>
          <button
            onClick={() => document.getElementById('church-events')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-green-50 rounded-lg p-3 md:p-5 text-center hover:bg-green-100 transition-colors cursor-pointer"
          >
            <Calendar className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <p className="text-xl md:text-3xl font-bold">{stats.events}</p>
            <p className="text-xs text-gray-600">Events</p>
          </button>
          <button
            onClick={() => document.getElementById('church-songs')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-purple-50 rounded-lg p-3 md:p-5 text-center hover:bg-purple-100 transition-colors cursor-pointer"
          >
            <Music className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-xl md:text-3xl font-bold">{stats.songsLearned}</p>
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
                    <div className="text-xs text-green-600 uppercase">
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
                    <span className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full">Global</span>
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
                    <div className="text-xs text-gray-400 uppercase">
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Users className="w-5 h-5" /> Members ({members.length})
          </h2>
          <button
            onClick={() => setShowAddAdmin(true)}
            className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 min-h-[44px]"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add Admin
          </button>
        </div>
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-2 p-3 rounded-lg hover:bg-gray-50 min-h-[60px]">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">
                  {member.first_name} {member.last_name}
                  {member.is_super_admin && (
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-800">
                      <Shield className="w-3 h-3" /> Super Admin
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 truncate">{member.email} • {member.voice_part || 'No part'} • {member.role}</p>
              </div>

              {/* MOBILE: 3-dot menu */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setMemberMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                  setMemberMenuId(memberMenuId === member.id ? null : member.id);
                }}
                className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 flex-shrink-0"
                aria-label="Member actions"
              >
                <svg width="4" height="16" viewBox="0 0 4 16" fill="currentColor">
                  <circle cx="2" cy="2" r="1.5" />
                  <circle cx="2" cy="8" r="1.5" />
                  <circle cx="2" cy="14" r="1.5" />
                </svg>
              </button>

              {/* DESKTOP (md+): inline buttons */}
              <div className="hidden md:flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => toggleSuperAdmin(member.id, member.is_super_admin || false)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium min-h-[44px] ${
                    member.is_super_admin
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  title={member.is_super_admin ? 'Remove super admin' : 'Make super admin'}
                >
                  {member.is_super_admin ? <ShieldOff className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                  {member.is_super_admin ? 'Remove SA' : 'Make SA'}
                </button>
                <button
                  onClick={() => resetPassword(member.email)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-blue-600 hover:bg-blue-50 min-h-[44px]"
                  title="Reset password"
                >
                  <KeyRound className="w-3 h-3" /> Reset PW
                </button>
                <button
                  onClick={() => deleteAdmin(member.id, member.email)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-red-600 hover:bg-red-50 min-h-[44px]"
                  title="Remove from church"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-6 border border-red-200 rounded-2xl overflow-hidden">
        <div className="bg-red-50 px-6 py-4 border-b border-red-200">
          <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
          <p className="text-xs text-red-500 mt-0.5">These actions are irreversible.</p>
        </div>
        <div className="bg-white px-6 py-4 flex items-center justify-between gap-6">
          <div>
            <div className="text-sm font-medium text-gray-900">Reset attendance data</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Permanently delete all attendance records for {church?.name}
            </div>
          </div>
          <button
            onClick={() => setShowResetModal(true)}
            className="text-sm font-medium text-red-600 border border-red-300 bg-white hover:bg-red-50 px-4 py-2 rounded-xl min-h-[44px] whitespace-nowrap flex-shrink-0"
          >
            Reset attendance
          </button>
        </div>
      </div>

      {/* Add Admin Modal */}
      {showAddAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-slate-600" /> Add Admin
              </h3>
              <button onClick={() => { setShowAddAdmin(false); setAdminEmail(''); setAdminName(''); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500"
                  required
                />
              </div>
              <p className="text-xs text-gray-400">If the email already has an account, they will be promoted to admin. Otherwise a new account will be created with a generated password.</p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setShowAddAdmin(false); setAdminEmail(''); setAdminName(''); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={assignAdmin}
                  disabled={addingAdmin || !adminEmail.trim()}
                  className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
                >
                  {addingAdmin ? 'Adding...' : 'Add Admin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && generatedPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Admin Account Created</h3>
              <p className="text-sm text-gray-500 mt-1">Share these credentials with the admin</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
              <div>
                <p className="text-xs text-gray-500 font-medium">Email</p>
                <p className="text-sm font-mono font-semibold text-gray-900">{createdAdminEmail}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-semibold text-gray-900 bg-slate-50 px-2 py-1 rounded border border-slate-200">{generatedPassword}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(generatedPassword); toast.success('Password copied!'); }}
                    className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded font-medium hover:bg-slate-200"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-red-500 mb-4">⚠️ This password will not be shown again. Please save it now.</p>
            <button
              onClick={() => { setShowPasswordModal(false); setGeneratedPassword(null); }}
              className="w-full py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Mobile header action menu (Edit / Delete church) */}
      {showHeaderMenu && headerMenuPos && (
        <div
          className="fixed bg-white border border-gray-100 rounded-2xl shadow-xl py-1 z-[9999]"
          style={{ top: headerMenuPos.top, right: headerMenuPos.right, minWidth: '180px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setShowHeaderMenu(false);
              setHeaderMenuPos(null);
              navigate(`/super-admin/churches/${id}/edit`);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 min-h-[44px] text-left"
          >
            <Edit className="w-4 h-4" /> Edit church
          </button>
          <button
            onClick={() => {
              setShowHeaderMenu(false);
              setHeaderMenuPos(null);
              handleDelete();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 min-h-[44px] text-left border-t border-gray-100"
          >
            <Trash2 className="w-4 h-4" /> Delete church
          </button>
        </div>
      )}

      {/* Mobile member action menu — fixed-positioned to escape any clipping */}
      {memberMenuId && memberMenuPos && (() => {
        const currentMember = members.find(m => m.id === memberMenuId);
        if (!currentMember) return null;
        return (
          <div
            className="fixed bg-white border border-gray-100 rounded-2xl shadow-xl py-1 z-[9999]"
            style={{ top: memberMenuPos.top, right: memberMenuPos.right, minWidth: '200px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                toggleSuperAdmin(currentMember.id, currentMember.is_super_admin || false);
                setMemberMenuId(null);
                setMemberMenuPos(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 min-h-[44px] text-left"
            >
              {currentMember.is_super_admin ? 'Remove Super Admin' : 'Make Super Admin'}
            </button>
            <button
              onClick={() => {
                resetPassword(currentMember.email);
                setMemberMenuId(null);
                setMemberMenuPos(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 min-h-[44px] text-left border-t border-gray-100"
            >
              Reset Password
            </button>
            <button
              onClick={() => {
                deleteAdmin(currentMember.id, currentMember.email);
                setMemberMenuId(null);
                setMemberMenuPos(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 min-h-[44px] text-left border-t border-gray-100"
            >
              Remove
            </button>
          </div>
        );
      })()}

      {/* Reset Attendance Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-lg font-semibold text-gray-900 mb-2">Reset attendance data?</div>
            <div className="text-sm text-gray-500 mb-6 leading-relaxed">
              This will permanently delete all attendance records for{' '}
              <span className="font-semibold text-gray-900">{church?.name}</span>.{' '}
              This cannot be undone.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAttendance}
                disabled={resetting}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 min-h-[44px]"
              >
                {resetting ? 'Resetting...' : 'Yes, reset all'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
