/*
  # Add Key and Language Fields to Songs Table

  1. Changes
    - Add `key` column (text) - Musical key of the song (e.g., "C Major", "A minor")
    - Add `language` column (text) - Language of the song (e.g., "English", "Latin", "Spanish")
    - Make `composer` column nullable instead of required

  2. Notes
    - Existing songs will have null values for key and language
    - Composer is now optional to allow flexibility in song entries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'songs' AND column_name = 'key'
  ) THEN
    ALTER TABLE songs ADD COLUMN key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'songs' AND column_name = 'language'
  ) THEN
    ALTER TABLE songs ADD COLUMN language text;
  END IF;
END $$;

ALTER TABLE songs ALTER COLUMN composer DROP NOT NULL;
