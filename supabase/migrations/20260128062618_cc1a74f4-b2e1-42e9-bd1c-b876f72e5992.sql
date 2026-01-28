-- Fix notifications table to explicitly block anonymous access
-- Recreate the SELECT policy with TO authenticated to ensure only logged-in users can access

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" 
ON public.notifications 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Also update the UPDATE policy to be explicit
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can update own notifications" 
ON public.notifications 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);