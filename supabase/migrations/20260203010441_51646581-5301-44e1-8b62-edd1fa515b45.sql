-- First, let's ensure the existing SELECT policies are permissive (they were created as restrictive)
-- Drop the existing SELECT policies and recreate them as permissive

DROP POLICY IF EXISTS "Children can view their own wishlist items" ON public.wishlist_items;

-- Create a permissive SELECT policy for children viewing their own items
CREATE POLICY "Children can view their own wishlist items"
ON public.wishlist_items
FOR SELECT
TO authenticated
USING (
  child_id IN (
    SELECT children.id
    FROM children
    WHERE children.user_id = auth.uid()
  )
);

-- The "Manage wishlist" ALL policy covers parents, but let's make an explicit SELECT for clarity
-- and ensure it's permissive
DROP POLICY IF EXISTS "Manage wishlist" ON public.wishlist_items;

-- Recreate parent policies as permissive
CREATE POLICY "Parents can view their children wishlist items"
ON public.wishlist_items
FOR SELECT
TO authenticated
USING (
  child_id IN (
    SELECT children.id
    FROM children
    WHERE children.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents can insert wishlist items"
ON public.wishlist_items
FOR INSERT
TO authenticated
WITH CHECK (
  child_id IN (
    SELECT children.id
    FROM children
    WHERE children.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents can update wishlist items"
ON public.wishlist_items
FOR UPDATE
TO authenticated
USING (
  child_id IN (
    SELECT children.id
    FROM children
    WHERE children.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents can delete wishlist items"
ON public.wishlist_items
FOR DELETE
TO authenticated
USING (
  child_id IN (
    SELECT children.id
    FROM children
    WHERE children.parent_id = auth.uid()
  )
);