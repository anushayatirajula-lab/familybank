-- Recreate the view with security_invoker = on (to satisfy linter)
-- But also update the base table RLS to allow reading only own profile

DROP VIEW IF EXISTS public.profiles_public;

-- First, fix the RLS policy on profiles to allow users to read their own profile
-- (they still can't see email since we use the view)
DROP POLICY IF EXISTS "Block direct profile reads - use profiles_public view" ON public.profiles;

-- Allow users to read their own profile row only
CREATE POLICY "Users can read own profile only"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Recreate view with security_invoker (runs as calling user)
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT 
    id,
    full_name,
    family_code,
    trial_ends_at,
    created_at,
    updated_at
  FROM public.profiles;

-- Grant SELECT to authenticated users  
GRANT SELECT ON public.profiles_public TO authenticated;