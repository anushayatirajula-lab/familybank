-- Add user_id column to link children to auth users
ALTER TABLE children ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_children_user_id ON children(user_id);

-- Remove dangerous anonymous access policies
DROP POLICY IF EXISTS "Anonymous children can view profiles" ON children;
DROP POLICY IF EXISTS "Anonymous children can view chores" ON chores;
DROP POLICY IF EXISTS "Anonymous children can submit chores" ON chores;
DROP POLICY IF EXISTS "Anonymous children can view balances" ON balances;

-- Add secure child access policies
CREATE POLICY "Children can view their own profile"
ON children FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Children can view their own chores"
ON chores FOR SELECT
TO authenticated
USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Children can submit their own chores"
ON chores FOR UPDATE
TO authenticated
USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()))
WITH CHECK (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));

CREATE POLICY "Children can view their own balances"
ON balances FOR SELECT
TO authenticated
USING (child_id IN (SELECT id FROM children WHERE user_id = auth.uid()));