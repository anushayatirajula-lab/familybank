
-- Fully lock down profiles_public view from anon/public access
-- Revoke ALL privileges from anon and public, only allow authenticated users to SELECT

-- Revoke all existing grants from anon and public
REVOKE ALL ON public.profiles_public FROM anon;
REVOKE ALL ON public.profiles_public FROM PUBLIC;

-- Ensure only authenticated role has SELECT access
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO service_role;
