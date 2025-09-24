-- Add paymentGatewayPermissions columns
ALTER TABLE admins ADD COLUMN IF NOT EXISTS paymentGatewayPermissions jsonb DEFAULT NULL;
ALTER TABLE tech_admins ADD COLUMN IF NOT EXISTS paymentGatewayPermissions jsonb DEFAULT NULL;

-- Verify columns were added
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('admins', 'tech_admins') 
AND column_name = 'paymentGatewayPermissions'
ORDER BY table_name;

-- Show success message
SELECT 'Columns added successfully!' as status;
