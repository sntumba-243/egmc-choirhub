/*
  # Create Events Table

  1. New Tables
    - `events`
      - `id` (uuid, primary key) - Unique event identifier
      - `title` (text) - Event title
      - `date` (date) - Event date
      - `time` (text) - Event time
      - `location` (text) - Event location
      - `description` (text) - Event description
      - `type` (text) - Event type (Rehearsal, Concert, Social, Other)
      - `requires_rsvp` (boolean) - Whether RSVP is required
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on `events` table
    - Add policy for authenticated users to read all events
    - Add policy for admins to insert events
    - Add policy for admins to update events
    - Add policy for admins to delete events
*/

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date date NOT NULL,
  time text NOT NULL,
  location text NOT NULL,
  description text DEFAULT '',
  type text NOT NULL CHECK (type IN ('Rehearsal', 'Concert', 'Social', 'Other')),
  requires_rsvp boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
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

CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );