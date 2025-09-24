-- Create new GatewayAssignment table with all columns
-- This script will drop the existing table and create a new one with proper structure

-- Drop existing table if it exists
DROP TABLE IF EXISTS "gatewayAssignment" CASCADE;

-- Create new GatewayAssignment table with all columns
CREATE TABLE "gatewayAssignment" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "gatewayId" uuid NOT NULL,
    "assignedToUserId" uuid NOT NULL,
    "assignedToUserType" character varying(50) NOT NULL,
    "assignedByUserId" uuid NOT NULL,
    "assignedByUserType" character varying(50) NOT NULL,
    "groupId" character varying(100) NOT NULL,
    "isActive" boolean NOT NULL DEFAULT true,
    "notes" text,
    
    -- Granular permissions for this gateway assignment
    "canCreateGateway" boolean NOT NULL DEFAULT false,
    "canManageGateway" boolean NOT NULL DEFAULT false,
    "canAssignGateway" boolean NOT NULL DEFAULT false,
    "canProcessRequests" boolean NOT NULL DEFAULT false,
    
    -- Optional restrictions for this assignment
    "restrictions" jsonb DEFAULT NULL,
    
    -- Timestamps
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    
    CONSTRAINT "PK_gatewayAssignment" PRIMARY KEY ("id")
);

-- Create indexes for better performance
CREATE INDEX "IDX_gatewayAssignment_assignedToUserId_isActive" ON "gatewayAssignment" ("assignedToUserId", "isActive");
CREATE INDEX "IDX_gatewayAssignment_assignedByUserId_createdAt" ON "gatewayAssignment" ("assignedByUserId", "createdAt");
CREATE INDEX "IDX_gatewayAssignment_gatewayId_isActive" ON "gatewayAssignment" ("gatewayId", "isActive");
CREATE INDEX "IDX_gatewayAssignment_assignedToUserType" ON "gatewayAssignment" ("assignedToUserType");
CREATE INDEX "IDX_gatewayAssignment_assignedByUserType" ON "gatewayAssignment" ("assignedByUserType");
CREATE INDEX "IDX_gatewayAssignment_groupId" ON "gatewayAssignment" ("groupId");

-- Add foreign key constraint to PaymentGateway table
ALTER TABLE "gatewayAssignment" 
ADD CONSTRAINT "FK_gatewayAssignment_gatewayId" 
FOREIGN KEY ("gatewayId") REFERENCES "paymentGateway"("id") ON DELETE CASCADE;

-- Add check constraints for data integrity
ALTER TABLE "gatewayAssignment" 
ADD CONSTRAINT "CHK_gatewayAssignment_assignedToUserType" 
CHECK ("assignedToUserType" IN ('developer', 'techAdmin', 'admin', 'miniAdmin', 'superMaster', 'master', 'superAgent', 'agent', 'client'));

ALTER TABLE "gatewayAssignment" 
ADD CONSTRAINT "CHK_gatewayAssignment_assignedByUserType" 
CHECK ("assignedByUserType" IN ('developer', 'techAdmin', 'admin', 'miniAdmin', 'superMaster', 'master', 'superAgent', 'agent', 'client'));

-- Add check constraint to ensure at least one permission is granted
ALTER TABLE "gatewayAssignment" 
ADD CONSTRAINT "CHK_gatewayAssignment_hasPermissions" 
CHECK ("canCreateGateway" = true OR "canManageGateway" = true OR "canAssignGateway" = true OR "canProcessRequests" = true);

-- Add comments for documentation
COMMENT ON TABLE "gatewayAssignment" IS 'Stores gateway assignments with granular permissions for users';
COMMENT ON COLUMN "gatewayAssignment"."id" IS 'Unique identifier for the assignment';
COMMENT ON COLUMN "gatewayAssignment"."gatewayId" IS 'Reference to PaymentGateway';
COMMENT ON COLUMN "gatewayAssignment"."assignedToUserId" IS 'User who receives the gateway assignment';
COMMENT ON COLUMN "gatewayAssignment"."assignedToUserType" IS 'Type of user receiving assignment';
COMMENT ON COLUMN "gatewayAssignment"."assignedByUserId" IS 'User who assigned the gateway';
COMMENT ON COLUMN "gatewayAssignment"."assignedByUserType" IS 'Type of user who assigned';
COMMENT ON COLUMN "gatewayAssignment"."groupId" IS 'User group identifier for multi-tenant support';
COMMENT ON COLUMN "gatewayAssignment"."isActive" IS 'Whether the assignment is currently active';
COMMENT ON COLUMN "gatewayAssignment"."notes" IS 'Optional notes about the assignment';
COMMENT ON COLUMN "gatewayAssignment"."canCreateGateway" IS 'Can create new gateways';
COMMENT ON COLUMN "gatewayAssignment"."canManageGateway" IS 'Can manage existing gateways';
COMMENT ON COLUMN "gatewayAssignment"."canAssignGateway" IS 'Can assign gateways to other users';
COMMENT ON COLUMN "gatewayAssignment"."canProcessRequests" IS 'Can process deposit/withdrawal requests';
COMMENT ON COLUMN "gatewayAssignment"."restrictions" IS 'Optional restrictions (maxGateways, maxAmount, allowedGatewayTypes)';

-- Verify table creation
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'gatewayAssignment' 
ORDER BY ordinal_position;

