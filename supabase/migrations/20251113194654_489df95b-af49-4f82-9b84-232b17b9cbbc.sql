-- Extend trial period for existing parents who don't have a Stripe subscription yet
-- Give them 14 days from now to be generous with existing users
UPDATE public.profiles
SET trial_ends_at = now() + INTERVAL '14 days',
    updated_at = now()
WHERE stripe_customer_id IS NULL
  AND subscription_status = 'trialing'
  AND trial_ends_at < now() + INTERVAL '14 days';