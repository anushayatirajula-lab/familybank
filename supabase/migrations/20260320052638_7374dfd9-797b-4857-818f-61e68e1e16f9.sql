
-- Drop the overly permissive child UPDATE policy on wishlist_items
DROP POLICY IF EXISTS "Children can update their own wishlist items before approval" ON public.wishlist_items;

-- Create a SECURITY DEFINER function for child wishlist item updates
CREATE OR REPLACE FUNCTION public.fb_update_wishlist_item(
  p_item_id uuid,
  p_title text,
  p_description text,
  p_target_amount numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Verify item belongs to calling child and is not yet approved
  SELECT wi.* INTO v_item
  FROM public.wishlist_items wi
  JOIN public.children ch ON ch.id = wi.child_id
  WHERE wi.id = p_item_id
    AND ch.user_id = auth.uid()
    AND wi.approved_by_parent = false;

  IF v_item IS NULL THEN
    RAISE EXCEPTION 'Item not found, not yours, or already approved';
  END IF;

  -- Validate target_amount
  IF p_target_amount IS NULL OR p_target_amount <= 0 THEN
    RAISE EXCEPTION 'Target amount must be positive';
  END IF;

  -- Only update display fields and target_amount (not current_amount, approved_by_parent, etc.)
  UPDATE public.wishlist_items
  SET title = p_title,
      description = p_description,
      target_amount = p_target_amount,
      updated_at = NOW()
  WHERE id = p_item_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.fb_update_wishlist_item(uuid, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fb_update_wishlist_item(uuid, text, text, numeric) TO authenticated;
