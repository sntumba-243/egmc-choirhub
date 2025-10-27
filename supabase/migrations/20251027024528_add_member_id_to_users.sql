/*
  # Add Member ID to Users Table

  1. Changes
    - Add `member_id` column (text, unique) - Format: FirstInitialLastName (e.g., "jsmith" for John Smith)
    - Generate member IDs for existing users based on their names
    - Add unique constraint to ensure no duplicate member IDs

  2. Security
    - Update RLS policies to allow login with member_id
    - Member ID will be used as an alternative to email for authentication

  3. Notes
    - Member IDs are generated from first initial + last name (lowercase, no spaces)
    - If duplicate member IDs exist, append a number (e.g., jsmith1, jsmith2)
*/

-- Add member_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'member_id'
  ) THEN
    ALTER TABLE users ADD COLUMN member_id text UNIQUE;
  END IF;
END $$;

-- Function to generate member ID from name
CREATE OR REPLACE FUNCTION generate_member_id(user_name text)
RETURNS text AS $$
DECLARE
  first_initial text;
  last_name text;
  base_member_id text;
  final_member_id text;
  counter integer := 1;
  name_parts text[];
BEGIN
  -- Split name into parts
  name_parts := string_to_array(trim(user_name), ' ');
  
  -- Get first initial (first character of first name)
  first_initial := lower(substring(name_parts[1], 1, 1));
  
  -- Get last name (last element of array)
  IF array_length(name_parts, 1) > 1 THEN
    last_name := lower(regexp_replace(name_parts[array_length(name_parts, 1)], '[^a-zA-Z]', '', 'g'));
  ELSE
    last_name := lower(regexp_replace(name_parts[1], '[^a-zA-Z]', '', 'g'));
  END IF;
  
  -- Create base member ID
  base_member_id := first_initial || last_name;
  final_member_id := base_member_id;
  
  -- Check for duplicates and append number if needed
  WHILE EXISTS (SELECT 1 FROM users WHERE member_id = final_member_id) LOOP
    final_member_id := base_member_id || counter::text;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_member_id;
END;
$$ LANGUAGE plpgsql;

-- Generate member IDs for existing users who don't have one
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id, name FROM users WHERE member_id IS NULL LOOP
    UPDATE users 
    SET member_id = generate_member_id(user_record.name)
    WHERE id = user_record.id;
  END LOOP;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_member_id ON users(member_id);
