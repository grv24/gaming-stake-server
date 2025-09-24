-- Add paymentGatewayPermissions column to TechAdmin table
ALTER TABLE "tech_admins" ADD COLUMN IF NOT EXISTS "paymentGatewayPermissions" JSONB;
