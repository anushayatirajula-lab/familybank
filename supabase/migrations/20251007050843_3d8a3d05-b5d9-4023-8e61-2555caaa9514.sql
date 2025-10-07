-- Revoke all public access from profiles and children tables
-- This prevents anonymous users from scraping user emails and children's personal information

-- Revoke all privileges from anon and public roles on profiles table
REVOKE ALL ON public.profiles FROM anon, public;

-- Revoke all privileges from anon and public roles on children table
REVOKE ALL ON public.children FROM anon, public;

-- Grant privileges only to authenticated users for profiles table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Grant privileges only to authenticated users for children table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.children TO authenticated;

-- Ensure RLS is enabled and forced on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Ensure RLS is enabled and forced on children table
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children FORCE ROW LEVEL SECURITY;