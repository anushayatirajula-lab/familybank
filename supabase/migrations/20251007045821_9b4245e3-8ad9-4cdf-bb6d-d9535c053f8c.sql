-- Enable RLS on all remaining tables that have policies but RLS disabled

-- Enable RLS on allowances table
ALTER TABLE public.allowances ENABLE ROW LEVEL SECURITY;

-- Enable RLS on balances table
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;

-- Enable RLS on chores table
ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;

-- Enable RLS on jars table
ALTER TABLE public.jars ENABLE ROW LEVEL SECURITY;

-- Enable RLS on transactions table
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on wishlist_items table
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;