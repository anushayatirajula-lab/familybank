CREATE OR REPLACE FUNCTION public.fb_process_due_allowance(p_allowance_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_allowance RECORD;
  v_jar RECORD;
  v_jar_amount numeric;
  v_parent_tier text;
  v_next_payment timestamptz;
BEGIN
  SELECT a.id, a.child_id, a.weekly_amount, a.next_payment_at, a.is_active, c.parent_id
    INTO v_allowance
  FROM public.allowances a
  JOIN public.children c ON c.id = a.child_id
  WHERE a.id = p_allowance_id;

  IF v_allowance IS NULL THEN
    RAISE EXCEPTION 'Allowance not found';
  END IF;

  IF v_allowance.is_active IS NOT TRUE OR v_allowance.next_payment_at > NOW() THEN
    RETURN false;
  END IF;

  v_parent_tier := public.get_user_tier(v_allowance.parent_id);
  IF v_parent_tier <> 'premium' THEN
    RETURN false;
  END IF;

  FOR v_jar IN
    SELECT jar_type, percentage
    FROM public.jars
    WHERE child_id = v_allowance.child_id
  LOOP
    v_jar_amount := ROUND((v_allowance.weekly_amount * v_jar.percentage / 100.0)::numeric, 2);

    INSERT INTO public.balances (child_id, jar_type, amount)
    VALUES (v_allowance.child_id, v_jar.jar_type, v_jar_amount)
    ON CONFLICT (child_id, jar_type)
    DO UPDATE SET
      amount = balances.amount + EXCLUDED.amount,
      updated_at = NOW();

    INSERT INTO public.transactions (child_id, jar_type, amount, transaction_type, reference_id, description)
    VALUES (
      v_allowance.child_id,
      v_jar.jar_type,
      v_jar_amount,
      'ALLOWANCE'::transaction_type,
      v_allowance.id,
      'Split: ' || v_jar.percentage || '% to ' || v_jar.jar_type
    );
  END LOOP;

  v_next_payment := v_allowance.next_payment_at + INTERVAL '7 days';
  WHILE v_next_payment <= NOW() LOOP
    v_next_payment := v_next_payment + INTERVAL '7 days';
  END LOOP;

  UPDATE public.allowances
  SET next_payment_at = v_next_payment,
      updated_at = NOW()
  WHERE id = v_allowance.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fb_process_due_allowance(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fb_process_due_allowance(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fb_process_due_allowance(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fb_process_due_allowance(uuid) TO service_role;