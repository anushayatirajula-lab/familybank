
-- Ensure user_id in children table is unique to prevent cross-account access
-- A single auth user should only ever be linked to one child profile
ALTER TABLE public.children 
  ADD CONSTRAINT children_user_id_unique UNIQUE (user_id);

-- Also add a partial index to ensure non-null user_ids are always unique
-- (the UNIQUE constraint above already handles this, but this makes it explicit)
CREATE INDEX IF NOT EXISTS idx_children_user_id ON public.children (user_id) WHERE user_id IS NOT NULL;
