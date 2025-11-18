/*
  # Add Voice Parts and Instrumentalist Fields to Songs Table

  1. Changes
    - Add `voice_parts` column (text array) - List of voice parts that sing this song (e.g., ["soprano", "alto", "tenor", "bass"])
    - Add `instrumentalist` column (text) - Name/description of instrumentalist if applicable

  2. Notes
    - Voice parts array allows tracking which sections perform each song
    - Instrumentalist field supports songs with instrumental accompaniment
    - Existing songs will have null values for these fields
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'songs' AND column_name = 'voice_parts'
  ) THEN
    ALTER TABLE songs ADD COLUMN voice_parts text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'songs' AND column_name = 'instrumentalist'
  ) THEN
    ALTER TABLE songs ADD COLUMN instrumentalist text;
  END IF;
END $$;
