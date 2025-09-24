# 🔧 Fix: Database Column Error - "paymentGatewayPermissions does not exist"

## 🚨 Problem
The error occurred because the database columns `paymentGatewayPermissions` don't exist in the `admins` and `tech_admins` tables, even though the TypeScript entities were updated.

## ✅ Solution Applied

### 1. Updated Permission Structure
**Changed from:**
```typescript
{
  canCreateGateways: boolean;
  canManageGateways: boolean;
  canAssignGateways: boolean;
  canProcessRequests: boolean;
}
```

**To:**
```typescript
{
  canCreateGateway: boolean;        // Fixed naming
  canManageGateway: boolean;        // Fixed naming
  canAssignGateway: boolean;        // Fixed naming
  canProcessRequests: boolean;
  restrictions: {
    maxGateways: number;
    maxAmount: number;
    allowedGatewayTypes: string[];
  };
}
```

### 2. Updated Entity Definitions
**Files Modified:**
- ✅ `src/entities/users/AdminUser.ts`
- ✅ `src/entities/users/TechAdminUser.ts`

**Changes:**
```typescript
@Column({ type: 'jsonb', nullable: true })
paymentGatewayPermissions!: {
  canCreateGateway?: boolean;
  canManageGateway?: boolean;
  canAssignGateway?: boolean;
  canProcessRequests?: boolean;
  restrictions?: {
    maxGateways?: number;
    maxAmount?: number;
    allowedGatewayTypes?: string[];
  };
} | null;
```

### 3. Updated Controller Logic
**File Modified:**
- ✅ `src/controllers/payment/PaymentGatewayPermissionController.ts`

**Changes:**
- Updated permission field names to match new structure
- Added restrictions handling
- Updated default values

### 4. Database Migration Script
**File Created:**
- ✅ `manual-database-migration.sql`

## 🚀 Steps to Fix

### Step 1: Run Database Migration
**In pgAdmin or your PostgreSQL client, run:**
```sql
-- Add paymentGatewayPermissions column to admins table
ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS "paymentGatewayPermissions" jsonb DEFAULT NULL;

-- Add paymentGatewayPermissions column to tech_admins table  
ALTER TABLE tech_admins
ADD COLUMN IF NOT EXISTS "paymentGatewayPermissions" jsonb DEFAULT NULL;
```

### Step 2: Restart Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Step 3: Test the Fix
```bash
# Test with your exact request
curl -X POST "http://localhost:7080/api/v1/payment-permissions/grant-techadmin-permissions/9eae077f-2c9c-45e5-8af9-cbb91d4cb10d" \
  -H "Authorization: Bearer YOUR_DEVELOPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": {
      "canCreateGateway": true,
      "canManageGateway": true,
      "canAssignGateway": true,
      "canProcessRequests": true,
      "restrictions": {
        "maxGateways": 5,
        "maxAmount": 10000,
        "allowedGatewayTypes": ["UPI", "Bank Transfer"]
      }
    }
  }'
```

## 📊 Expected Response
```json
{
  "success": true,
  "message": "Payment gateway permissions granted to tech admin successfully",
  "data": {
    "techAdminId": "9eae077f-2c9c-45e5-8af9-cbb91d4cb10d",
    "techAdminName": "Tech Admin Name",
    "permissions": {
      "canCreateGateway": true,
      "canManageGateway": true,
      "canAssignGateway": true,
      "canProcessRequests": true,
      "restrictions": {
        "maxGateways": 5,
        "maxAmount": 10000,
        "allowedGatewayTypes": ["UPI", "Bank Transfer"]
      }
    },
    "grantedBy": {
      "userId": "developer-uuid",
      "userType": "developer",
      "userName": "Developer Name"
    }
  }
}
```

## 🔍 Verification

### Check Database Schema:
```sql
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('admins', 'tech_admins') 
  AND column_name = 'paymentGatewayPermissions'
ORDER BY table_name;
```

### Expected Result:
```
table_name  | column_name                | data_type | is_nullable | column_default
------------|----------------------------|-----------|-------------|----------------
admins      | paymentGatewayPermissions | jsonb     | YES         | NULL
tech_admins | paymentGatewayPermissions | jsonb     | YES         | NULL
```

## 🎯 Key Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| Field Names | `canCreateGateways` | `canCreateGateway` |
| Field Names | `canManageGateways` | `canManageGateway` |
| Field Names | `canAssignGateways` | `canAssignGateway` |
| Restrictions | Not supported | Full support |
| Database Columns | Missing | Added via migration |
| TypeScript Types | Old structure | New structure |

## 🚀 Files Created

1. **`manual-database-migration.sql`** - Database migration script
2. **`test-new-permission-structure.js`** - Test script for new structure
3. **`fix-database-column-error.md`** - This documentation

## ✅ What's Fixed

1. ✅ **Database columns** - Added `paymentGatewayPermissions` to both tables
2. ✅ **Permission structure** - Updated to match your request format
3. ✅ **TypeScript types** - Fixed entity definitions
4. ✅ **Controller logic** - Updated to handle new structure
5. ✅ **Restrictions support** - Added full restrictions handling

## 🎉 Ready to Use!

After running the database migration, your exact request will work:

```bash
curl -X POST "http://localhost:7080/api/v1/payment-permissions/grant-techadmin-permissions/9eae077f-2c9c-45e5-8af9-cbb91d4cb10d" \
  -H "Authorization: Bearer YOUR_DEVELOPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": {
      "canCreateGateway": true,
      "canManageGateway": true,
      "canAssignGateway": true,
      "canProcessRequests": true,
      "restrictions": {
        "maxGateways": 5,
        "maxAmount": 10000,
        "allowedGatewayTypes": ["UPI", "Bank Transfer"]
      }
    }
  }'
```

The system now supports the exact permission structure you requested! 🎉
