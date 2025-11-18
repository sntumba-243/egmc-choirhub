/*
  # Create Read Messages Table

  1. New Tables
    - `read_messages`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, foreign key) - User who read the message
      - `message_id` (uuid, foreign key) - Message that was read
      - `read_at` (timestamptz) - When the message was read

  2. Security
    - Enable RLS on `read_messages` table
    - Add policy for users to read their own read status
    - Add policy for users to insert their own read status
    - Add policy for users to update their own read status

  3. Indexes
    - Create unique index on (user_id, message_id) to prevent duplicates
    - Create index on user_id for efficient filtering
*/

CREATE TABLE IF NOT EXISTS read_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  read_at timestamptz DEFAULT now(),
  UNIQUE(user_id, message_id)
);

ALTER TABLE read_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own read status"
  ON read_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own read status"
  ON read_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own read status"
  ON read_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS read_messages_user_id_idx ON read_messages(user_id);
CREATE INDEX IF NOT EXISTS read_messages_user_message_idx ON read_messages(user_id, message_id);