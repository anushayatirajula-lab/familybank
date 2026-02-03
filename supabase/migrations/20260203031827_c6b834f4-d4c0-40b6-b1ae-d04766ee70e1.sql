-- Update fb_approve_chore with authorization check
CREATE OR REPLACE FUNCTION public.fb_approve_chore(p_chore uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_chore RECORD;
  v_child_parent_id UUID;
  v_success BOOLEAN;
BEGIN
  -- Get chore details
  SELECT * INTO v_chore FROM public.chores WHERE id = p_chore;
  
  IF v_chore IS NULL THEN
    RAISE EXCEPTION 'Chore not found';
  END IF;
  
  IF v_chore.status != 'SUBMITTED' THEN
    RAISE EXCEPTION 'Chore must be in SUBMITTED status';
  END IF;
  
  -- Get the parent_id for this chore's child
  SELECT parent_id INTO v_child_parent_id 
  FROM public.children 
  WHERE id = v_chore.child_id;
  
  -- Verify caller is the parent
  IF v_child_parent_id IS NULL OR v_child_parent_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Only the parent can approve this chore';
  END IF;
  
  -- Update chore status
  UPDATE public.chores 
  SET status = 'APPROVED', approved_at = NOW(), updated_at = NOW()
  WHERE id = p_chore;
  
  -- Split tokens into jars (internal call, already authorized)
  SELECT public.fb_split_into_jars(
    v_chore.child_id,
    v_chore.token_reward,
    'CHORE_REWARD'::transaction_type,
    p_chore
  ) INTO v_success;
  
  RETURN v_success;
END;
$function$;

-- Update fb_split_into_jars with authorization check
CREATE OR REPLACE FUNCTION public.fb_split_into_jars(p_child uuid, p_amount numeric, p_type transaction_type, p_reference_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_jar RECORD;
  v_jar_amount DECIMAL;
  v_child_parent_id UUID;
BEGIN
  -- Get the parent_id for this child
  SELECT parent_id INTO v_child_parent_id 
  FROM public.children 
  WHERE id = p_child;
  
  -- Verify child exists
  IF v_child_parent_id IS NULL THEN
    RAISE EXCEPTION 'Child not found';
  END IF;
  
  -- Verify caller is the parent
  IF v_child_parent_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Only the parent can manage this child';
  END IF;

  -- Loop through each jar for this child
  FOR v_jar IN 
    SELECT jar_type, percentage 
    FROM public.jars 
    WHERE child_id = p_child
  LOOP
    -- Calculate amount for this jar
    v_jar_amount := (p_amount * v_jar.percentage / 100.0)::DECIMAL(10,2);
    
    -- Update balance
    INSERT INTO public.balances (child_id, jar_type, amount)
    VALUES (p_child, v_jar.jar_type, v_jar_amount)
    ON CONFLICT (child_id, jar_type) 
    DO UPDATE SET 
      amount = balances.amount + v_jar_amount,
      updated_at = NOW();
    
    -- Record transaction
    INSERT INTO public.transactions (child_id, jar_type, amount, transaction_type, reference_id, description)
    VALUES (p_child, v_jar.jar_type, v_jar_amount, p_type, p_reference_id, 
            'Split: ' || v_jar.percentage || '% to ' || v_jar.jar_type);
  END LOOP;
  
  RETURN TRUE;
END;
$function$;