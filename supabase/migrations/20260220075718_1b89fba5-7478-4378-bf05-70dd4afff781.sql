
-- Revoke anon role access to profiles_public view
-- The child login flow does NOT query this view - it constructs the auth email directly.
-- Only authenticated (logged-in) users need access to profiles_public.
REVOKE SELECT ON public.profiles_public FROM anon;

-- Ensure authenticated role still has access
GRANT SELECT ON public.profiles_public TO authenticated;
