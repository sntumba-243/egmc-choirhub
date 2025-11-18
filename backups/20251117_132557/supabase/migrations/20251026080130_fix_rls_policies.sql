/*
  # Fix RLS Policies to Prevent Infinite Recursion

  1. Changes
    - Drop existing policies that cause infinite recursion
    - Create new policies using auth.jwt() instead of querying users table
  
  2. Security
    - Maintains same security model without infinite recursion
*/

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;
DROP POLICY IF EXISTS "Allow authenticated user insert" ON users;

-- Create new policies using auth.jwt() to avoid recursion
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
  USING ((auth.jwt()->>'role')::text = 'admin' OR auth.uid() = id);

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'role')::text = 'admin' OR auth.uid() = id);

CREATE POLICY "Admins can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'admin')
  WITH CHECK ((auth.jwt()->>'role')::text = 'admin');

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'admin');

-- Fix songs policies
DROP POLICY IF EXISTS "Admins can manage songs" ON songs;

CREATE POLICY "Admins can insert songs"
  ON songs FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'role')::text = 'admin');

CREATE POLICY "Admins can update songs"
  ON songs FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'admin')
  WITH CHECK ((auth.jwt()->>'role')::text = 'admin');

CREATE POLICY "Admins can delete songs"
  ON songs FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'admin');

-- Fix events policies
DROP POLICY IF EXISTS "Admins can manage events" ON events;

CREATE POLICY "Admins can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'role')::text = 'admin');

CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'admin')
  WITH CHECK ((auth.jwt()->>'role')::text = 'admin');

CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'admin');

-- Fix messages policies
DROP POLICY IF EXISTS "Admins can manage messages" ON messages;

CREATE POLICY "Admins can insert messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'role')::text = 'admin');

CREATE POLICY "Admins can update messages"
  ON messages FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'admin')
  WITH CHECK ((auth.jwt()->>'role')::text = 'admin');

CREATE POLICY "Admins can delete messages"
  ON messages FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'role')::text = 'admin');
