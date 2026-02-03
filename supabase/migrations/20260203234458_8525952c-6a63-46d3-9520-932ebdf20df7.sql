-- Revoke all access from anon role across all sensitive tables
REVOKE ALL ON public.children FROM anon;
REVOKE ALL ON public.push_subscriptions FROM anon;
REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.allowances FROM anon;
REVOKE ALL ON public.chores FROM anon;
REVOKE ALL ON public.jars FROM anon;
REVOKE ALL ON public.wishlist_items FROM anon;
REVOKE ALL ON public.user_roles FROM anon;

-- CHILDREN TABLE: Convert RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Children can view their own profile" ON public.children;
DROP POLICY IF EXISTS "Children can update their own first_login flag" ON public.children;
DROP POLICY IF EXISTS "Parents can view their children" ON public.children;
DROP POLICY IF EXISTS "Parents can create children" ON public.children;
DROP POLICY IF EXISTS "Parents can update their children" ON public.children;
DROP POLICY IF EXISTS "Parents can delete their children" ON public.children;

CREATE POLICY "Children can view their own profile"
ON public.children FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Children can update their own first_login flag"
ON public.children FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Parents can view their children"
ON public.children FOR SELECT TO authenticated
USING (parent_id = auth.uid());

CREATE POLICY "Parents can create children"
ON public.children FOR INSERT TO authenticated
WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can update their children"
ON public.children FOR UPDATE TO authenticated
USING (parent_id = auth.uid());

CREATE POLICY "Parents can delete their children"
ON public.children FOR DELETE TO authenticated
USING (parent_id = auth.uid());

-- PUSH_SUBSCRIPTIONS TABLE
DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can view own push subscriptions"
ON public.push_subscriptions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions"
ON public.push_subscriptions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions"
ON public.push_subscriptions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- NOTIFICATIONS TABLE
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Block direct notification inserts" ON public.notifications;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Block direct notification inserts"
ON public.notifications AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (false);

-- TRANSACTIONS TABLE
DROP POLICY IF EXISTS "Children can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "View transactions" ON public.transactions;
DROP POLICY IF EXISTS "Deny direct transaction inserts" ON public.transactions;
DROP POLICY IF EXISTS "Deny transaction updates" ON public.transactions;
DROP POLICY IF EXISTS "Deny transaction deletions" ON public.transactions;

CREATE POLICY "Children can view their own transactions"
ON public.transactions FOR SELECT TO authenticated
USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Parents can view their children transactions"
ON public.transactions FOR SELECT TO authenticated
USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Deny direct transaction inserts"
ON public.transactions AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny transaction updates"
ON public.transactions AS RESTRICTIVE FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "Deny transaction deletions"
ON public.transactions AS RESTRICTIVE FOR DELETE TO authenticated
USING (false);

-- ALLOWANCES TABLE
DROP POLICY IF EXISTS "Parents manage allowances" ON public.allowances;

CREATE POLICY "Parents manage allowances"
ON public.allowances FOR ALL TO authenticated
USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()))
WITH CHECK (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

-- CHORES TABLE
DROP POLICY IF EXISTS "Children can view their own chores" ON public.chores;
DROP POLICY IF EXISTS "Children can submit their own chores" ON public.chores;
DROP POLICY IF EXISTS "Children can view their chores" ON public.chores;
DROP POLICY IF EXISTS "Children can update chore status" ON public.chores;
DROP POLICY IF EXISTS "Parents can manage chores" ON public.chores;

CREATE POLICY "Children can view their own chores"
ON public.chores FOR SELECT TO authenticated
USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Children can submit their own chores"
ON public.chores FOR UPDATE TO authenticated
USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()))
WITH CHECK (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Parents can manage chores"
ON public.chores FOR ALL TO authenticated
USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()))
WITH CHECK (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

-- JARS TABLE
DROP POLICY IF EXISTS "Children can view their own jars" ON public.jars;
DROP POLICY IF EXISTS "Parents can view their children jars" ON public.jars;
DROP POLICY IF EXISTS "Parents can manage jars" ON public.jars;

CREATE POLICY "Children can view their own jars"
ON public.jars FOR SELECT TO authenticated
USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Parents can manage jars"
ON public.jars FOR ALL TO authenticated
USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()))
WITH CHECK (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

-- WISHLIST_ITEMS TABLE
DROP POLICY IF EXISTS "Children can view their own wishlist items" ON public.wishlist_items;
DROP POLICY IF EXISTS "Children can create their own wishlist items" ON public.wishlist_items;
DROP POLICY IF EXISTS "Children can update their own wishlist items before approval" ON public.wishlist_items;
DROP POLICY IF EXISTS "Children can delete their own wishlist items before approval" ON public.wishlist_items;
DROP POLICY IF EXISTS "Parents can view their children wishlist items" ON public.wishlist_items;
DROP POLICY IF EXISTS "Parents can insert wishlist items" ON public.wishlist_items;
DROP POLICY IF EXISTS "Parents can update wishlist items" ON public.wishlist_items;
DROP POLICY IF EXISTS "Parents can delete wishlist items" ON public.wishlist_items;

CREATE POLICY "Children can view their own wishlist items"
ON public.wishlist_items FOR SELECT TO authenticated
USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Children can create their own wishlist items"
ON public.wishlist_items FOR INSERT TO authenticated
WITH CHECK (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Children can update their own wishlist items before approval"
ON public.wishlist_items FOR UPDATE TO authenticated
USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()) AND approved_by_parent = false)
WITH CHECK (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()) AND approved_by_parent = false);

CREATE POLICY "Children can delete their own wishlist items before approval"
ON public.wishlist_items FOR DELETE TO authenticated
USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()) AND approved_by_parent = false);

CREATE POLICY "Parents can view their children wishlist items"
ON public.wishlist_items FOR SELECT TO authenticated
USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can insert wishlist items"
ON public.wishlist_items FOR INSERT TO authenticated
WITH CHECK (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can update wishlist items"
ON public.wishlist_items FOR UPDATE TO authenticated
USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

CREATE POLICY "Parents can delete wishlist items"
ON public.wishlist_items FOR DELETE TO authenticated
USING (child_id IN (SELECT id FROM children WHERE parent_id = auth.uid()));

-- USER_ROLES TABLE
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Deny direct role inserts" ON public.user_roles;
DROP POLICY IF EXISTS "Deny role updates" ON public.user_roles;
DROP POLICY IF EXISTS "Deny role deletions" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Deny direct role inserts"
ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny role updates"
ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "Deny role deletions"
ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated
USING (false);