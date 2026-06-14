CREATE POLICY "Children can view their own allowances"
ON public.allowances
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.id = allowances.child_id
      AND c.user_id = auth.uid()
  )
);