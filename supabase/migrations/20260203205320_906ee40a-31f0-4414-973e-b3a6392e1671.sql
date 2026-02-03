-- Defense-in-depth: revoke anonymous access to sensitive tables (RLS already protects these)
-- This ensures unauthenticated clients cannot even attempt direct table reads.

REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.balances FROM anon;
REVOKE ALL ON TABLE public.wishlist_items FROM anon;

-- Ensure authenticated users still have access (relies on RLS for row filtering)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.balances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wishlist_items TO authenticated;