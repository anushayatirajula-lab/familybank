-- Remove the policy that allows children to see parent profiles
-- This was unintentionally exposing parent email/Stripe data to children
DROP POLICY IF EXISTS "Parents can view their children profiles" ON public.profiles;