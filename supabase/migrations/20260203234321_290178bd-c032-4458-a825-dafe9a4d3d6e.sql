-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users only" ON public.balances;

-- For profiles: Convert existing RESTRICTIVE policies to PERMISSIVE
-- First drop the old ones
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view their children profiles" ON public.profiles;

-- Recreate as PERMISSIVE (default) with TO authenticated
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Parents can view their children profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (id IN (
  SELECT children.user_id FROM children
  WHERE children.parent_id = auth.uid() AND children.user_id IS NOT NULL
));

-- For balances: Convert existing RESTRICTIVE policies to PERMISSIVE
DROP POLICY IF EXISTS "Children can view their own balances" ON public.balances;
DROP POLICY IF EXISTS "Parents can view their children balances" ON public.balances;
DROP POLICY IF EXISTS "Parents can create balances for their children" ON public.balances;
DROP POLICY IF EXISTS "Parents can update balances for their children" ON public.balances;
DROP POLICY IF EXISTS "Parents can delete balances for their children" ON public.balances;

CREATE POLICY "Children can view their own balances"
ON public.balances FOR SELECT
TO authenticated
USING (child_id IN (
  SELECT children.id FROM children WHERE children.user_id = auth.uid()
));

CREATE POLICY "Parents can view their children balances"
ON public.balances FOR SELECT
TO authenticated
USING (child_id IN (
  SELECT children.id FROM children WHERE children.parent_id = auth.uid()
));

CREATE POLICY "Parents can create balances for their children"
ON public.balances FOR INSERT
TO authenticated
WITH CHECK (child_id IN (
  SELECT children.id FROM children WHERE children.parent_id = auth.uid()
));

CREATE POLICY "Parents can update balances for their children"
ON public.balances FOR UPDATE
TO authenticated
USING (child_id IN (
  SELECT children.id FROM children WHERE children.parent_id = auth.uid()
));

CREATE POLICY "Parents can delete balances for their children"
ON public.balances FOR DELETE
TO authenticated
USING (child_id IN (
  SELECT children.id FROM children WHERE children.parent_id = auth.uid()
));