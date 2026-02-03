-- Create a public view that excludes the email column
-- Users will query this view instead of the profiles table directly
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT 
    id,
    full_name,
    family_code,
    trial_ends_at,
    created_at,
    updated_at
  FROM public.profiles;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

-- Now lock down the base profiles table from direct SELECT access
-- Edge functions using service_role can still access it
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create a restrictive SELECT policy that blocks direct queries
-- Users must use profiles_public view instead
CREATE POLICY "Block direct profile reads - use profiles_public view"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (false);

-- Keep the existing INSERT and UPDATE policies for profile management
-- These are still needed for the auth trigger and profile updates