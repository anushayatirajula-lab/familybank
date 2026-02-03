-- Ensure RLS is enabled on children table
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policies and recreate with explicit authenticated role
DROP POLICY IF EXISTS "Parents can view their children" ON public.children;
DROP POLICY IF EXISTS "Children can view their own profile" ON public.children;

-- Recreate SELECT policies with explicit TO authenticated clause
CREATE POLICY "Parents can view their children" 
ON public.children 
FOR SELECT 
TO authenticated
USING (parent_id = auth.uid());

CREATE POLICY "Children can view their own profile" 
ON public.children 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());