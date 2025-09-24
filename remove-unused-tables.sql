-- =====================================================
-- DATABASE CLEANUP SCRIPT - Remove Unused Tables
-- =====================================================
-- 
-- WARNING: This script will permanently delete unused tables!
-- Make sure to backup your database before running this script.
--
-- Tables to be removed:
-- 1. accountTrasaction (old name for account_transactions)
-- 2. casino_bet (old name for casino_bet_updated)
-- 3. casino_match (old name for casino_match_new)
-- 4. clients_new (duplicate of clients)
-- 5. masters_new (duplicate of masters)
-- 6. payment_gateway_permissions (not defined in codebase)
-- 7. whitelists (old name for whitelist_updated)
--
-- =====================================================

-- Step 1: Create backup tables (SAFER APPROACH)
-- Uncomment the following lines to rename tables instead of dropping them

-- ALTER TABLE "accountTrasaction" RENAME TO "accountTrasaction_backup_20240924";
-- ALTER TABLE "casino_bet" RENAME TO "casino_bet_backup_20240924";
-- ALTER TABLE "casino_match" RENAME TO "casino_match_backup_20240924";
-- ALTER TABLE "clients_new" RENAME TO "clients_new_backup_20240924";
-- ALTER TABLE "masters_new" RENAME TO "masters_new_backup_20240924";
-- ALTER TABLE "payment_gateway_permissions" RENAME TO "payment_gateway_permissions_backup_20240924";
-- ALTER TABLE "whitelists" RENAME TO "whitelists_backup_20240924";

-- Step 2: Drop unused tables (PERMANENT DELETION)
-- Uncomment the following lines to permanently delete the tables

-- DROP TABLE IF EXISTS "accountTrasaction" CASCADE;
-- DROP TABLE IF EXISTS "casino_bet" CASCADE;
-- DROP TABLE IF EXISTS "casino_match" CASCADE;
-- DROP TABLE IF EXISTS "clients_new" CASCADE;
-- DROP TABLE IF EXISTS "masters_new" CASCADE;
-- DROP TABLE IF EXISTS "payment_gateway_permissions" CASCADE;
-- DROP TABLE IF EXISTS "whitelists" CASCADE;

-- Step 3: Verify remaining tables
-- Run this query to see all remaining tables after cleanup

SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- =====================================================
-- RECOMMENDED APPROACH:
-- =====================================================
-- 1. First run the backup/rename commands (Step 1)
-- 2. Test your application to ensure everything works
-- 3. If everything works fine, then run the DROP commands (Step 2)
-- 4. If there are issues, you can restore from the backup tables
-- =====================================================
