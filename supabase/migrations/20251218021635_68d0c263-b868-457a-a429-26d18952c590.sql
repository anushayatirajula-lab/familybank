-- Update default trial period to 60 days (2 months) for new users
ALTER TABLE public.profiles 
ALTER COLUMN trial_ends_at SET DEFAULT (now() + '60 days'::interval);

-- Extend trial for all existing users to 60 days from now
UPDATE public.profiles 
SET trial_ends_at = now() + '60 days'::interval
WHERE trial_ends_at IS NOT NULL;