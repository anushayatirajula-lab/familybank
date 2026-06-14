-- Explicit deny-all SELECT policy on subscription_data for defense in depth.
-- subscription_data is accessed exclusively by edge functions via the service role
-- (which bypasses RLS). Clients must never read this table directly; they call the
-- check-subscription edge function instead. This explicit policy ensures that even if
-- a future permissive policy is added, no authenticated or anon user can read billing data.

DROP POLICY IF EXISTS "Deny all client reads on subscription_data" ON public.subscription_data;

CREATE POLICY "Deny all client reads on subscription_data"
  ON public.subscription_data
  FOR SELECT
  TO authenticated, anon
  USING (false);

-- Also revoke any lingering table-level grants from anon (service_role retains ALL).
REVOKE ALL ON public.subscription_data FROM anon;
REVOKE ALL ON public.subscription_data FROM authenticated;
GRANT ALL ON public.subscription_data TO service_role;