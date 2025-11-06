-- Function to automatically assign CHILD role when a child is created
CREATE OR REPLACE FUNCTION public.assign_child_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert CHILD role for the new child's user_id
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'CHILD'::user_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to assign CHILD role when a child record is created
DROP TRIGGER IF EXISTS assign_child_role_trigger ON public.children;
CREATE TRIGGER assign_child_role_trigger
  AFTER INSERT ON public.children
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION public.assign_child_role();

-- Backfill existing children with CHILD roles
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'CHILD'::user_role
FROM public.children
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;