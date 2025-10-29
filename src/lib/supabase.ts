import { createClient } from '@supabase/supabase-js';

// Support both Vite and Vercel/Next.js environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase Configuration Check:');
console.log('URL exists:', !!supabaseUrl);
console.log('Key exists:', !!supabaseAnonKey);
console.log('URL:', supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials!');
  console.error('Available env vars:', Object.keys(import.meta.env));
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, options).catch(err => {
        // Suppress 403 errors from auth endpoints in WebContainer
        if (err.message?.includes('403')) {
          console.log('Auth endpoint 403 (expected in WebContainer)');
          return new Response(JSON.stringify({ error: 'Not available' }), { status: 403 });
        }
        throw err;
      });
    }
  }
});

// Make supabase available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  console.log('✅ Supabase client loaded globally');
}

console.log('First 20 chars of key:', supabaseAnonKey?.substring(0, 20));
console.log('Full key length:', supabaseAnonKey?.length);

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          phone: string | null
          role: 'admin' | 'member'
          voice_part: 'soprano' | 'alto' | 'tenor' | 'bass' | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          phone?: string | null
          role?: 'admin' | 'member'
          voice_part?: 'soprano' | 'alto' | 'tenor' | 'bass' | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          phone?: string | null
          role?: 'admin' | 'member'
          voice_part?: 'soprano' | 'alto' | 'tenor' | 'bass' | null
          status?: 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
      }
      songs: {
        Row: {
          id: string
          title: string
          composer: string
          arranger: string | null
          tags: string[] | null
          sheet_music_url: string | null
          youtube_link: string | null
          soprano_audio_url: string | null
          alto_audio_url: string | null
          tenor_audio_url: string | null
          bass_audio_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          composer: string
          arranger?: string | null
          tags?: string[] | null
          sheet_music_url?: string | null
          youtube_link?: string | null
          soprano_audio_url?: string | null
          alto_audio_url?: string | null
          tenor_audio_url?: string | null
          bass_audio_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          composer?: string
          arranger?: string | null
          tags?: string[] | null
          sheet_music_url?: string | null
          youtube_link?: string | null
          soprano_audio_url?: string | null
          alto_audio_url?: string | null
          tenor_audio_url?: string | null
          bass_audio_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          title: string
          date: string
          time: string
          location: string
          description: string | null
          type: 'rehearsal' | 'concert' | 'social' | 'other'
          setlist: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          date: string
          time: string
          location: string
          description?: string | null
          type: 'rehearsal' | 'concert' | 'social' | 'other'
          setlist?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          date?: string
          time?: string
          location?: string
          description?: string | null
          type?: 'rehearsal' | 'concert' | 'social' | 'other'
          setlist?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          subject: string
          body: string
          sender_id: string
          priority: 'normal' | 'high' | 'urgent'
          recipients: string[]
          created_at: string
        }
        Insert: {
          id?: string
          subject: string
          body: string
          sender_id: string
          priority?: 'normal' | 'high' | 'urgent'
          recipients: string[]
          created_at?: string
        }
        Update: {
          id?: string
          subject?: string
          body?: string
          sender_id?: string
          priority?: 'normal' | 'high' | 'urgent'
          recipients?: string[]
          created_at?: string
        }
      }
      rsvps: {
        Row: {
          id: string
          event_id: string
          user_id: string
          status: 'yes' | 'no' | 'maybe'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          status: 'yes' | 'no' | 'maybe'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string
          status?: 'yes' | 'no' | 'maybe'
          created_at?: string
          updated_at?: string
        }
      }
      practice_notes: {
        Row: {
          id: string
          user_id: string
          song_id: string
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          song_id: string
          notes: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          song_id?: string
          notes?: string
          created_at?: string
          updated_at?: string
        }
      }
      read_messages: {
        Row: {
          id: string
          message_id: string
          user_id: string
          read_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          read_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          read_at?: string
        }
      }
    }
  }
}
