-- =====================================================
-- CREATE MISSING TABLE SCRIPT
-- =====================================================
-- 
-- This script creates the missing 'user_activities' table
-- that is defined in the codebase but doesn't exist in the database.
--
-- =====================================================

-- Create the user_activities table
CREATE TABLE IF NOT EXISTS "user_activities" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "userId" uuid NOT NULL,
    "userType" character varying(50) NOT NULL,
    "activityType" character varying NOT NULL,
    "activityDescription" character varying(255) NOT NULL,
    "activityData" jsonb,
    "ipAddress" character varying(45),
    "userAgent" character varying(500),
    "sessionId" character varying(100),
    "groupId" character varying(100),
    "isActive" boolean NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "PK_user_activities" PRIMARY KEY ("id")
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "IDX_user_activities_userId_createdAt" ON "user_activities" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "IDX_user_activities_activityType_createdAt" ON "user_activities" ("activityType", "createdAt");
CREATE INDEX IF NOT EXISTS "IDX_user_activities_ipAddress_createdAt" ON "user_activities" ("ipAddress", "createdAt");

-- Add check constraint for activityType enum values
ALTER TABLE "user_activities" 
ADD CONSTRAINT "CHK_user_activities_activityType" 
CHECK ("activityType" IN (
    'login', 'logout', 'bet_placed', 'bet_settled', 'deposit', 'withdraw',
    'password_change', 'profile_update', 'balance_check', 'casino_play',
    'sports_view', 'casino_view', 'settings_change', 'commission_view'
));

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this query to verify the table was created successfully

SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_activities' 
ORDER BY ordinal_position;
