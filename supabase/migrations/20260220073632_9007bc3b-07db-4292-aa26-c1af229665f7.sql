
-- Remove email column from profiles table
-- Email is already stored securely in auth.users; keeping it in profiles is redundant and creates unnecessary exposure risk

-- Update the handle_new_user trigger function to not insert email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert into profiles (without email - stored securely in auth.users)
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );

  -- Insert role into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'CHILD' THEN 'CHILD'::user_role
      ELSE 'PARENT'::user_role
    END
  );

  RETURN NEW;
END;
$$;

-- Drop the email column from profiles
-- First set a default so existing rows aren't affected during the drop
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
