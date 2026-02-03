-- Drop existing SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view their children profiles" ON public.profiles;

-- Recreate SELECT policies with explicit authenticated role restriction
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Parents can view their children profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (id IN (
  SELECT children.user_id
  FROM children
  WHERE children.parent_id = auth.uid()
    AND children.user_id IS NOT NULL
));