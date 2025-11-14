-- Fix Critical Security Issues: Restrict profiles and children access

-- ============================================
-- 1. FIX PROFILES TABLE - Restrict to own profile only
-- ============================================

-- Drop the overly permissive "Block anonymous access to profiles" policy
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;

-- The existing "Users can view own profile" policy is correct and sufficient
-- No changes needed for: "Users can view own profile" (already has WHERE auth.uid() = id)

-- ============================================
-- 2. FIX CHILDREN TABLE - Already has correct policies
-- ============================================
-- The existing policies are actually correct:
-- - "Parents can view their children" (WHERE parent_id = auth.uid())
-- - "Children can view their own profile" (WHERE auth.uid() = user_id)
-- These already prevent unauthorized access

-- ============================================
-- 3. ADD MISSING POLICIES FOR TRANSACTIONS
-- ============================================

-- Explicitly deny INSERT, UPDATE, DELETE on transactions table
-- Transactions should only be created through secure backend functions

CREATE POLICY "Deny direct transaction inserts"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny transaction updates"
ON public.transactions
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny transaction deletions"
ON public.transactions
FOR DELETE
TO authenticated
USING (false);

-- ============================================
-- 4. ADD MISSING POLICIES FOR USER_ROLES
-- ============================================

-- Explicitly deny INSERT, UPDATE, DELETE on user_roles table
-- Roles should only be managed through secure backend triggers

CREATE POLICY "Deny direct role inserts"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny role updates"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny role deletions"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);