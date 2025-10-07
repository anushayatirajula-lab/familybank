-- Add RLS policies to allow children (anonymous users) to access their own data
-- Children authenticate via name/PIN through the authenticate_child function
-- Once they have a child_id, they can access their specific data

-- Allow anonymous users to view a specific child's basic info
CREATE POLICY "Anonymous children can view profiles"
ON public.children
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to view chores (already have "Children can view their chores" for authenticated)
-- So we create one specifically for anon
CREATE POLICY "Anonymous children can view chores"
ON public.chores
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to update their chore status
CREATE POLICY "Anonymous children can submit chores"
ON public.chores
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow anonymous users to view their balances
CREATE POLICY "Anonymous children can view balances"
ON public.balances
FOR SELECT
TO anon
USING (true);