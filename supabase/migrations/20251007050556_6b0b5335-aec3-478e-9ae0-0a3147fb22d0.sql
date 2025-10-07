-- Fix missing INSERT policy on profiles table
-- This allows new users to create their profile during signup
-- Only allows users to insert their own profile (auth.uid() must match id)

CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);