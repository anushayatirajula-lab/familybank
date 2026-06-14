ALTER TABLE public.profiles ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '14 days');

UPDATE public.profiles
SET trial_ends_at = created_at + interval '14 days'
WHERE trial_ends_at IS NOT NULL
  AND trial_ends_at > now();