-- Update existing foreign key constraints to add CASCADE DELETE

-- Drop existing constraints first
ALTER TABLE public.children
DROP CONSTRAINT IF EXISTS children_parent_id_fkey;

ALTER TABLE public.children
DROP CONSTRAINT IF EXISTS children_user_id_fkey;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Re-add with CASCADE DELETE
ALTER TABLE public.children
ADD CONSTRAINT children_parent_id_fkey 
FOREIGN KEY (parent_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

ALTER TABLE public.children
ADD CONSTRAINT children_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;