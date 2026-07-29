import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, Music, X, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createSearcher, MEMBER_KEYS, SONG_KEYS } from '../../lib/smartSearch';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useChurch } from '../../contexts/ChurchContext';
import { getChurchToday } from '../../lib/dateUtils';

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
  const { user } = useAuth();
  const { church } = useChurch();
  const { id: eventId } = useParams();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [requiresRsvp, setRequiresRsvp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [originalDate, setOriginalDate] = useState('');
  
  // Collapsible sections
  const [showVisibility, setShowVisibility] = useState(false);
  const [showSetlist, setShowSetlist] = useState(false);
  
  // Visibility controls
  const [visibility, setVisibility] = useState<'all' | 'voice_part' | 'role' | 'specific_users'>('all');
  const [allowedVoiceParts, setAllowedVoiceParts] = useState<string[]>([]);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  
  // Setlist
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [searchSong, setSearchSong] = useState('');
  
  // Members
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
        .eq('church_id', church?.id)
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
        setOriginalDate(data.date);
        setTime(data.time);
        setLocation(data.location);
        setDescription(data.description || '');
        setType(data.type || '');
        setRequiresRsvp(data.requires_rsvp);
        setVisibility(data.visibility || 'all');
        setAllowedVoiceParts(data.allowed_voice_parts || []);
        setAllowedRoles(data.allowed_roles || []);

        const { data: eventSongs } = await supabase
          .from('event_songs')
          .select('song_id')
          .eq('event_id', eventId);

        if (eventSongs && eventSongs.length > 0) {
          setSelectedSongIds(eventSongs.map(es => es.song_id));
        } else if (data.setlist && data.setlist.length > 0) {
          setSelectedSongIds(data.setlist);
        }

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
        // If date changed and old date is in the past, snapshot RSVPs to attendance_history
        const today = getChurchToday(church?.timezone);
        if (originalDate && date !== originalDate && originalDate < today) {
          const { data: currentRsvps } = await supabase
            .from('event_rsvps')
            .select('member_id, status')
            .eq('event_id', eventId);

          if (currentRsvps && currentRsvps.length > 0) {
            const archiveData = currentRsvps.map(r => ({
              event_id: eventId,
              member_id: r.member_id,
              event_title: title,
              event_date: originalDate,
              status: r.status || 'yes',
              church_id: user?.church_id,
            }));
            await supabase.from('attendance_history').upsert(archiveData, { onConflict: 'event_id,member_id', ignoreDuplicates: true });
          }
        }
        
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', eventId);
        
        if (error) throw error;

        await supabase.from('event_songs').delete().eq('event_id', eventId);
        if (selectedSongIds.length > 0) {
          const eventSongs = selectedSongIds.map(songId => ({
            event_id: eventId,
            song_id: songId
          }));
          await supabase.from('event_songs').insert(eventSongs);
        }

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
          await supabase.from('event_user_access').delete().eq('event_id', eventId);
        }
        
        toast.success('Event updated');
      } else {
        const { data, error } = await supabase
          .from('events')
          .insert([{ ...eventData, church_id: church?.id }])
          .select()
          .single();
        
        if (error) throw error;
        
        if (selectedSongIds.length > 0 && data?.id) {
          const eventSongs = selectedSongIds.map(songId => ({
            event_id: data.id,
            song_id: songId
          }));
          await supabase.from('event_songs').insert(eventSongs);
        }

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

  // Both pickers stay empty until you type (they are add-pickers, not lists),
  // then rank fuzzily — accent- and typo-tolerant, best match first.
  const unselectedSongs = availableSongs.filter(s => !selectedSongIds.includes(s.id));
  const songSearcher = useMemo(() => createSearcher(unselectedSongs, SONG_KEYS), [unselectedSongs]);
  const filteredAvailableSongs = searchSong.trim() ? songSearcher(searchSong) : [];

  const memberSearcher = useMemo(() => createSearcher(allMembers, MEMBER_KEYS), [allMembers]);
  const filteredMembers = searchMember.trim() ? memberSearcher(searchMember) : [];

  const selectedMembers = allMembers.filter(m => selectedMemberIds.includes(m.id));

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-6">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/events')}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {eventId ? 'Edit Event' : 'New Event'}
        </h1>
        <div className="w-16" />
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
        {/* Basic Info - Compact */}
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Event Title *"
            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full pl-8 pr-2 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="relative">
              <Clock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full pl-8 pr-2 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-2 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Type</option>
              <option value="Service">Service</option>
              <option value="Practice">Practice</option>
              <option value="Performance">Performance</option>
              <option value="Meeting">Meeting</option>
              <option value="Social">Social</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {eventId && originalDate && date !== originalDate && originalDate < getChurchToday(church?.timezone) && (
            <div className="flex items-start gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <span className="mt-0.5">&#9888;&#65039;</span>
              <span>Changing the date will archive current RSVPs as attendance for <strong>{originalDate}</strong> before updating.</span>
            </div>
          )}

          <div className="relative">
            <MapPin className="absolute left-2.5 top-2.5 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              placeholder="Location *"
              className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* RSVP Checkbox */}
        <label className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
          <input
            type="checkbox"
            checked={requiresRsvp}
            onChange={(e) => setRequiresRsvp(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded"
          />
          <span className="text-sm font-medium text-gray-700">Require RSVP</span>
        </label>

        {/* Collapsible Visibility */}
        <div className="border rounded-lg">
          <button
            type="button"
            onClick={() => setShowVisibility(!showVisibility)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-medium">Visibility</span>
              <span className="text-xs text-gray-500">
                {visibility === 'all' ? 'All Members' :
                 visibility === 'voice_part' ? `${allowedVoiceParts.length} Voice Parts` :
                 visibility === 'role' ? `${allowedRoles.length} Roles` :
                 `${selectedMemberIds.length} Users`}
              </span>
            </div>
            {showVisibility ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showVisibility && (
            <div className="p-3 border-t space-y-2">
              <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="all"
                  checked={visibility === 'all'}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-3.5 h-3.5"
                />
                <span className="text-sm">All Members</span>
              </label>

              <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="voice_part"
                  checked={visibility === 'voice_part'}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-3.5 h-3.5"
                />
                <span className="text-sm">By Voice Part</span>
              </label>

              {visibility === 'voice_part' && (
                <div className="ml-6 flex flex-wrap gap-1.5">
                  {voiceParts.map(vp => (
                    <label key={vp} className="flex items-center gap-1.5 px-2 py-1 bg-white border rounded text-xs cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={allowedVoiceParts.includes(vp)}
                        onChange={() => toggleVoicePart(vp)}
                        className="w-3 h-3"
                      />
                      {vp}
                    </label>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="role"
                  checked={visibility === 'role'}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-3.5 h-3.5"
                />
                <span className="text-sm">By Role</span>
              </label>

              {visibility === 'role' && (
                <div className="ml-6 flex flex-wrap gap-1.5">
                  {roles.map(role => (
                    <label key={role} className="flex items-center gap-1.5 px-2 py-1 bg-white border rounded text-xs cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={allowedRoles.includes(role)}
                        onChange={() => toggleRole(role)}
                        className="w-3 h-3"
                      />
                      {role}
                    </label>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="specific_users"
                  checked={visibility === 'specific_users'}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-3.5 h-3.5"
                />
                <span className="text-sm">Specific Users</span>
              </label>

              {visibility === 'specific_users' && (
                <div className="ml-6 space-y-2">
                  {selectedMembers.length > 0 && (
                    <div className="space-y-1">
                      {selectedMembers.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-1.5 bg-white rounded text-xs">
                          <span>{member.first_name} {member.last_name}</span>
                          <button
                            type="button"
                            onClick={() => toggleMember(member.id)}
                            className="p-2 min-h-[44px] min-w-[44px] text-red-600 hover:bg-red-50 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input
                    type="text"
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                    placeholder="Search members..."
                    className="w-full px-2 py-1.5 text-xs border rounded"
                  />
                  
                  {searchMember && (
                    <div className="max-h-32 overflow-y-auto border rounded text-xs">
                      {filteredMembers.map(member => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleMember(member.id)}
                          disabled={selectedMemberIds.includes(member.id)}
                          className="w-full text-left p-2 hover:bg-gray-50 border-b last:border-b-0 disabled:opacity-50"
                        >
                          {member.first_name} {member.last_name} • {member.voice_part}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Setlist */}
        <div className="border rounded-lg">
          <button
            type="button"
            onClick={() => setShowSetlist(!showSetlist)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-medium">Setlist</span>
              <span className="text-xs text-gray-500">{selectedSongs.length} songs</span>
            </div>
            {showSetlist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showSetlist && (
            <div className="p-3 border-t space-y-2">
              {selectedSongs.length > 0 && (
                <div className="space-y-1">
                  {selectedSongs.map((song, index) => (
                    <div key={song.id} className="flex items-center justify-between p-2 bg-indigo-50 rounded">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium text-indigo-600">#{index + 1}</span>
                        <div className="text-xs truncate">
                          <div className="font-medium">{song.title}</div>
                          <div className="text-gray-600">{song.composer}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSong(song.id)}
                        className="p-2 min-h-[44px] min-w-[44px] text-red-600 hover:bg-red-100 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={searchSong}
                onChange={(e) => setSearchSong(e.target.value)}
                placeholder="Search songs to add..."
                className="w-full px-3 py-2 text-sm border rounded-lg"
              />
              
              {searchSong && (
                <div className="max-h-40 overflow-y-auto border rounded">
                  {filteredAvailableSongs.map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => addSong(song.id)}
                      className="w-full text-left p-2 hover:bg-gray-50 border-b last:border-b-0 text-xs"
                    >
                      <div className="font-medium">{song.title}</div>
                      <div className="text-gray-600">{song.composer}</div>
                    </button>
                  ))}
                  {filteredAvailableSongs.length === 0 && (
                    <div className="p-3 text-center text-gray-500 text-xs">No songs found</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compact Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/admin/events')}
            className="flex-1 px-4 py-2 text-sm border text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50 hover:bg-indigo-700"
          >
            {loading ? 'Saving...' : (eventId ? 'Update' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
};
