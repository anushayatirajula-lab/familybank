-- Create a separate table for sensitive subscription data that users CANNOT access directly
-- This table is ONLY accessible by service role (edge functions)
CREATE TABLE public.subscription_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  subscription_id TEXT,
  subscription_status TEXT DEFAULT 'trialing',
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS but create NO policies - this means no user can access directly
ALTER TABLE public.subscription_data ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke ALL access from both anon and authenticated roles
-- Only service_role (used by edge functions) can access this table
REVOKE ALL ON public.subscription_data FROM anon;
REVOKE ALL ON public.subscription_data FROM authenticated;

-- Migrate existing payment data from profiles to subscription_data
INSERT INTO public.subscription_data (user_id, stripe_customer_id, subscription_id, subscription_status, current_period_end)
SELECT 
  id as user_id,
  stripe_customer_id,
  subscription_id,
  subscription_status,
  current_period_end
FROM public.profiles
WHERE stripe_customer_id IS NOT NULL OR subscription_id IS NOT NULL;

-- Remove sensitive payment columns from profiles table
-- Keep only trial_ends_at which is less sensitive and needed for trial calculation
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS subscription_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS current_period_end;