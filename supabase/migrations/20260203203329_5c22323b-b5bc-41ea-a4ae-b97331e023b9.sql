-- Drop existing policies on jars table
DROP POLICY IF EXISTS "Parents and children can view jars" ON public.jars;
DROP POLICY IF EXISTS "Parents can manage jars" ON public.jars;

-- Create new SELECT policy for parents (restricted to authenticated role)
CREATE POLICY "Parents can view their children jars"
ON public.jars
FOR SELECT
TO authenticated
USING (child_id IN (
  SELECT children.id
  FROM children
  WHERE children.parent_id = auth.uid()
));

-- Create SELECT policy for children to view their own jars
CREATE POLICY "Children can view their own jars"
ON public.jars
FOR SELECT
TO authenticated
USING (child_id IN (
  SELECT children.id
  FROM children
  WHERE children.user_id = auth.uid()
));

-- Create ALL policy for parents to manage jars (restricted to authenticated role)
CREATE POLICY "Parents can manage jars"
ON public.jars
FOR ALL
TO authenticated
USING (child_id IN (
  SELECT children.id
  FROM children
  WHERE children.parent_id = auth.uid()
))
WITH CHECK (child_id IN (
  SELECT children.id
  FROM children
  WHERE children.parent_id = auth.uid()
));