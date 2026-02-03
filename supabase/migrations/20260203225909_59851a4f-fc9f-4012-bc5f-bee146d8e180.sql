-- Remove TOYS from jar_type enum
-- Step 1: Create new enum type without TOYS
CREATE TYPE jar_type_new AS ENUM ('BOOKS', 'SHOPPING', 'CHARITY', 'WISHLIST', 'SAVINGS');

-- Step 2: Update all columns to use new enum
ALTER TABLE balances 
  ALTER COLUMN jar_type TYPE jar_type_new 
  USING jar_type::text::jar_type_new;

ALTER TABLE transactions 
  ALTER COLUMN jar_type TYPE jar_type_new 
  USING jar_type::text::jar_type_new;

ALTER TABLE jars 
  ALTER COLUMN jar_type TYPE jar_type_new 
  USING jar_type::text::jar_type_new;

-- Step 3: Drop old enum and rename new one
DROP TYPE jar_type;
ALTER TYPE jar_type_new RENAME TO jar_type;