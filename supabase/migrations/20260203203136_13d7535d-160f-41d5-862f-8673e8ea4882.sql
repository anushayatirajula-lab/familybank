-- Add SELECT policy for children to view their own transaction history
CREATE POLICY "Children can view their own transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (child_id IN (
  SELECT children.id
  FROM children
  WHERE children.user_id = auth.uid()
));