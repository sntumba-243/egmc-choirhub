import { getDbClient } from './supabase';

export interface Church {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  address: string | null;
  city: string | null;
  country: string | null;
  pastor_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChurchSongStatus {
  id: string;
  church_id: string;
  song_id: string;
  status: 'learned' | 'learning' | 'not_started';
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const churchService = {
  async getChurches(): Promise<Church[]> {
    const supabase = getDbClient();
    const { data, error } = await supabase
      .from('churches')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getChurch(id: string): Promise<Church | null> {
    const supabase = getDbClient();
    const { data, error } = await supabase
      .from('churches')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createChurch(church: Partial<Church>): Promise<Church> {
    const supabase = getDbClient();
    const { data, error } = await supabase
      .from('churches')
      .insert([church])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateChurch(id: string, church: Partial<Church>): Promise<void> {
    const supabase = getDbClient();
    const { error } = await supabase
      .from('churches')
      .update({ ...church, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteChurch(id: string): Promise<void> {
    const supabase = getDbClient();
    const { error } = await supabase
      .from('churches')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  async getChurchMembers(churchId: string) {
    const supabase = getDbClient();
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('church_id', churchId)
      .order('first_name');

    if (error) throw error;
    return data || [];
  },

  async getChurchStats(churchId: string) {
    const supabase = getDbClient();
    const [members, events, songStatuses] = await Promise.all([
      supabase.from('members').select('id', { count: 'exact' }).eq('church_id', churchId),
      supabase.from('events').select('id', { count: 'exact' }).eq('church_id', churchId),
      supabase.from('church_song_status').select('status').eq('church_id', churchId),
    ]);

    const statuses = songStatuses.data || [];
    return {
      totalMembers: members.count || 0,
      totalEvents: events.count || 0,
      songsLearned: statuses.filter(s => s.status === 'learned').length,
      songsLearning: statuses.filter(s => s.status === 'learning').length,
      songsNotStarted: statuses.filter(s => s.status === 'not_started').length,
    };
  },

  async setSuperAdmin(userId: string, isSuperAdmin: boolean): Promise<void> {
    const supabase = getDbClient();
    const { error } = await supabase
      .from('users')
      .update({ is_super_admin: isSuperAdmin })
      .eq('id', userId);

    if (error) throw error;
  },
};

export const churchSongStatusService = {
  async getStatuses(churchId: string): Promise<ChurchSongStatus[]> {
    const supabase = getDbClient();
    const { data, error } = await supabase
      .from('church_song_status')
      .select('*')
      .eq('church_id', churchId);

    if (error) throw error;
    return data || [];
  },

  async getStatus(churchId: string, songId: string): Promise<ChurchSongStatus | null> {
    const supabase = getDbClient();
    const { data, error } = await supabase
      .from('church_song_status')
      .select('*')
      .eq('church_id', churchId)
      .eq('song_id', songId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async setStatus(churchId: string, songId: string, status: string, userId: string, notes?: string): Promise<void> {
    const supabase = getDbClient();
    const { error } = await supabase
      .from('church_song_status')
      .upsert([{
        church_id: churchId,
        song_id: songId,
        status,
        updated_by: userId,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      }], { onConflict: 'church_id,song_id' });

    if (error) throw error;
  },

  async bulkSetStatus(churchId: string, songIds: string[], status: string, userId: string): Promise<void> {
    const supabase = getDbClient();
    const records = songIds.map(songId => ({
      church_id: churchId,
      song_id: songId,
      status,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('church_song_status')
      .upsert(records, { onConflict: 'church_id,song_id' });

    if (error) throw error;
  },
};
