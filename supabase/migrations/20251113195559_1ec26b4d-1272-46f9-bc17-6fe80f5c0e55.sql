-- Update the default trial period to 14 days for new parent signups
ALTER TABLE public.profiles 
ALTER COLUMN trial_ends_at SET DEFAULT (now() + INTERVAL '14 days');