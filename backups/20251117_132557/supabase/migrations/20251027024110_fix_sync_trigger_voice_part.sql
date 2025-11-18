/*
  # Fix sync_auth_user trigger for voice_part array

  1. Changes
    - Update sync_auth_user function to handle voice_part as text array
    - Convert string voice_part from user_metadata to array format
*/

CREATE OR REPLACE FUNCTION public.sync_auth_user()
RETURNS TRIGGER AS $$
BEGIN
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
    CASE 
      WHEN NEW.raw_user_meta_data->>'voice_part' IS NOT NULL 
      THEN ARRAY[NEW.raw_user_meta_data->>'voice_part']::text[]
      ELSE NULL
    END,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
