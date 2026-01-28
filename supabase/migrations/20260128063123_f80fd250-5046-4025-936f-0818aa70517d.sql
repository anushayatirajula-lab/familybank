-- Fix profiles table to explicitly block anonymous access
-- Recreate SELECT policies with TO authenticated

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Parents can view their children profiles" ON public.profiles;

-- Users can only view their own profile (authenticated only)
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Parents can view profiles of their children (authenticated only)
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

-- Also ensure UPDATE and INSERT are authenticated only
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);