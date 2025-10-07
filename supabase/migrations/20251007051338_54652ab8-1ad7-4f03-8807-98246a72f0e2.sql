-- Add INSERT, UPDATE, DELETE policies for balances table
-- This allows parents to manage balances for their children

-- Allow parents to insert balance records for their children
CREATE POLICY "Parents can create balances for their children"
ON public.balances
FOR INSERT
TO authenticated
WITH CHECK (
  child_id IN (
    SELECT id FROM public.children WHERE parent_id = auth.uid()
  )
);

-- Allow parents to update balance records for their children
CREATE POLICY "Parents can update balances for their children"
ON public.balances
FOR UPDATE
TO authenticated
USING (
  child_id IN (
    SELECT id FROM public.children WHERE parent_id = auth.uid()
  )
);

-- Allow parents to delete balance records for their children
CREATE POLICY "Parents can delete balances for their children"
ON public.balances
FOR DELETE
TO authenticated
USING (
  child_id IN (
    SELECT id FROM public.children WHERE parent_id = auth.uid()
  )
);