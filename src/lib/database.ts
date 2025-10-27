import { supabase } from './supabase';

export interface Song {
  id: string;
  title: string;
  composer: string;
  arranger?: string | null;
  tags?: string[];
  sheet_music_url?: string | null;
  soprano_audio_url?: string | null;
  alto_audio_url?: string | null;
  tenor_audio_url?: string | null;
  bass_audio_url?: string | null;
  youtube_link?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  voice_part?: 'soprano' | 'alto' | 'tenor' | 'bass' | null;
  role: 'admin' | 'member';
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description?: string | null;
  type: 'rehearsal' | 'concert' | 'social' | 'other';
  setlist?: string[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  subject: string;
  body: string;
  send_to: string;
  sent_by: string;
  sent_date: string;
  is_important: boolean;
  created_at?: string;
}

export interface DirectMessage {
  id: string;
  subject: string;
  body: string;
  sender_id: string;
  recipient_id: string | null;
  is_read: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: 'yes' | 'no' | 'maybe';
  created_at?: string;
  updated_at?: string;
}

export interface PracticeNote {
  id: string;
  user_id: string;
  song_id: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReadMessage {
  id: string;
  message_id: string;
  user_id: string;
  read_at?: string;
}

export const songsService = {
  async getSongs(): Promise<Song[]> {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getSong(id: string): Promise<Song | null> {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createSong(song: Omit<Song, 'id' | 'created_at' | 'updated_at'>): Promise<Song> {
    const { data, error } = await supabase
      .from('songs')
      .insert([song])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateSong(id: string, song: Partial<Song>): Promise<void> {
    const { error } = await supabase
      .from('songs')
      .update(song)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteSong(id: string): Promise<void> {
    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async bulkCreateSongs(songs: Omit<Song, 'id' | 'created_at' | 'updated_at'>[]): Promise<Song[]> {
    const { data, error } = await supabase
      .from('songs')
      .insert(songs)
      .select();

    if (error) throw error;
    return data || [];
  },
};

export const membersService = {
  async getMembers(): Promise<Member[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getMember(id: string): Promise<Member | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createMember(member: Omit<Member, 'id' | 'created_at' | 'updated_at'> & { password?: string }): Promise<Member> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-member`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: member.email,
          password: member.password,
          name: member.name,
          phone: member.phone,
          role: member.role,
          voice_part: member.voice_part,
          status: member.status,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create member');
    }

    const result = await response.json();
    return {
      ...result.data,
      password: result.password
    };
  },

  async updateMember(id: string, member: Partial<Member>): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update(member)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteMember(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

export const eventsService = {
  async getEvents(): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getEvent(id: string): Promise<Event | null> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createEvent(event: Omit<Event, 'id' | 'created_at' | 'updated_at'>): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .insert([event])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateEvent(id: string, event: Partial<Event>): Promise<void> {
    const { error } = await supabase
      .from('events')
      .update(event)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteEvent(id: string): Promise<void> {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

export const messagesService = {
  async getMessages(): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getMessage(id: string): Promise<Message | null> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createMessage(message: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert([message])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getMessagesByUserId(userId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .contains('recipients', [userId])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};

export const rsvpService = {
  async getRSVPs(eventId: string): Promise<RSVP[]> {
    const { data, error } = await supabase
      .from('rsvps')
      .select('*')
      .eq('event_id', eventId);

    if (error) throw error;
    return data || [];
  },

  async getUserRSVP(eventId: string, userId: string): Promise<RSVP | null> {
    const { data, error } = await supabase
      .from('rsvps')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsertRSVP(rsvp: Omit<RSVP, 'id' | 'created_at' | 'updated_at'>): Promise<RSVP> {
    const { data, error } = await supabase
      .from('rsvps')
      .upsert([rsvp], { onConflict: 'event_id,user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export const directMessagesService = {
  async getDirectMessages(userId?: string): Promise<DirectMessage[]> {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = userId || user?.id;

    if (!currentUserId) return [];

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getDirectMessage(id: string): Promise<DirectMessage | null> {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createDirectMessage(message: Omit<DirectMessage, 'id' | 'created_at' | 'updated_at' | 'is_read'>): Promise<DirectMessage> {
    const { data, error } = await supabase
      .from('direct_messages')
      .insert([{ ...message, is_read: false }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('direct_messages')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteDirectMessage(id: string): Promise<void> {
    const { error } = await supabase
      .from('direct_messages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

export interface PracticeLog {
  id: string;
  user_id: string;
  song_id: string;
  date: string;
  duration: number;
  speed_used: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PracticePlaylist {
  id: string;
  user_id: string;
  name: string;
  song_ids: string[];
  created_at?: string;
  updated_at?: string;
}

export const practiceNotesService = {
  async getPracticeNotes(userId: string, songId: string): Promise<PracticeNote | null> {
    const { data, error } = await supabase
      .from('practice_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('song_id', songId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsertPracticeNote(note: Omit<PracticeNote, 'id' | 'created_at' | 'updated_at'>): Promise<PracticeNote> {
    const { data, error } = await supabase
      .from('practice_notes')
      .upsert([note], { onConflict: 'user_id,song_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export const practiceLogsService = {
  async getLogs(userId: string): Promise<PracticeLog[]> {
    const { data, error } = await supabase
      .from('practice_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createLog(log: Omit<PracticeLog, 'id' | 'created_at' | 'updated_at'>): Promise<PracticeLog> {
    const { data, error } = await supabase
      .from('practice_logs')
      .insert([log])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateLog(id: string, log: Partial<PracticeLog>): Promise<void> {
    const { error } = await supabase
      .from('practice_logs')
      .update(log)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteLog(id: string): Promise<void> {
    const { error } = await supabase
      .from('practice_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getStats(userId: string): Promise<{ totalMinutes: number; sessionCount: number }> {
    const logs = await this.getLogs(userId);
    return {
      totalMinutes: logs.reduce((total, log) => total + log.duration, 0),
      sessionCount: logs.length,
    };
  },
};

export const practicePlaylistsService = {
  async getPlaylists(userId: string): Promise<PracticePlaylist[]> {
    const { data, error } = await supabase
      .from('practice_playlists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createPlaylist(playlist: Omit<PracticePlaylist, 'id' | 'created_at' | 'updated_at'>): Promise<PracticePlaylist> {
    const { data, error } = await supabase
      .from('practice_playlists')
      .insert([playlist])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updatePlaylist(id: string, playlist: Partial<PracticePlaylist>): Promise<void> {
    const { error } = await supabase
      .from('practice_playlists')
      .update(playlist)
      .eq('id', id);

    if (error) throw error;
  },

  async deletePlaylist(id: string): Promise<void> {
    const { error } = await supabase
      .from('practice_playlists')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

export const readMessagesService = {
  async markAsRead(messageId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('read_messages')
      .upsert([{ message_id: messageId, user_id: userId }], { onConflict: 'message_id,user_id' });

    if (error) throw error;
  },

  async isMessageRead(messageId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('read_messages')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },

  async getReadMessages(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('read_messages')
      .select('message_id')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map(item => item.message_id);
  },
};
