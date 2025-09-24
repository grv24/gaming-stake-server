-- WORKAROUND: Since you don't have ALTER permission
-- We'll use a different approach

-- Step 1: Check if columns already exist
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name IN ('admins', 'tech_admins') 
AND column_name LIKE '%payment%'
ORDER BY table_name;

-- Step 2: If columns don't exist, we need to ask your database admin
-- to run these commands:
-- ALTER TABLE admins ADD COLUMN paymentGatewayPermissions jsonb DEFAULT NULL;
-- ALTER TABLE tech_admins ADD COLUMN paymentGatewayPermissions jsonb DEFAULT NULL;

-- Step 3: Alternative - Use existing columns or create new approach
-- Check what columns exist in these tables
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('admins', 'tech_admins')
ORDER BY table_name, ordinal_position;
