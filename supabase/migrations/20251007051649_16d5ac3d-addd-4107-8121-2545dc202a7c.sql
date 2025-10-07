-- Create a secure function for child authentication
-- This allows children to verify their credentials without requiring authentication
-- The function runs with SECURITY DEFINER to bypass RLS while keeping data secure

CREATE OR REPLACE FUNCTION public.authenticate_child(
  p_name TEXT,
  p_pin TEXT
)
RETURNS TABLE (
  child_id UUID,
  child_name TEXT,
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child RECORD;
BEGIN
  -- Find child by name
  SELECT id, name, pin INTO v_child
  FROM public.children
  WHERE name = p_name
  LIMIT 1;
  
  -- Child not found
  IF v_child.id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      NULL::TEXT,
      FALSE,
      'Child not found. Check your name.'::TEXT;
    RETURN;
  END IF;
  
  -- Check if PIN is required and matches
  IF v_child.pin IS NOT NULL AND v_child.pin != '' THEN
    IF p_pin IS NULL OR p_pin = '' OR v_child.pin != p_pin THEN
      RETURN QUERY SELECT 
        NULL::UUID,
        NULL::TEXT,
        FALSE,
        'Incorrect PIN. Please try again.'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Authentication successful
  RETURN QUERY SELECT 
    v_child.id,
    v_child.name,
    TRUE,
    'Welcome!'::TEXT;
END;
$$;

-- Grant execute permission to anonymous users for child login
GRANT EXECUTE ON FUNCTION public.authenticate_child(TEXT, TEXT) TO anon;