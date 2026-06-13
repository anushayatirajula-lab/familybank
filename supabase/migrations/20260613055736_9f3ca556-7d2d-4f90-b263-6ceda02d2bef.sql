CREATE OR REPLACE FUNCTION public.enforce_free_tier_chore_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_count int;
BEGIN
  SELECT parent_id INTO v_parent_id FROM public.children WHERE id = NEW.child_id;
  IF v_parent_id IS NULL THEN RETURN NEW; END IF;

  IF public.get_user_tier(v_parent_id) = 'free' THEN
    SELECT COUNT(*) INTO v_count
      FROM public.chores
      WHERE child_id = NEW.child_id
        AND status IN ('PENDING','SUBMITTED');
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'Free tier is limited to 5 active chores per child. Upgrade to Premium for unlimited chores.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_free_tier_chore_limit ON public.chores;
CREATE TRIGGER trg_enforce_free_tier_chore_limit
BEFORE INSERT ON public.chores
FOR EACH ROW EXECUTE FUNCTION public.enforce_free_tier_chore_limit();