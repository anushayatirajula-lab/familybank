-- Fix the trigger to NOT generate family codes for child accounts
-- Only parents should get family codes; children inherit from their parent
CREATE OR REPLACE FUNCTION public.auto_generate_family_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only generate family code for parent accounts
  -- Check if this user has a CHILD role (they won't at INSERT time, but we skip anyway)
  -- The handle_new_user trigger sets role based on metadata
  -- If metadata indicates CHILD role, don't generate a family code
  IF NEW.family_code IS NULL THEN
    -- Check if the user metadata indicates this is a child account
    -- Child accounts are created with role = 'CHILD' in metadata
    DECLARE
      v_is_child BOOLEAN := FALSE;
      v_user_meta JSONB;
    BEGIN
      -- Get user metadata from auth.users
      SELECT raw_user_meta_data INTO v_user_meta
      FROM auth.users
      WHERE id = NEW.id;
      
      -- Check if role is CHILD
      IF v_user_meta->>'role' = 'CHILD' THEN
        v_is_child := TRUE;
      END IF;
      
      -- Only generate family code for non-child accounts
      IF NOT v_is_child THEN
        NEW.family_code := public.generate_family_code();
      END IF;
    END;
  END IF;
  RETURN NEW;
END;
$function$;