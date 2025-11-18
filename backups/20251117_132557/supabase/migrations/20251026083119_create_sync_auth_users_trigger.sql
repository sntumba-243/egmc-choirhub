/*
  # Create Trigger to Sync Auth Users to Public Users Table

  1. Purpose
    - Automatically sync auth.users to public.users table
    - Ensures users table stays in sync with auth table
    - Extracts role from app_metadata
    
  2. Changes
    - Create trigger function to sync user data
    - Create trigger on auth.users for INSERT and UPDATE
    
  3. Security
    - Runs with security definer to bypass RLS
    - Only syncs necessary fields
*/

-- Create function to sync auth users to public users table
CREATE OR REPLACE FUNCTION public.sync_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert or update the user in the public.users table
  INSERT INTO public.users (
    id,
    email,
    name,
    phone,
    role,
    voice_part,
    status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_app_meta_data->>'role', 'member')::text,
    NEW.raw_user_meta_data->>'voice_part',
    'active'
  )
  ON CONFLICT (id) 
  DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    role = COALESCE(EXCLUDED.role, public.users.role),
    voice_part = COALESCE(EXCLUDED.voice_part, public.users.voice_part),
    updated_at = now();
    
  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_user();

-- Sync any existing auth users that are missing from public.users
INSERT INTO public.users (id, email, name, phone, role, voice_part, status)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', '') as name,
  au.raw_user_meta_data->>'phone' as phone,
  COALESCE(au.raw_app_meta_data->>'role', 'member')::text as role,
  au.raw_user_meta_data->>'voice_part' as voice_part,
  'active' as status
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;
