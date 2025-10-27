/*
  # Create Admin User with Auto-Confirmation

  1. Purpose
    - Create a function that auto-confirms admin users on signup
    - Update trigger to confirm email for sntumba@outlook.com
  
  2. Details
    - Modifies the handle_new_user function to auto-confirm specific emails
*/

-- Update the function to auto-confirm admin emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirm email for admin user
  IF NEW.email = 'sntumba@outlook.com' THEN
    UPDATE auth.users 
    SET email_confirmed_at = NOW(),
        confirmed_at = NOW()
    WHERE id = NEW.id;
  END IF;

  -- Insert into public.users table
  INSERT INTO public.users (id, email, name, role, voice_part)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    NEW.raw_user_meta_data->>'voice_part'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    role = COALESCE(EXCLUDED.role, public.users.role),
    voice_part = EXCLUDED.voice_part;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
