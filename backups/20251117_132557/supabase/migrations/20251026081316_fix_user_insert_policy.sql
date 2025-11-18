/*
  # Fix User Insert Policy for Admin Creating Members

  1. Changes
    - Update the insert policy to properly allow admins to create any user
    - Remove the self-insert condition as it's not needed
  
  2. Security
    - Only admins can insert new users into the users table
    - Regular users cannot create other users
*/

-- Drop the problematic insert policy
DROP POLICY IF EXISTS "Admins can insert users" ON users;

-- Create a cleaner insert policy
CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->>'role')::text = 'admin');
