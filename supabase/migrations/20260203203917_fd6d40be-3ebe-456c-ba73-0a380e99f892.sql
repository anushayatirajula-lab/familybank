-- Drop existing SELECT policies on balances table
DROP POLICY IF EXISTS "Children can view their own balances" ON public.balances;
DROP POLICY IF EXISTS "View balances" ON public.balances;

-- Recreate SELECT policies with explicit authenticated role restriction
CREATE POLICY "Children can view their own balances"
ON public.balances
FOR SELECT
TO authenticated
USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Parents can view their children balances"
ON public.balances
FOR SELECT
TO authenticated
USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));