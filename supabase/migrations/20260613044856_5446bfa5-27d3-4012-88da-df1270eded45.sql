DELETE FROM public.transactions WHERE child_id IN (SELECT id FROM public.children WHERE parent_id='5f04f554-07bc-47af-81fb-63cca51fb60b');
DELETE FROM public.balances WHERE child_id IN (SELECT id FROM public.children WHERE parent_id='5f04f554-07bc-47af-81fb-63cca51fb60b');
DELETE FROM public.jars WHERE child_id IN (SELECT id FROM public.children WHERE parent_id='5f04f554-07bc-47af-81fb-63cca51fb60b');
DELETE FROM public.wishlist_items WHERE child_id IN (SELECT id FROM public.children WHERE parent_id='5f04f554-07bc-47af-81fb-63cca51fb60b');
DELETE FROM public.children WHERE parent_id='5f04f554-07bc-47af-81fb-63cca51fb60b';
DELETE FROM public.subscription_data WHERE user_id='5f04f554-07bc-47af-81fb-63cca51fb60b';