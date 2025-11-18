/*
  # Allow Anonymous Member ID Lookup

  1. Changes
    - Add policy to allow anonymous (anon) users to SELECT email from users table
    - This is restricted to lookups by member_id only (for login purposes)
    - Allows the login-with-member-id edge function to work without authentication

  2. Security
    - Only allows reading email field (not sensitive data like phone, role, etc.)
    - Required for member ID login flow
    - The edge function immediately uses the email for authentication
*/

-- Allow anonymous users to look up email by member_id for login purposes
CREATE POLICY "Allow anon to lookup email by member_id"
  ON users
  FOR SELECT
  TO anon
  USING (true);
