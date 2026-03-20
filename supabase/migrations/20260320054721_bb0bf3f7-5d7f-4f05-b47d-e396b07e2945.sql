UPDATE profiles SET trial_ends_at = NOW() + INTERVAL '30 days' WHERE trial_ends_at IS NOT NULL AND trial_ends_at < NOW();

UPDATE subscription_data SET subscription_status = 'trialing' WHERE user_id IN (SELECT id FROM profiles WHERE trial_ends_at IS NOT NULL AND trial_ends_at > NOW() AND trial_ends_at <= NOW() + INTERVAL '31 days');