-- Fix overly permissive policies on balances and transactions tables
-- Currently "System can update balances" and "System can create transactions" 
-- allow ANY authenticated user to manipulate financial data

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "System can update balances" ON public.balances;
DROP POLICY IF EXISTS "System can create transactions" ON public.transactions;

-- The SECURITY DEFINER functions (fb_split_into_jars, fb_approve_chore) 
-- will bypass RLS and can still update balances and insert transactions

-- Keep the view policy for balances (already exists)
-- Policy: "View balances" already restricts viewing to parents only

-- Keep the view policy for transactions (already exists)  
-- Policy: "View transactions" already restricts viewing to parents only

-- Note: Updates to balances and transaction inserts will now only happen
-- through the secure SECURITY DEFINER functions, not directly by users