-- Update Whitelist Payment Gateway Schema
-- This script updates the whitelist_updated table to use a simple boolean flag
-- instead of complex payment gateway permissions

-- Step 1: Add the new isPaymentGatewayEnabled column
ALTER TABLE whitelist_updated 
ADD COLUMN IF NOT EXISTS "isPaymentGatewayEnabled" boolean DEFAULT false;

-- Step 2: Update existing records to enable payment gateway if they had permissions
UPDATE whitelist_updated 
SET "isPaymentGatewayEnabled" = true
WHERE "paymentGatewayPermissions" IS NOT NULL 
  AND "paymentGatewayPermissions" != '{}'
  AND "paymentGatewayPermissions" != 'null';

-- Step 3: Verify the update
SELECT 
  id,
  "CommonName",
  "isPaymentGatewayEnabled",
  "paymentGatewayPermissions",
  "isActive"
FROM whitelist_updated 
ORDER BY "createdAt" DESC;

-- Step 4: Show summary
SELECT 
  COUNT(*) as total_whitelists,
  COUNT(CASE WHEN "isPaymentGatewayEnabled" = true THEN 1 END) as payment_gateway_enabled,
  COUNT(CASE WHEN "isActive" = true THEN 1 END) as active_whitelists
FROM whitelist_updated;

-- Step 5: Optional - Remove the old paymentGatewayPermissions column
-- Uncomment the line below if you want to remove the old column completely
-- ALTER TABLE whitelist_updated DROP COLUMN IF EXISTS "paymentGatewayPermissions";

-- Instructions:
-- 1. Run this script in pgAdmin
-- 2. Check the results to ensure the migration worked correctly
-- 3. Update your application code to use isPaymentGatewayEnabled instead of paymentGatewayPermissions
-- 4. Test the payment gateway functionality
