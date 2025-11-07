-- Add RLS policies for children to manage their own wishlist items
CREATE POLICY "Children can view their own wishlist items"
ON public.wishlist_items
FOR SELECT
TO authenticated
USING (
  child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Children can create their own wishlist items"
ON public.wishlist_items
FOR INSERT
TO authenticated
WITH CHECK (
  child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Children can update their own wishlist items before approval"
ON public.wishlist_items
FOR UPDATE
TO authenticated
USING (
  child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  )
  AND approved_by_parent = false
)
WITH CHECK (
  child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  )
  AND approved_by_parent = false
);

CREATE POLICY "Children can delete their own wishlist items before approval"
ON public.wishlist_items
FOR DELETE
TO authenticated
USING (
  child_id IN (
    SELECT id FROM public.children WHERE user_id = auth.uid()
  )
  AND approved_by_parent = false
);