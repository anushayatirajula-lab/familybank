-- Add column to store initial password for credential recovery
ALTER TABLE public.children 
ADD COLUMN initial_password TEXT;