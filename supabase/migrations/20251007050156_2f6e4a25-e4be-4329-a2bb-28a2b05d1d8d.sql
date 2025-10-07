-- Fix infinite recursion in children table RLS policies
-- The current "Parents can view their children" policy has a recursive query

-- Drop the problematic policy
DROP POLICY IF EXISTS "Parents can view their children" ON public.children;

-- Recreate with simplified non-recursive logic
CREATE POLICY "Parents can view their children" 
ON public.children 
FOR SELECT 
USING (parent_id = auth.uid());