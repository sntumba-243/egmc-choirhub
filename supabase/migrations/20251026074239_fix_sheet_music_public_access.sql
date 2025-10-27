/*
  # Fix Sheet Music Public Access

  1. Changes
    - Drop the restrictive SELECT policy that only allows authenticated users
    - Add a new policy that allows public access to the public bucket
    - This ensures anyone (authenticated or not) can view sheet music files
    
  2. Security
    - Upload/Update/Delete still restricted to admins only
    - Read access is now public since the bucket is already public
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Authenticated users can read sheet music" ON storage.objects;

-- Allow public read access to sheet music files
CREATE POLICY "Public read access to sheet music"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'sheet-music');
