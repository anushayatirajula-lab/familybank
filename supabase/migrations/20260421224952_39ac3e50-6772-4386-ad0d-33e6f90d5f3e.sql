CREATE OR REPLACE FUNCTION public.fb_spend_wishlist(p_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
  v_child_parent_id UUID;
  v_balance NUMERIC;
BEGIN
  -- Get wishlist item
  SELECT * INTO v_item FROM public.wishlist_items WHERE id = p_item_id;
  IF v_item IS NULL THEN
    RAISE EXCEPTION 'Wishlist item not found';
  END IF;

  IF v_item.is_purchased THEN
    RAISE EXCEPTION 'Item already purchased';
  END IF;

  -- Verify caller is the parent
  SELECT parent_id INTO v_child_parent_id FROM public.children WHERE id = v_item.child_id;
  IF v_child_parent_id IS NULL OR v_child_parent_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Only the parent can approve this purchase';
  END IF;

  -- Lock the WISHLIST balance row to prevent race conditions
  SELECT amount INTO v_balance
  FROM public.balances
  WHERE child_id = v_item.child_id AND jar_type = 'WISHLIST'
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_item.target_amount THEN
    RAISE EXCEPTION 'Insufficient balance in WISHLIST jar';
  END IF;

  -- Deduct
  UPDATE public.balances
  SET amount = amount - v_item.target_amount, updated_at = NOW()
  WHERE child_id = v_item.child_id AND jar_type = 'WISHLIST';

  -- Record transaction (negative amount = spend)
  INSERT INTO public.transactions (child_id, jar_type, amount, transaction_type, reference_id, description)
  VALUES (v_item.child_id, 'WISHLIST', -v_item.target_amount, 'WISHLIST_SPEND', p_item_id,
          'Purchased: ' || v_item.title);

  -- Mark item purchased
  UPDATE public.wishlist_items
  SET approved_by_parent = true, is_purchased = true, updated_at = NOW()
  WHERE id = p_item_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.fb_spend_wishlist(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fb_spend_wishlist(uuid) TO authenticated;