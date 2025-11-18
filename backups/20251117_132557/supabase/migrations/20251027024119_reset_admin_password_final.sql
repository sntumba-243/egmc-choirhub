/*
  # Reset Admin Password

  1. Purpose
    - Reset password for sntumba@outlook.com admin account
    - Set password to: ChoirAdmin2024

  2. Security
    - This is a one-time migration for initial setup
    - Password should be changed after first login
*/

DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'sntumba@outlook.com';
  
  IF admin_user_id IS NOT NULL THEN
    UPDATE auth.users 
    SET 
      encrypted_password = crypt('ChoirAdmin2024', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE id = admin_user_id;
    
    RAISE NOTICE 'Password reset successful for sntumba@outlook.com';
  END IF;
END $$;
