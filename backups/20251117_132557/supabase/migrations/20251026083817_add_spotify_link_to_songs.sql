/*
  # Add Spotify Link to Songs Table

  1. Changes
    - Add `spotify_link` column to songs table
    - This allows storing Spotify links for songs
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'songs' AND column_name = 'spotify_link'
  ) THEN
    ALTER TABLE songs ADD COLUMN spotify_link text;
  END IF;
END $$;
