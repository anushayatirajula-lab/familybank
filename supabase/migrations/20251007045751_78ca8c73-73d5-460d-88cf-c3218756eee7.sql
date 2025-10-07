-- Enable Row Level Security on profiles table
-- This table contains parent email addresses and must be protected
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Enable Row Level Security on children table  
-- This table contains sensitive data about minors (names, ages, PINs)
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;