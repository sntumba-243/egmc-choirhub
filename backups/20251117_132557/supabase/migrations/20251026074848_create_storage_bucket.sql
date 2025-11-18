/*
  # Create Storage Bucket for Sheet Music

  1. Storage
    - Create public bucket for sheet music files
    - Set up policies for authenticated users to upload
    - Allow public read access
*/

-- Create storage bucket for sheet music
INSERT INTO storage.buckets (id, name, public)
VALUES ('sheet-music', 'sheet-music', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload sheet music
CREATE POLICY "Authenticated users can upload sheet music"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sheet-music');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update sheet music"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'sheet-music');

-- Allow public access to read sheet music
CREATE POLICY "Public can read sheet music"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sheet-music');

-- Allow admins to delete sheet music
CREATE POLICY "Admins can delete sheet music"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'sheet-music' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  )
);
