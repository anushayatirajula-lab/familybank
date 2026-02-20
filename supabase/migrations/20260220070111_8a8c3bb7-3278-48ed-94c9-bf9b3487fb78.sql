-- Drop the deprecated PIN-based authenticate_child function
-- Children now authenticate via proper Supabase auth (signInWithPassword)
REVOKE EXECUTE ON FUNCTION public.authenticate_child(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.authenticate_child(TEXT, TEXT) FROM authenticated;
DROP FUNCTION IF EXISTS public.authenticate_child(TEXT, TEXT);