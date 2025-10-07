-- Enable RLS
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.jars ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.allowances ENABLE ROW LEVEL SECURITY;

-- Create enum types
CREATE TYPE public.user_role AS ENUM ('PARENT', 'CHILD');
CREATE TYPE public.chore_status AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE public.transaction_type AS ENUM ('CHORE_REWARD', 'ALLOWANCE_SPLIT', 'WISHLIST_SPEND', 'MANUAL_ADJUSTMENT');
CREATE TYPE public.jar_type AS ENUM ('TOYS', 'BOOKS', 'SHOPPING', 'CHARITY', 'WISHLIST');

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Children table
CREATE TABLE public.children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  pin TEXT,
  ai_tips_enabled BOOLEAN DEFAULT true,
  daily_spend_limit DECIMAL(10,2) DEFAULT 10.00,
  per_txn_limit DECIMAL(10,2) DEFAULT 5.00,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jars configuration (percentage split for each child)
CREATE TABLE public.jars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  jar_type jar_type NOT NULL,
  percentage INTEGER NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, jar_type)
);

-- Current balances per jar
CREATE TABLE public.balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  jar_type jar_type NOT NULL,
  amount DECIMAL(10,2) DEFAULT 0.00 CHECK (amount >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, jar_type)
);

-- Chores
CREATE TABLE public.chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  token_reward DECIMAL(10,2) NOT NULL CHECK (token_reward > 0),
  status chore_status DEFAULT 'PENDING',
  due_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions (audit trail)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  jar_type jar_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  transaction_type transaction_type NOT NULL,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wishlist items
CREATE TABLE public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_amount DECIMAL(10,2) NOT NULL CHECK (target_amount > 0),
  current_amount DECIMAL(10,2) DEFAULT 0.00 CHECK (current_amount >= 0),
  image_url TEXT,
  is_purchased BOOLEAN DEFAULT false,
  approved_by_parent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly allowances
CREATE TABLE public.allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  weekly_amount DECIMAL(10,2) NOT NULL CHECK (weekly_amount >= 0),
  next_payment_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to split tokens into jars based on percentages
CREATE OR REPLACE FUNCTION public.fb_split_into_jars(
  p_child UUID,
  p_amount DECIMAL,
  p_type transaction_type,
  p_reference_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_jar RECORD;
  v_jar_amount DECIMAL;
BEGIN
  -- Loop through each jar for this child
  FOR v_jar IN 
    SELECT jar_type, percentage 
    FROM public.jars 
    WHERE child_id = p_child
  LOOP
    -- Calculate amount for this jar
    v_jar_amount := (p_amount * v_jar.percentage / 100.0)::DECIMAL(10,2);
    
    -- Update balance
    INSERT INTO public.balances (child_id, jar_type, amount)
    VALUES (p_child, v_jar.jar_type, v_jar_amount)
    ON CONFLICT (child_id, jar_type) 
    DO UPDATE SET 
      amount = balances.amount + v_jar_amount,
      updated_at = NOW();
    
    -- Record transaction
    INSERT INTO public.transactions (child_id, jar_type, amount, transaction_type, reference_id, description)
    VALUES (p_child, v_jar.jar_type, v_jar_amount, p_type, p_reference_id, 
            'Split: ' || v_jar.percentage || '% to ' || v_jar.jar_type);
  END LOOP;
  
  RETURN TRUE;
END;
$$;

-- Function to approve chore and distribute tokens
CREATE OR REPLACE FUNCTION public.fb_approve_chore(p_chore UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chore RECORD;
  v_success BOOLEAN;
BEGIN
  -- Get chore details
  SELECT * INTO v_chore FROM public.chores WHERE id = p_chore;
  
  IF v_chore IS NULL THEN
    RAISE EXCEPTION 'Chore not found';
  END IF;
  
  IF v_chore.status != 'SUBMITTED' THEN
    RAISE EXCEPTION 'Chore must be in SUBMITTED status';
  END IF;
  
  -- Update chore status
  UPDATE public.chores 
  SET status = 'APPROVED', approved_at = NOW(), updated_at = NOW()
  WHERE id = p_chore;
  
  -- Split tokens into jars
  SELECT public.fb_split_into_jars(
    v_chore.child_id,
    v_chore.token_reward,
    'CHORE_REWARD'::transaction_type,
    p_chore
  ) INTO v_success;
  
  RETURN v_success;
END;
$$;

-- RLS Policies

-- Profiles: users can read their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Children: parents can CRUD their kids, kids can view themselves
CREATE POLICY "Parents can view their children" ON public.children
  FOR SELECT USING (
    parent_id = auth.uid() OR 
    id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
  );

CREATE POLICY "Parents can create children" ON public.children
  FOR INSERT WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can update their children" ON public.children
  FOR UPDATE USING (parent_id = auth.uid());

CREATE POLICY "Parents can delete their children" ON public.children
  FOR DELETE USING (parent_id = auth.uid());

-- Jars: parents and children can view, only parents can modify
CREATE POLICY "Parents and children can view jars" ON public.jars
  FOR SELECT USING (
    child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
  );

CREATE POLICY "Parents can manage jars" ON public.jars
  FOR ALL USING (
    child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
  );

-- Balances: parents and children can view, system updates
CREATE POLICY "View balances" ON public.balances
  FOR SELECT USING (
    child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
  );

CREATE POLICY "System can update balances" ON public.balances
  FOR ALL USING (true);

-- Chores: parents CRUD, children can view and submit
CREATE POLICY "Parents can manage chores" ON public.chores
  FOR ALL USING (
    child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
  );

CREATE POLICY "Children can view their chores" ON public.chores
  FOR SELECT USING (
    child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
  );

CREATE POLICY "Children can update chore status" ON public.chores
  FOR UPDATE USING (
    child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
  );

-- Transactions: parents and children can view
CREATE POLICY "View transactions" ON public.transactions
  FOR SELECT USING (
    child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
  );

CREATE POLICY "System can create transactions" ON public.transactions
  FOR INSERT WITH CHECK (true);

-- Wishlist: similar to chores
CREATE POLICY "Manage wishlist" ON public.wishlist_items
  FOR ALL USING (
    child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
  );

-- Allowances: parents manage
CREATE POLICY "Parents manage allowances" ON public.allowances
  FOR ALL USING (
    child_id IN (SELECT id FROM public.children WHERE parent_id = auth.uid())
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;