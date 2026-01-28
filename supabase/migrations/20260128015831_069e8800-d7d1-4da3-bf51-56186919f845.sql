-- Add recurring chore fields to chores table
ALTER TABLE public.chores
ADD COLUMN is_recurring boolean DEFAULT false,
ADD COLUMN recurrence_type text CHECK (recurrence_type IN ('daily', 'weekly')),
ADD COLUMN recurrence_day integer CHECK (recurrence_day >= 0 AND recurrence_day <= 6),
ADD COLUMN parent_chore_id uuid REFERENCES public.chores(id) ON DELETE SET NULL;

-- Create index for finding recurring chores
CREATE INDEX idx_chores_recurring ON public.chores(is_recurring, recurrence_type) WHERE is_recurring = true;

-- Comment on columns
COMMENT ON COLUMN public.chores.is_recurring IS 'Whether this chore repeats automatically';
COMMENT ON COLUMN public.chores.recurrence_type IS 'daily or weekly';
COMMENT ON COLUMN public.chores.recurrence_day IS 'Day of week for weekly chores (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN public.chores.parent_chore_id IS 'Links to the original recurring chore template';