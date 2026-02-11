import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Music, X, Eye, Users, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface Song {
  id: string;
  title: string;
  composer: string;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  voice_part: string;
  role: string;
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
  
  // Visibility controls
  const [visibility, setVisibility] = useState<'all' | 'voice_part' | 'role' | 'specific_users'>('all');
  const [allowedVoiceParts, setAllowedVoiceParts] = useState<string[]>([]);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  
  // Setlist
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [searchSong, setSearchSong] = useState('');
  
  // Members for specific user selection
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [searchMember, setSearchMember] = useState('');

  const voiceParts = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Instrumentalist'];
  const roles = ['admin', 'member', 'guest'];

  useEffect(() => {
    fetchSongs();
    fetchMembers();
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

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, voice_part, role')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setAllMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
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
        setVisibility(data.visibility || 'all');
        setAllowedVoiceParts(data.allowed_voice_parts || []);
        setAllowedRoles(data.allowed_roles || []);

        // Load songs from event_songs table
        const { data: eventSongs } = await supabase
          .from('event_songs')
          .select('song_id')
          .eq('event_id', eventId);

        if (eventSongs && eventSongs.length > 0) {
          setSelectedSongIds(eventSongs.map(es => es.song_id));
        } else if (data.setlist && data.setlist.length > 0) {
          setSelectedSongIds(data.setlist);
        }

        // Load specific users if applicable
        if (data.visibility === 'specific_users') {
          const { data: userAccess } = await supabase
            .from('event_user_access')
            .select('member_id')
            .eq('event_id', eventId);
          
          if (userAccess) {
            setSelectedMemberIds(userAccess.map(ua => ua.member_id));
          }
        }
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
        setlist: selectedSongIds,
        visibility,
        allowed_voice_parts: visibility === 'voice_part' ? allowedVoiceParts : null,
        allowed_roles: visibility === 'role' ? allowedRoles : null,
      };

      if (eventId) {
        // UPDATE existing event
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', eventId);
        
        if (error) throw error;

        // Sync event_songs
        await supabase.from('event_songs').delete().eq('event_id', eventId);
        if (selectedSongIds.length > 0) {
          const eventSongs = selectedSongIds.map(songId => ({
            event_id: eventId,
            song_id: songId
          }));
          await supabase.from('event_songs').insert(eventSongs);
        }

        // Sync event_user_access for specific users
        if (visibility === 'specific_users') {
          await supabase.from('event_user_access').delete().eq('event_id', eventId);
          if (selectedMemberIds.length > 0) {
            const userAccess = selectedMemberIds.map(memberId => ({
              event_id: eventId,
              member_id: memberId
            }));
            await supabase.from('event_user_access').insert(userAccess);
          }
        } else {
          // Clear user access if not specific_users
          await supabase.from('event_user_access').delete().eq('event_id', eventId);
        }
        
        toast.success('Event updated');
      } else {
        // CREATE new event
        const { data, error } = await supabase
          .from('events')
          .insert([eventData])
          .select()
          .single();
        
        if (error) throw error;
        
        // Sync event_songs
        if (selectedSongIds.length > 0 && data?.id) {
          const eventSongs = selectedSongIds.map(songId => ({
            event_id: data.id,
            song_id: songId
          }));
          await supabase.from('event_songs').insert(eventSongs);
        }

        // Sync event_user_access for specific users
        if (visibility === 'specific_users' && selectedMemberIds.length > 0 && data?.id) {
          const userAccess = selectedMemberIds.map(memberId => ({
            event_id: data.id,
            member_id: memberId
          }));
          await supabase.from('event_user_access').insert(userAccess);
        }
        
        toast.success('Event created');
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

  const toggleVoicePart = (voicePart: string) => {
    setAllowedVoiceParts(prev =>
      prev.includes(voicePart) 
        ? prev.filter(vp => vp !== voicePart)
        : [...prev, voicePart]
    );
  };

  const toggleRole = (role: string) => {
    setAllowedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const selectedSongs = availableSongs.filter(s => selectedSongIds.includes(s.id));
  const filteredAvailableSongs = availableSongs.filter(s => 
    !selectedSongIds.includes(s.id) &&
    searchSong &&
    ((s.title && s.title.toLowerCase().includes(searchSong.toLowerCase())) ||
     (s.composer && s.composer.toLowerCase().includes(searchSong.toLowerCase())))
  );

  const filteredMembers = allMembers.filter(m =>
    searchMember &&
    (`${m.first_name} ${m.last_name}`.toLowerCase().includes(searchMember.toLowerCase()) ||
     m.email.toLowerCase().includes(searchMember.toLowerCase()))
  );

  const selectedMembers = allMembers.filter(m => selectedMemberIds.includes(m.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/events')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Events
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {eventId ? 'Edit Event' : 'Create Event'}
        </h1>
        <div className="w-32" />
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
              placeholder="e.g. Church Main Hall"
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
            <option value="">Select Type</option>
            <option value="Service">Service</option>
            <option value="Practice">Practice</option>
            <option value="Performance">Performance</option>
            <option value="Meeting">Meeting</option>
            <option value="Social">Social Event</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Add event details..."
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Visibility Controls */}
        <div className="border-t pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-indigo-600" />
            <label className="text-sm font-medium text-gray-700">Who can see this event?</label>
          </div>

          <div className="space-y-3 mb-4">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                value="all"
                checked={visibility === 'all'}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-4 h-4 text-indigo-600"
              />
              <div>
                <div className="font-medium">All Members</div>
                <div className="text-sm text-gray-600">Everyone can see this event</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                value="voice_part"
                checked={visibility === 'voice_part'}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-4 h-4 text-indigo-600"
              />
              <div>
                <div className="font-medium">By Voice Part</div>
                <div className="text-sm text-gray-600">Only specific voice parts</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                value="role"
                checked={visibility === 'role'}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-4 h-4 text-indigo-600"
              />
              <div>
                <div className="font-medium">By Role</div>
                <div className="text-sm text-gray-600">Only specific roles (Admin, Member, Guest)</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                value="specific_users"
                checked={visibility === 'specific_users'}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-4 h-4 text-indigo-600"
              />
              <div>
                <div className="font-medium">Specific Users</div>
                <div className="text-sm text-gray-600">Hand-pick individuals</div>
              </div>
            </label>
          </div>

          {/* Voice Part Selection */}
          {visibility === 'voice_part' && (
            <div className="p-4 bg-indigo-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-3">Select Voice Parts:</p>
              <div className="flex flex-wrap gap-2">
                {voiceParts.map(vp => (
                  <label key={vp} className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={allowedVoiceParts.includes(vp)}
                      onChange={() => toggleVoicePart(vp)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm">{vp}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Role Selection */}
          {visibility === 'role' && (
            <div className="p-4 bg-indigo-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-3">Select Roles:</p>
              <div className="flex flex-wrap gap-2">
                {roles.map(role => (
                  <label key={role} className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={allowedRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm capitalize">{role}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Specific Users Selection */}
          {visibility === 'specific_users' && (
            <div className="p-4 bg-indigo-50 rounded-lg space-y-3">
              <p className="text-sm font-medium text-gray-700">Select Members ({selectedMembers.length} selected):</p>
              
              {selectedMembers.length > 0 && (
                <div className="space-y-2 mb-3">
                  {selectedMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{member.first_name} {member.last_name}</div>
                        <div className="text-xs text-gray-600">{member.email} • {member.voice_part}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleMember(member.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                placeholder="Search members to add..."
                className="w-full px-4 py-2 border rounded-lg"
              />
              
              {searchMember && (
                <div className="max-h-48 overflow-y-auto border rounded-lg bg-white">
                  {filteredMembers.map(member => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleMember(member.id)}
                      disabled={selectedMemberIds.includes(member.id)}
                      className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-medium text-sm">{member.first_name} {member.last_name}</div>
                      <div className="text-xs text-gray-600">{member.email} • {member.voice_part} • {member.role}</div>
                    </button>
                  ))}
                  {filteredMembers.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">No members found</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Setlist Section */}
        <div className="border-t pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Music className="w-5 h-5 text-indigo-600" />
            <label className="text-sm font-medium text-gray-700">Setlist ({selectedSongs.length} songs)</label>
          </div>

          {selectedSongs.length > 0 && (
            <div className="space-y-2 mb-4">
              {selectedSongs.map((song, index) => (
                <div key={song.id} className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-indigo-600">#{index + 1}</span>
                    <div>
                      <div className="font-medium">{song.title}</div>
                      <div className="text-sm text-gray-600">{song.composer}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSong(song.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <input
              type="text"
              value={searchSong}
              onChange={(e) => setSearchSong(e.target.value)}
              placeholder="Search songs to add..."
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            {searchSong && (
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                {filteredAvailableSongs.map((song) => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => addSong(song.id)}
                    className="w-full text-left p-3 hover:bg-gray-50 transition-colors border-b last:border-b-0"
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

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="requiresRsvp"
            checked={requiresRsvp}
            onChange={(e) => setRequiresRsvp(e.target.checked)}
            className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
          />
          <label htmlFor="requiresRsvp" className="text-sm font-medium text-gray-700">
            Require RSVP for this event
          </label>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/events')}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
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
