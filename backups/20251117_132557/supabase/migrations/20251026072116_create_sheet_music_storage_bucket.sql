/*
  # Create Storage Bucket for Sheet Music

  1. Storage Setup
    - Create `sheet-music` bucket for storing PDF, HTML, and other sheet music files
    - Set bucket to public for easy access by choir members
    
  2. Security
    - Allow authenticated users to read all files
    - Only admins can upload/update/delete files
*/

-- Create the storage bucket for sheet music
INSERT INTO storage.buckets (id, name, public)
VALUES ('sheet-music', 'sheet-music', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read sheet music files
CREATE POLICY "Authenticated users can read sheet music"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'sheet-music');

-- Allow admins to upload sheet music files
CREATE POLICY "Admins can upload sheet music"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sheet-music' 
  AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- Allow admins to update sheet music files
CREATE POLICY "Admins can update sheet music"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'sheet-music'
  AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- Allow admins to delete sheet music files
CREATE POLICY "Admins can delete sheet music"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'sheet-music'
  AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);