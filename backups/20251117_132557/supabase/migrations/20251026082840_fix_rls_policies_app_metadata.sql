/*
  # Fix RLS Policies to Use app_metadata for Role

  1. Changes
    - Update all RLS policies to check role from app_metadata instead of root JWT
    - Role is stored in auth.jwt() -> 'app_metadata' ->> 'role'
    
  2. Security
    - Maintains same security model
    - Admin users can access all data
    - Regular users can only access their own data
*/

-- Drop existing policies for users table
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can delete users" ON users;

-- Create new policies using app_metadata
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

-- Fix other tables
DROP POLICY IF EXISTS "Admins can manage songs" ON songs;
DROP POLICY IF EXISTS "Admins can insert songs" ON songs;
DROP POLICY IF EXISTS "Admins can update songs" ON songs;
DROP POLICY IF EXISTS "Admins can delete songs" ON songs;

CREATE POLICY "Admins can insert songs"
  ON songs FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

CREATE POLICY "Admins can update songs"
  ON songs FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

CREATE POLICY "Admins can delete songs"
  ON songs FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

-- Fix events table
DROP POLICY IF EXISTS "Admins can manage events" ON events;
DROP POLICY IF EXISTS "Admins can insert events" ON events;
DROP POLICY IF EXISTS "Admins can update events" ON events;
DROP POLICY IF EXISTS "Admins can delete events" ON events;

CREATE POLICY "Admins can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');

-- Fix messages table
DROP POLICY IF EXISTS "Admins can manage messages" ON messages;
DROP POLICY IF EXISTS "Admins can insert messages" ON messages;

CREATE POLICY "Admins can insert messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin');
