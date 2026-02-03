-- Fix profiles table: Add PERMISSIVE base policy requiring authentication
CREATE POLICY "Authenticated users only"
ON public.profiles
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Fix balances table: Add PERMISSIVE base policy requiring authentication  
CREATE POLICY "Authenticated users only"
ON public.balances
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Explicitly revoke all access from anon role to prevent bypass
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.balances FROM anon;