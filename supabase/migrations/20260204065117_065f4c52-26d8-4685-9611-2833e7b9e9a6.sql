-- Add column to support multiple recurrence days
ALTER TABLE public.chores 
ADD COLUMN recurrence_days integer[] DEFAULT NULL;

-- Migrate existing weekly chores to use the new array format
UPDATE public.chores 
SET recurrence_days = ARRAY[recurrence_day]
WHERE recurrence_type = 'weekly' AND recurrence_day IS NOT NULL;