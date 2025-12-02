-- Update default trial period from 14 days to 30 days for new users
ALTER TABLE public.profiles 
ALTER COLUMN trial_ends_at SET DEFAULT (now() + '30 days'::interval);

-- Extend trial for all existing users by setting trial_ends_at to 30 days from now
UPDATE public.profiles 
SET trial_ends_at = now() + '30 days'::interval
WHERE trial_ends_at IS NOT NULL;