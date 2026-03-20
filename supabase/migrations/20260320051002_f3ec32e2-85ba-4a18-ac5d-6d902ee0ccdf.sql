
-- Drop the overly permissive child UPDATE policy
DROP POLICY IF EXISTS "Children can update their own first_login flag" ON public.children;

-- Create a security definer function that only allows updating first_login
CREATE OR REPLACE FUNCTION public.child_set_first_login_done(p_child_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.children
  SET first_login = false, updated_at = now()
  WHERE id = p_child_id
    AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Grant execute to authenticated only
REVOKE ALL ON FUNCTION public.child_set_first_login_done(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.child_set_first_login_done(uuid) TO authenticated;
