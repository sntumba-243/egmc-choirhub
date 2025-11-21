-- ============================================
-- VOCAL COACH STORAGE BUCKET SETUP
-- ============================================
-- Run these SQL commands in Supabase SQL Editor
-- after creating the 'vocal-recordings' storage bucket

-- 1. Create the storage bucket (do this in Supabase Dashboard UI first)
--    Name: vocal-recordings
--    Public: false
--    File size limit: 50MB

-- 2. Set up RLS policies for the storage bucket

-- Policy 1: Users can upload their own recordings
CREATE POLICY "Users can upload their own recordings"
ON storage.objects 
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vocal-recordings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Users can read their own recordings
CREATE POLICY "Users can read their own recordings"
ON storage.objects 
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vocal-recordings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Users can delete their own recordings
CREATE POLICY "Users can delete their own recordings"
ON storage.objects 
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vocal-recordings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Admins can access all recordings (optional)
CREATE POLICY "Admins can access all recordings"
ON storage.objects 
FOR ALL
TO authenticated
USING (
  bucket_id = 'vocal-recordings'
  AND EXISTS (
    SELECT 1 FROM members 
    WHERE members.user_id = auth.uid() 
    AND members.role = 'admin'
  )
);

-- ============================================
-- VERIFY POLICIES
-- ============================================
-- Run this to check if policies are set up correctly:

SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%vocal%'
ORDER BY policyname;

-- ============================================
-- TEST QUERIES
-- ============================================

-- Test 1: Check if bucket exists
SELECT * FROM storage.buckets WHERE name = 'vocal-recordings';

-- Test 2: List all recordings for current user (run as authenticated user)
SELECT * FROM storage.objects 
WHERE bucket_id = 'vocal-recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text;

-- Test 3: Get total storage used by user
SELECT 
  auth.uid() as user_id,
  COUNT(*) as recording_count,
  SUM(size) as total_bytes,
  pg_size_pretty(SUM(size)::bigint) as total_size
FROM storage.objects
WHERE bucket_id = 'vocal-recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text;

-- ============================================
-- CLEANUP (if needed)
-- ============================================

-- Remove all test recordings for a user
-- CAUTION: This will delete actual files!
-- DELETE FROM storage.objects
-- WHERE bucket_id = 'vocal-recordings'
--   AND (storage.foldername(name))[1] = 'USER_ID_HERE';

-- ============================================
-- MAINTENANCE QUERIES
-- ============================================

-- Find large files (>10MB)
SELECT 
  name,
  size,
  pg_size_pretty(size::bigint) as size_formatted,
  created_at,
  updated_at
FROM storage.objects
WHERE bucket_id = 'vocal-recordings'
  AND size > 10485760
ORDER BY size DESC;

-- Find old recordings (>90 days)
SELECT 
  name,
  created_at,
  age(now(), created_at) as age
FROM storage.objects
WHERE bucket_id = 'vocal-recordings'
  AND created_at < now() - interval '90 days'
ORDER BY created_at;

-- Get storage usage by user
SELECT 
  (storage.foldername(name))[1] as user_id,
  COUNT(*) as file_count,
  pg_size_pretty(SUM(size)::bigint) as total_size
FROM storage.objects
WHERE bucket_id = 'vocal-recordings'
GROUP BY (storage.foldername(name))[1]
ORDER BY SUM(size) DESC;

-- ============================================
-- NOTES
-- ============================================
-- 
-- File Path Structure:
-- vocal-recordings/{user_id}/{timestamp}.webm
-- Example: vocal-recordings/123e4567-e89b-12d3-a456-426614174000/1702345678901.webm
--
-- Supported Audio Formats:
-- - WebM (audio/webm) - Best cross-browser support
-- - MP4 (audio/mp4) - iOS fallback
-- - AAC (audio/aac) - Alternative
--
-- Best Practices:
-- 1. Set reasonable file size limits (50MB default)
-- 2. Implement cleanup for old recordings
-- 3. Consider compression for long recordings
-- 4. Monitor storage usage per user
-- 5. Use CDN for better performance (Supabase has built-in CDN)
--
-- Security:
-- - All recordings are private by default
-- - Users can only access their own files
-- - File paths include user ID for organization
-- - RLS policies enforce access control
-- - Admins have full access (if admin policy enabled)
