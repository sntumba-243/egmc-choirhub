/*
  # Create Practice Notes Table

  1. New Tables
    - `practice_notes`
      - `id` (uuid, primary key) - Unique note identifier
      - `user_id` (uuid, foreign key) - User who wrote the note
      - `song_id` (uuid, foreign key) - Song the note is about
      - `notes` (text) - Practice notes content
      - `created_at` (timestamptz) - Note creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `practice_notes` table
    - Add policy for users to read their own notes
    - Add policy for users to insert their own notes
    - Add policy for users to update their own notes
    - Add policy for users to delete their own notes

  3. Indexes
    - Create unique index on (user_id, song_id) to prevent duplicates
*/

CREATE TABLE IF NOT EXISTS practice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  song_id uuid REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, song_id)
);

ALTER TABLE practice_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notes"
  ON practice_notes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON practice_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON practice_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON practice_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS practice_notes_user_song_idx ON practice_notes(user_id, song_id);