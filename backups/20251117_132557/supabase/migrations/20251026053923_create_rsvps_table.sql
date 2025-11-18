/*
  # Create RSVPs Table

  1. New Tables
    - `rsvps`
      - `id` (uuid, primary key) - Unique RSVP identifier
      - `user_id` (uuid, foreign key) - User who is RSVPing
      - `event_id` (uuid, foreign key) - Event being RSVPed to
      - `response` (text) - RSVP response (attending, not_attending, maybe)
      - `created_at` (timestamptz) - RSVP creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `rsvps` table
    - Add policy for users to read all RSVPs (to see counts)
    - Add policy for users to insert their own RSVPs
    - Add policy for users to update their own RSVPs
    - Add policy for users to delete their own RSVPs

  3. Indexes
    - Create unique index on (user_id, event_id) to prevent duplicates
    - Create index on event_id for efficient counting
*/

CREATE TABLE IF NOT EXISTS rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  response text NOT NULL CHECK (response IN ('attending', 'not_attending', 'maybe')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all RSVPs"
  ON rsvps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own RSVPs"
  ON rsvps FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RSVPs"
  ON rsvps FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own RSVPs"
  ON rsvps FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS rsvps_event_id_idx ON rsvps(event_id);
CREATE INDEX IF NOT EXISTS rsvps_user_event_idx ON rsvps(user_id, event_id);