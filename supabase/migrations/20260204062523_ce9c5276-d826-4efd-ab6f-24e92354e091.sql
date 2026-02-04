-- Fix the profiles_public view to use security_definer instead of security_invoker
-- This allows the view to access the base table with elevated privileges
-- while still only exposing safe columns

DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_barrier = true) AS
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
GRANT SELECT ON public.profiles_public TO anon;