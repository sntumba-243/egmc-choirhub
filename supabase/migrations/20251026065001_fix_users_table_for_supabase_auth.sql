/*
  # Fix Users Table for Supabase Auth

  1. Changes
    - Remove password_hash column (not needed with Supabase Auth)
    - Ensure id column accepts auth.users UUID
    - Update constraints to match Supabase Auth structure
  
  2. Security
    - Enable RLS
    - Add policies for users to read their own data
*/

-- Remove password_hash column if it exists
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- Make sure id column doesn't auto-generate UUIDs (we'll use auth.users id)
ALTER TABLE users ALTER COLUMN id DROP DEFAULT;

-- Insert admin user if not exists
INSERT INTO users (id, email, name, role, voice_part)
VALUES ('e8a9ad12-2d87-4ec4-a86b-f4ba89a80814', 'sntumba@outlook.com', 'Admin User', 'admin', NULL)
ON CONFLICT (email) DO NOTHING;

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- Create policies
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all users"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
