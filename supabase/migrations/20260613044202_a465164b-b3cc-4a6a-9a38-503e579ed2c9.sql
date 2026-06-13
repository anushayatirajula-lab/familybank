
-- 1. Add tier tracking columns
ALTER TABLE public.subscription_data
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS ai_coach_usage_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_coach_usage_month text;

-- 2. Helper: returns 'premium' if user has active sub OR active trial, else 'free'
CREATE OR REPLACE FUNCTION public.get_user_tier(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_trial_ends timestamptz;
BEGIN
  SELECT subscription_status, current_period_end
    INTO v_sub
    FROM public.subscription_data
    WHERE user_id = _user_id;

  IF v_sub.subscription_status IN ('active', 'trialing')
     AND (v_sub.current_period_end IS NULL OR v_sub.current_period_end > NOW()) THEN
    RETURN 'premium';
  END IF;

  SELECT trial_ends_at INTO v_trial_ends
    FROM public.profiles
    WHERE id = _user_id;

  IF v_trial_ends IS NOT NULL AND v_trial_ends > NOW() THEN
    RETURN 'premium';
  END IF;

  RETURN 'free';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_tier(uuid) TO authenticated, service_role;

-- 3. AI coach usage increment with monthly reset
CREATE OR REPLACE FUNCTION public.fb_increment_ai_coach_usage(_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text := to_char(NOW(), 'YYYY-MM');
  v_count int;
  v_existing_month text;
BEGIN
  -- Premium users: unlimited, return -1
  IF public.get_user_tier(_user_id) = 'premium' THEN
    RETURN -1;
  END IF;

  -- Upsert row if missing
  INSERT INTO public.subscription_data (user_id, subscription_status, ai_coach_usage_count, ai_coach_usage_month)
  VALUES (_user_id, 'free', 0, v_month)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT ai_coach_usage_month INTO v_existing_month
    FROM public.subscription_data WHERE user_id = _user_id;

  IF v_existing_month IS DISTINCT FROM v_month THEN
    UPDATE public.subscription_data
      SET ai_coach_usage_count = 1,
          ai_coach_usage_month = v_month,
          updated_at = NOW()
      WHERE user_id = _user_id
      RETURNING ai_coach_usage_count INTO v_count;
  ELSE
    UPDATE public.subscription_data
      SET ai_coach_usage_count = ai_coach_usage_count + 1,
          updated_at = NOW()
      WHERE user_id = _user_id
      RETURNING ai_coach_usage_count INTO v_count;
  END IF;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fb_increment_ai_coach_usage(uuid) TO service_role;

-- 4. Trigger: block adding >1 child on free tier
CREATE OR REPLACE FUNCTION public.enforce_free_tier_child_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF public.get_user_tier(NEW.parent_id) = 'free' THEN
    SELECT COUNT(*) INTO v_count FROM public.children WHERE parent_id = NEW.parent_id;
    IF v_count >= 1 THEN
      RAISE EXCEPTION 'Free tier is limited to 1 child. Upgrade to Premium for up to 5 children.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_tier_child_limit_trigger ON public.children;
CREATE TRIGGER enforce_free_tier_child_limit_trigger
  BEFORE INSERT ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_tier_child_limit();

-- 5. Trigger: block adding >3 active wishlist items on free tier
CREATE OR REPLACE FUNCTION public.enforce_free_tier_wishlist_limit()
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
      FROM public.wishlist_items
      WHERE child_id = NEW.child_id
        AND COALESCE(is_purchased, false) = false;
    IF v_count >= 3 THEN
      RAISE EXCEPTION 'Free tier is limited to 3 active wishlist items. Upgrade to Premium for unlimited items.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_tier_wishlist_limit_trigger ON public.wishlist_items;
CREATE TRIGGER enforce_free_tier_wishlist_limit_trigger
  BEFORE INSERT ON public.wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_tier_wishlist_limit();
