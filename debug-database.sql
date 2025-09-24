-- DEBUG: Check your database structure
-- Run this in pgAdmin to see what's actually in your database

-- 1. Check all tables that contain 'admin'
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%admin%'
ORDER BY table_name;

-- 2. Check all columns in admin-related tables
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' 
AND t.table_name LIKE '%admin%'
ORDER BY t.table_name, c.ordinal_position;

-- 3. Check if paymentGatewayPermissions already exists
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name LIKE '%payment%' 
OR column_name LIKE '%gateway%'
OR column_name LIKE '%permission%'
ORDER BY table_name, column_name;

-- 4. Check your database permissions
SELECT 
    table_name,
    privilege_type
FROM information_schema.table_privileges 
WHERE grantee = current_user
AND table_name LIKE '%admin%'
ORDER BY table_name, privilege_type;
