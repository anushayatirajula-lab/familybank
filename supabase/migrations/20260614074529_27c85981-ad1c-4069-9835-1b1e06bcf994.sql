-- Restrict Realtime channel subscriptions by topic to the owning family.
-- Topics used by the app:
--   parent:{auth.uid()}       -> parent dashboard
--   child:{children.id}       -> child dashboard + parent-child detail view
-- Combined with the existing RLS on public.balances/chores/transactions,
-- this ensures postgres_changes events never leak across families.

CREATE POLICY "Family-scoped realtime SELECT"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('parent:' || auth.uid()::text)
  OR EXISTS (
    SELECT 1 FROM public.children c
    WHERE realtime.topic() = ('child:' || c.id::text)
      AND (c.user_id = auth.uid() OR c.parent_id = auth.uid())
  )
);

CREATE POLICY "Family-scoped realtime INSERT"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = ('parent:' || auth.uid()::text)
  OR EXISTS (
    SELECT 1 FROM public.children c
    WHERE realtime.topic() = ('child:' || c.id::text)
      AND (c.user_id = auth.uid() OR c.parent_id = auth.uid())
  )
);
