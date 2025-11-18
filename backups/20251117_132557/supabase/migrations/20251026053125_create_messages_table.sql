/*
  # Create Messages Table

  1. New Tables
    - `messages`
      - `id` (uuid, primary key) - Unique message identifier
      - `subject` (text) - Message subject
      - `body` (text) - Message body
      - `send_to` (text) - Recipient group (All, Soprano, Alto, Tenor, Bass)
      - `sent_by` (uuid, foreign key) - User who sent the message
      - `sent_date` (timestamptz) - Date message was sent
      - `is_important` (boolean) - Whether message is marked important
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable RLS on `messages` table
    - Add policy for authenticated users to read messages sent to their voice part or All
    - Add policy for admins to read all messages
    - Add policy for admins to insert messages
    - Add policy for admins to update their own messages
    - Add policy for admins to delete their own messages
*/

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body text NOT NULL,
  send_to text NOT NULL CHECK (send_to IN ('All', 'Soprano', 'Alto', 'Tenor', 'Bass')),
  sent_by uuid REFERENCES users(id) ON DELETE CASCADE,
  sent_date timestamptz DEFAULT now(),
  is_important boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read messages for their voice part"
  ON messages FOR SELECT
  TO authenticated
  USING (
    send_to = 'All' OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.voice_part = LOWER(messages.send_to)
    )
  );

CREATE POLICY "Admins can insert messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update their messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND messages.sent_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND messages.sent_by = auth.uid()
    )
  );

CREATE POLICY "Admins can delete their messages"
  ON messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND messages.sent_by = auth.uid()
    )
  );