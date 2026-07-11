-- Ensure songs.updated_at exists and bumps on every edit.
--
-- The original create_songs_table migration did not include updated_at (a later
-- CREATE TABLE IF NOT EXISTS that had it was a no-op), and no trigger maintained
-- it. The sheet-music viewer uses updated_at as a cache-busting token so that an
-- edited song loads fresh through the SW cache and Vercel CDN instead of serving
-- stale bytes. This migration makes that token reliable.

-- 1. Column (idempotent — safe whether or not it already exists)
ALTER TABLE songs ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Backfill nulls so existing rows have a value
UPDATE songs SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- 3. Auto-bump on every UPDATE
CREATE OR REPLACE FUNCTION set_songs_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_songs_updated_at ON songs;
CREATE TRIGGER trg_songs_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION set_songs_updated_at();
