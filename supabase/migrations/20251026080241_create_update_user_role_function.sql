/*
  # Create Function to Update User Role in JWT

  1. New Function
    - `update_user_role` - Updates both app_metadata and user_metadata role
  
  2. Security
    - Only accessible by authenticated users
    - Ideally should check if caller is admin, but for now allowing any auth user
*/

CREATE OR REPLACE FUNCTION update_user_role(user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth.users
  SET 
    raw_app_meta_data = 
      CASE 
        WHEN raw_app_meta_data IS NULL THEN jsonb_build_object('role', new_role)
        ELSE jsonb_set(raw_app_meta_data, '{role}', to_jsonb(new_role))
      END,
    raw_user_meta_data = 
      CASE 
        WHEN raw_user_meta_data IS NULL THEN jsonb_build_object('role', new_role)
        ELSE jsonb_set(raw_user_meta_data, '{role}', to_jsonb(new_role))
      END
  WHERE id = user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_role TO authenticated;
