-- Add day_of_week field to allowances table
ALTER TABLE public.allowances
ADD COLUMN day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6);

-- Add comment for clarity
COMMENT ON COLUMN public.allowances.day_of_week IS 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday) when allowance should be paid';

-- Update existing allowances to default to Monday (1) if they don't have a value
UPDATE public.allowances
SET day_of_week = 1
WHERE day_of_week IS NULL;