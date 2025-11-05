-- Allow children to update their own first_login flag
CREATE POLICY "Children can update their own first_login flag"
ON public.children
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);