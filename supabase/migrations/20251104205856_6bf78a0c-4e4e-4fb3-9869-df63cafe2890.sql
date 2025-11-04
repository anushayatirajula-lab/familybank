-- Remove plain-text PIN column (no longer needed - using Supabase auth)
ALTER TABLE children DROP COLUMN IF EXISTS pin;

-- Drop existing profile policies if they exist
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile only" ON profiles;

-- Add RLS policy to profiles table to block anonymous access
CREATE POLICY "Block anonymous access to profiles"
ON profiles FOR SELECT
TO anon
USING (false);

-- Note: The existing "Users can view own profile" policy already handles authenticated access