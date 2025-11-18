/*
  # Allow Duplicate Email Addresses

  1. Changes
    - Drop unique constraint on email column in users table
    - This allows multiple members to share the same email address
    
  2. Notes
    - Auth users still require unique emails
    - Public users table can now have duplicate emails
    - This is useful for testing or family members sharing an email
*/

-- Drop the unique constraint on email if it exists
DO $$
BEGIN
  -- Drop unique constraint on email
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_email_key;
  END IF;
  
  -- Drop unique index on email if it exists
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'users_email_key'
  ) THEN
    DROP INDEX IF EXISTS users_email_key;
  END IF;
END $$;
