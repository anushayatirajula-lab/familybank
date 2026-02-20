
-- Update handle_new_user trigger to leave full_name blank by default
-- Instead of defaulting to the email prefix, we leave it NULL until the parent sets it
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert into profiles with full_name from metadata only (blank if not provided)
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name'
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
