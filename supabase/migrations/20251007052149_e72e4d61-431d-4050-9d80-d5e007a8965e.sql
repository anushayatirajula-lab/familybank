-- Grant necessary privileges to anon role for child dashboard functionality
-- Children need to be able to view their data and update chore status
-- RLS policies will control what specific data they can access

-- Grant SELECT on children table to anon (for viewing child profile)
GRANT SELECT ON public.children TO anon;

-- Grant SELECT and UPDATE on chores table to anon (for viewing and submitting chores)
GRANT SELECT, UPDATE ON public.chores TO anon;

-- Grant SELECT on balances table to anon (for viewing their token balances)
GRANT SELECT ON public.balances TO anon;

-- Grant SELECT on jars table to anon (children need to see jar configuration)
GRANT SELECT ON public.jars TO anon;

-- Grant SELECT on allowances table to anon (children can see their allowance info)
GRANT SELECT ON public.allowances TO anon;

-- Grant SELECT on wishlist_items table to anon (children can see their wishlist)
GRANT SELECT ON public.wishlist_items TO anon;