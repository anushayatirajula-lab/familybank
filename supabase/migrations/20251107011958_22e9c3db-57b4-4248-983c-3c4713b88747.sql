-- Allow parents to view their children's profiles
CREATE POLICY "Parents can view their children profiles"
ON public.profiles
FOR SELECT
USING (
  id IN (
    SELECT user_id 
    FROM public.children 
    WHERE parent_id = auth.uid() 
    AND user_id IS NOT NULL
  )
);