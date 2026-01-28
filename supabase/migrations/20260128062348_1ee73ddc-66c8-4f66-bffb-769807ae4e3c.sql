-- Remove the initial_password column from children table
-- This column is no longer used as passwords are shown once during creation and not stored
ALTER TABLE public.children DROP COLUMN IF EXISTS initial_password;