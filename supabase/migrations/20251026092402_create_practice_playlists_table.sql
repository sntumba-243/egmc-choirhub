/*
  # Create Practice Playlists Table

  1. New Tables
    - `practice_playlists`
      - `id` (uuid, primary key) - Unique playlist identifier
      - `user_id` (uuid, foreign key) - User who owns the playlist
      - `name` (text) - Playlist name
      - `song_ids` (uuid array) - Array of song IDs in the playlist
      - `created_at` (timestamptz) - Playlist creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `practice_playlists` table
    - Add policy for users to read their own playlists
    - Add policy for users to insert their own playlists
    - Add policy for users to update their own playlists
    - Add policy for users to delete their own playlists

  3. Indexes
    - Create index on (user_id) for efficient queries
*/

CREATE TABLE IF NOT EXISTS practice_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  song_ids uuid[] DEFAULT ARRAY[]::uuid[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE practice_playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own playlists"
  ON practice_playlists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own playlists"
  ON practice_playlists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own playlists"
  ON practice_playlists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own playlists"
  ON practice_playlists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS practice_playlists_user_idx ON practice_playlists(user_id);