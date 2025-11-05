-- Add field to track first login for children
ALTER TABLE public.children 
ADD COLUMN IF NOT EXISTS first_login boolean DEFAULT true;