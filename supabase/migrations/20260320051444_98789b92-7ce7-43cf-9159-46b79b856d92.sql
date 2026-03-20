
-- Drop the overly permissive child UPDATE policy on chores
DROP POLICY IF EXISTS "Children can submit their own chores" ON public.chores;

-- Create a security definer function for chore submission
CREATE OR REPLACE FUNCTION public.fb_submit_chore(p_chore_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chore RECORD;
BEGIN
  -- Get chore and verify it belongs to the calling child
  SELECT c.* INTO v_chore
  FROM public.chores c
  JOIN public.children ch ON ch.id = c.child_id
  WHERE c.id = p_chore_id
    AND ch.user_id = auth.uid();

  IF v_chore IS NULL THEN
    RAISE EXCEPTION 'Chore not found or not yours';
  END IF;

  IF v_chore.status != 'PENDING' THEN
    RAISE EXCEPTION 'Only PENDING chores can be submitted';
  END IF;

  UPDATE public.chores
  SET status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW()
  WHERE id = p_chore_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.fb_submit_chore(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fb_submit_chore(uuid) TO authenticated;
