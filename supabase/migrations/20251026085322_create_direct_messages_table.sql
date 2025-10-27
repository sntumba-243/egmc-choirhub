/*
  # Create Direct Messages Table

  1. New Tables
    - `direct_messages`
      - `id` (uuid, primary key) - Unique message identifier
      - `subject` (text) - Message subject line
      - `body` (text) - Message content
      - `sender_id` (uuid, foreign key) - User who sent the message
      - `recipient_id` (uuid, foreign key) - User who receives the message (null means all admins)
      - `is_read` (boolean) - Whether message has been read
      - `created_at` (timestamptz) - When message was created
      - `updated_at` (timestamptz) - When message was last updated

  2. Security
    - Enable RLS on `direct_messages` table
    - Members can read messages they sent or received
    - Members can send messages to admins
    - Admins can read all messages sent to them or to all admins
    - Users can mark messages as read if they are the recipient

  3. Important Notes
    - Members can only send to admins (recipient_id must be admin or null for all admins)
    - Admins can send to anyone
*/

CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body text NOT NULL,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES users(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read messages they sent or received"
  ON direct_messages FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid() OR
    recipient_id = auth.uid() OR
    (recipient_id IS NULL AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    ))
  );

CREATE POLICY "Members can send messages to admins"
  ON direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      recipient_id IS NULL OR
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = recipient_id
        AND users.role = 'admin'
      )
    )
  );

CREATE POLICY "Users can update messages they sent"
  ON direct_messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Recipients can mark messages as read"
  ON direct_messages FOR UPDATE
  TO authenticated
  USING (
    recipient_id = auth.uid() OR
    (recipient_id IS NULL AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    ))
  )
  WITH CHECK (
    recipient_id = auth.uid() OR
    (recipient_id IS NULL AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    ))
  );

CREATE POLICY "Users can delete messages they sent"
  ON direct_messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());
