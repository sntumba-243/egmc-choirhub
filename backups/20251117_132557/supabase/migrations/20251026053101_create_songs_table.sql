/*
  # Create Songs Table

  1. New Tables
    - `songs`
      - `id` (uuid, primary key) - Unique song identifier
      - `title` (text) - Song title
      - `composer` (text) - Composer name
      - `arranger` (text) - Arranger name
      - `sheet_music_url` (text, nullable) - URL to sheet music PDF
      - `soprano_audio_url` (text, nullable) - URL to soprano practice track
      - `alto_audio_url` (text, nullable) - URL to alto practice track
      - `tenor_audio_url` (text, nullable) - URL to tenor practice track
      - `bass_audio_url` (text, nullable) - URL to bass practice track
      - `tags` (text array) - Tags for categorization
      - `youtube_link` (text, nullable) - YouTube video link
      - `spotify_link` (text, nullable) - Spotify link
      - `date_added` (timestamptz) - Date song was added
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on `songs` table
    - Add policy for authenticated users to read all songs
    - Add policy for admins to insert songs
    - Add policy for admins to update songs
    - Add policy for admins to delete songs
*/

CREATE TABLE IF NOT EXISTS songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  composer text NOT NULL DEFAULT '',
  arranger text NOT NULL DEFAULT '',
  sheet_music_url text,
  soprano_audio_url text,
  alto_audio_url text,
  tenor_audio_url text,
  bass_audio_url text,
  tags text[] DEFAULT '{}',
  youtube_link text,
  spotify_link text,
  date_added timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read songs"
  ON songs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert songs"
  ON songs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update songs"
  ON songs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete songs"
  ON songs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );