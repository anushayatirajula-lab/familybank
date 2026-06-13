-- Specific error messages for Free tier limits
CREATE OR REPLACE FUNCTION public.enforce_free_tier_child_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
BEGIN
  IF public.get_user_tier(NEW.parent_id) = 'free' THEN
    SELECT COUNT(*) INTO v_count FROM public.children WHERE parent_id = NEW.parent_id;
    IF v_count >= 1 THEN
      RAISE EXCEPTION 'Upgrade to add more than 1 child'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_free_tier_chore_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      RAISE EXCEPTION 'Upgrade to add more than 5 active chores'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_free_tier_wishlist_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_parent_id uuid;
  v_count int;
BEGIN
  SELECT parent_id INTO v_parent_id FROM public.children WHERE id = NEW.child_id;
  IF v_parent_id IS NULL THEN RETURN NEW; END IF;

  IF public.get_user_tier(v_parent_id) = 'free' THEN
    SELECT COUNT(*) INTO v_count
      FROM public.wishlist_items
      WHERE child_id = NEW.child_id
        AND COALESCE(is_purchased, false) = false;
    IF v_count >= 3 THEN
      RAISE EXCEPTION 'Upgrade to add more than 3 wishlist items'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;