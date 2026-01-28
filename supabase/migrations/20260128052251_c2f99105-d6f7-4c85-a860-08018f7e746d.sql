-- Step 2: Update existing TOYS entries to SAVINGS
UPDATE public.jars SET jar_type = 'SAVINGS' WHERE jar_type = 'TOYS';
UPDATE public.balances SET jar_type = 'SAVINGS' WHERE jar_type = 'TOYS';
UPDATE public.transactions SET jar_type = 'SAVINGS' WHERE jar_type = 'TOYS';