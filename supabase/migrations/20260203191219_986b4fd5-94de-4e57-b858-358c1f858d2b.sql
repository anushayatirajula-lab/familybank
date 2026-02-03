-- Change the default for trial_ends_at to NULL
-- The trial will be set on first login instead of signup
ALTER TABLE public.profiles 
ALTER COLUMN trial_ends_at SET DEFAULT NULL;