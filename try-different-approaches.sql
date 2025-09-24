-- TRY DIFFERENT APPROACHES TO ADD COLUMN
-- Run these one by one in pgAdmin

-- Approach 1: Simple syntax
ALTER TABLE tech_admins ADD COLUMN paymentGatewayPermissions jsonb;
ALTER TABLE admins ADD COLUMN paymentGatewayPermissions jsonb;

-- Approach 2: With explicit schema
ALTER TABLE public.tech_admins ADD COLUMN paymentGatewayPermissions jsonb;
ALTER TABLE public.admins ADD COLUMN paymentGatewayPermissions jsonb;

-- Approach 3: With IF NOT EXISTS (PostgreSQL 9.6+)
ALTER TABLE tech_admins ADD COLUMN IF NOT EXISTS paymentGatewayPermissions jsonb;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS paymentGatewayPermissions jsonb;

-- Approach 4: With default value
ALTER TABLE tech_admins ADD COLUMN paymentGatewayPermissions jsonb DEFAULT NULL;
ALTER TABLE admins ADD COLUMN paymentGatewayPermissions jsonb DEFAULT NULL;

-- Approach 5: Different column name (simpler)
ALTER TABLE tech_admins ADD COLUMN payment_permissions jsonb;
ALTER TABLE admins ADD COLUMN payment_permissions jsonb;

-- Approach 6: Check if it worked
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('tech_admins', 'admins') 
AND column_name LIKE '%payment%'
ORDER BY table_name;
