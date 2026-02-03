-- Add family_code column to profiles table for parent identification
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS family_code TEXT UNIQUE;

-- Create function to generate unique family code
CREATE OR REPLACE FUNCTION public.generate_family_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a 6-character alphanumeric code (uppercase)
    new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE family_code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Create trigger function to auto-generate family code for new profiles (parents)
CREATE OR REPLACE FUNCTION public.auto_generate_family_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate for parent accounts (those without a family_code)
  IF NEW.family_code IS NULL THEN
    NEW.family_code := public.generate_family_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_auto_family_code ON public.profiles;
CREATE TRIGGER trigger_auto_family_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_family_code();

-- Generate family codes for existing parent profiles that don't have one
UPDATE public.profiles
SET family_code = public.generate_family_code()
WHERE family_code IS NULL
AND id IN (SELECT DISTINCT parent_id FROM public.children);