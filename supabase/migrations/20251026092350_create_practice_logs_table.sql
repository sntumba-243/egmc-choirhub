/*
  # Create Practice Logs Table

  1. New Tables
    - `practice_logs`
      - `id` (uuid, primary key) - Unique log identifier
      - `user_id` (uuid, foreign key) - User who practiced
      - `song_id` (uuid, foreign key) - Song that was practiced
      - `date` (timestamptz) - When the practice session occurred
      - `duration` (integer) - Duration in minutes
      - `speed_used` (text) - Speed notation (e.g., "75%", "full tempo")
      - `notes` (text) - Optional notes about the practice session
      - `created_at` (timestamptz) - Log creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `practice_logs` table
    - Add policy for users to read their own logs
    - Add policy for users to insert their own logs
    - Add policy for users to update their own logs
    - Add policy for users to delete their own logs

  3. Indexes
    - Create index on (user_id, date) for efficient queries
    - Create index on (user_id, song_id) for song-specific queries
*/

CREATE TABLE IF NOT EXISTS practice_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  song_id uuid REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
  date timestamptz DEFAULT now() NOT NULL,
  duration integer DEFAULT 0 NOT NULL,
  speed_used text DEFAULT 'full tempo',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE practice_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own logs"
  ON practice_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
  ON practice_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs"
  ON practice_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own logs"
  ON practice_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS practice_logs_user_date_idx ON practice_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS practice_logs_user_song_idx ON practice_logs(user_id, song_id);