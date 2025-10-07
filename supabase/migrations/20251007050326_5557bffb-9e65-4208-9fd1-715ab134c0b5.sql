-- Fix public access to all tables by restricting policies to authenticated users only
-- Currently anonymous users can access data because policies don't check for authentication

-- Profiles table: Fix public email exposure
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

-- Children table: Fix public exposure of children's data
DROP POLICY IF EXISTS "Parents can view their children" ON public.children;
DROP POLICY IF EXISTS "Parents can create children" ON public.children;
DROP POLICY IF EXISTS "Parents can update their children" ON public.children;
DROP POLICY IF EXISTS "Parents can delete their children" ON public.children;

CREATE POLICY "Parents can view their children" 
ON public.children 
FOR SELECT 
TO authenticated
USING (parent_id = auth.uid());

CREATE POLICY "Parents can create children" 
ON public.children 
FOR INSERT 
TO authenticated
WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can update their children" 
ON public.children 
FOR UPDATE 
TO authenticated
USING (parent_id = auth.uid());

CREATE POLICY "Parents can delete their children" 
ON public.children 
FOR DELETE 
TO authenticated
USING (parent_id = auth.uid());

-- Balances table: Fix public exposure of financial data
DROP POLICY IF EXISTS "View balances" ON public.balances;

CREATE POLICY "View balances" 
ON public.balances 
FOR SELECT 
TO authenticated
USING (child_id IN (
  SELECT id FROM public.children WHERE parent_id = auth.uid()
));

-- Fix all other tables to require authentication
-- Chores table
DROP POLICY IF EXISTS "Children can view their chores" ON public.chores;
DROP POLICY IF EXISTS "Children can update chore status" ON public.chores;
DROP POLICY IF EXISTS "Parents can manage chores" ON public.chores;

CREATE POLICY "Children can view their chores" 
ON public.chores 
FOR SELECT 
TO authenticated
USING (child_id IN (
  SELECT id FROM public.children WHERE parent_id = auth.uid()
));

CREATE POLICY "Children can update chore status" 
ON public.chores 
FOR UPDATE 
TO authenticated
USING (child_id IN (
  SELECT id FROM public.children WHERE parent_id = auth.uid()
));

CREATE POLICY "Parents can manage chores" 
ON public.chores 
FOR ALL 
TO authenticated
USING (child_id IN (
  SELECT id FROM public.children WHERE parent_id = auth.uid()
));

-- Jars table
DROP POLICY IF EXISTS "Parents and children can view jars" ON public.jars;
DROP POLICY IF EXISTS "Parents can manage jars" ON public.jars;

CREATE POLICY "Parents and children can view jars" 
ON public.jars 
FOR SELECT 
TO authenticated
USING (child_id IN (
  SELECT id FROM public.children WHERE parent_id = auth.uid()
));

CREATE POLICY "Parents can manage jars" 
ON public.jars 
FOR ALL 
TO authenticated
USING (child_id IN (
  SELECT id FROM public.children WHERE parent_id = auth.uid()
));

-- Transactions table
DROP POLICY IF EXISTS "View transactions" ON public.transactions;

CREATE POLICY "View transactions" 
ON public.transactions 
FOR SELECT 
TO authenticated
USING (child_id IN (
  SELECT id FROM public.children WHERE parent_id = auth.uid()
));

-- Allowances table
DROP POLICY IF EXISTS "Parents manage allowances" ON public.allowances;

CREATE POLICY "Parents manage allowances" 
ON public.allowances 
FOR ALL 
TO authenticated
USING (child_id IN (
  SELECT id FROM public.children WHERE parent_id = auth.uid()
));

-- Wishlist items table
DROP POLICY IF EXISTS "Manage wishlist" ON public.wishlist_items;

CREATE POLICY "Manage wishlist" 
ON public.wishlist_items 
FOR ALL 
TO authenticated
USING (child_id IN (
  SELECT id FROM public.children WHERE parent_id = auth.uid()
));