-- MANUAL EXECUTION: Create New GatewayAssignment Table
-- Execute this script directly in pgAdmin or any PostgreSQL client

-- Step 1: Drop existing table (WARNING: This will delete all data!)
DROP TABLE IF EXISTS "gatewayAssignment" CASCADE;

-- Step 2: Create new table with all columns
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
    
    -- Granular permissions
    "canCreateGateway" boolean NOT NULL DEFAULT false,
    "canManageGateway" boolean NOT NULL DEFAULT false,
    "canAssignGateway" boolean NOT NULL DEFAULT false,
    "canProcessRequests" boolean NOT NULL DEFAULT false,
    
    -- Restrictions
    "restrictions" jsonb DEFAULT NULL,
    
    -- Timestamps
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    
    CONSTRAINT "PK_gatewayAssignment" PRIMARY KEY ("id")
);

-- Step 3: Create indexes
CREATE INDEX "IDX_gatewayAssignment_assignedToUserId_isActive" ON "gatewayAssignment" ("assignedToUserId", "isActive");
CREATE INDEX "IDX_gatewayAssignment_assignedByUserId_createdAt" ON "gatewayAssignment" ("assignedByUserId", "createdAt");
CREATE INDEX "IDX_gatewayAssignment_gatewayId_isActive" ON "gatewayAssignment" ("gatewayId", "isActive");

-- Step 4: Add foreign key constraint
ALTER TABLE "gatewayAssignment" 
ADD CONSTRAINT "FK_gatewayAssignment_gatewayId" 
FOREIGN KEY ("gatewayId") REFERENCES "paymentGateway"("id") ON DELETE CASCADE;

-- Step 5: Add check constraints
ALTER TABLE "gatewayAssignment" 
ADD CONSTRAINT "CHK_gatewayAssignment_assignedToUserType" 
CHECK ("assignedToUserType" IN ('developer', 'techAdmin', 'admin', 'miniAdmin', 'superMaster', 'master', 'superAgent', 'agent', 'client'));

ALTER TABLE "gatewayAssignment" 
ADD CONSTRAINT "CHK_gatewayAssignment_assignedByUserType" 
CHECK ("assignedByUserType" IN ('developer', 'techAdmin', 'admin', 'miniAdmin', 'superMaster', 'master', 'superAgent', 'agent', 'client'));

-- Step 6: Verify table creation
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'gatewayAssignment' 
ORDER BY ordinal_position;

