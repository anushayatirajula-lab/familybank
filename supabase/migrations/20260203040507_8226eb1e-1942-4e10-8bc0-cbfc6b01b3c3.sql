-- Add INSERT policy to notifications table
-- Notifications should only be created by system processes (edge functions with service role)
-- Block direct inserts from regular authenticated users to prevent spam/phishing attacks

-- Option 1: Block all direct user inserts (notifications only via service role)
CREATE POLICY "Block direct notification inserts"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Note: Edge functions using SUPABASE_SERVICE_ROLE_KEY bypass RLS entirely,
-- so they can still insert notifications. This policy blocks malicious 
-- direct inserts from regular authenticated users.