# 🎯 **Enhanced Whitelist System - Multiple URLs & Panel-Specific Settings**

## 📋 **Overview**

The Whitelist system has been enhanced to support:
1. **Multiple Client URLs** - Support for multiple client domains
2. **Panel-Specific Settings** - Separate configurations for different user types (client, admin, techAdmin)
3. **Sport/Casino Separation** - Different settings for sports and casino panels

## 🚀 **New Features**

### **1. Multiple Client URLs Support**

#### **Database Schema:**
```sql
-- New columns added to whitelists table
ALTER TABLE whitelists ADD COLUMN "ClientUrls" text[] DEFAULT ARRAY[]::text[];
ALTER TABLE whitelists ADD COLUMN "panelSettings" jsonb;
```

#### **Entity Structure:**
```typescript
// Whitelist.ts
@Column("text", { array: true, default: () => "ARRAY[]::text[]" })
ClientUrls!: string[];

@Column({ type: 'jsonb', nullable: true })
panelSettings!: {
  client?: {
    sports?: { /* sports settings */ };
    casino?: { /* casino settings */ };
    theme?: { /* theme settings */ };
  };
  admin?: { /* admin settings */ };
  techAdmin?: { /* techAdmin settings */ };
} | null;
```

### **2. Panel-Specific Settings Structure**

```typescript
interface PanelSettings {
  client?: {
    sports?: {
      matchOdd?: string[];
      matchOddOptions?: string[][];
      bookMakerOdd?: string[];
      normalOdd?: string[];
      refundOptionIsActive?: boolean;
      refundPercentage?: number;
      refundLimit?: number;
      minDeposit?: number;
    };
    casino?: {
      gameTypes?: string[];
      minBet?: number;
      maxBet?: number;
      refundOptionIsActive?: boolean;
      refundPercentage?: number;
      refundLimit?: number;
      minDeposit?: number;
    };
    theme?: {
      primaryBackground?: string;
      primaryBackground90?: string;
      secondaryBackground?: string;
      secondaryBackground70?: string;
      secondaryBackground85?: string;
      textPrimary?: string;
      textSecondary?: string;
    };
  };
  admin?: {
    sports?: { /* admin sports settings */ };
    casino?: { /* admin casino settings */ };
  };
  techAdmin?: {
    sports?: { /* techAdmin sports settings */ };
    casino?: { /* techAdmin casino settings */ };
  };
}
```

## 🔧 **API Usage Examples**

### **1. Create Whitelist with Multiple URLs**

```bash
curl -X POST "http://localhost:7080/api/v1/whitelists/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "TechAdminUrl": "https://techadmin.example.com",
    "AdminUrl": "https://admin.example.com",
    "ClientUrl": "https://example.com",
    "ClientUrls": [
      "https://example.com",
      "https://www.example.com",
      "https://mobile.example.com",
      "https://app.example.com"
    ],
    "CommonName": "Example Exchange",
    "panelSettings": {
      "client": {
        "sports": {
          "matchOdd": ["Back", "Lay"],
          "matchOddOptions": [["b3","b2","b1"], ["l1","l2","l3"]],
          "bookMakerOdd": ["Back", "Lay"],
          "normalOdd": ["No", "Yes"],
          "refundOptionIsActive": true,
          "refundPercentage": 10,
          "refundLimit": 1000,
          "minDeposit": 100
        },
        "casino": {
          "gameTypes": ["teen20", "poker", "goal", "ab3"],
          "minBet": 10,
          "maxBet": 50000,
          "refundOptionIsActive": false,
          "refundPercentage": 0,
          "refundLimit": 0,
          "minDeposit": 50
        },
        "theme": {
          "primaryBackground": "#1a1a1a",
          "primaryBackground90": "#1a1a1ae6",
          "secondaryBackground": "#2d2d2d",
          "secondaryBackground70": "#2d2d2db3",
          "secondaryBackground85": "#2d2d2de6",
          "textPrimary": "#ffffff",
          "textSecondary": "#cccccc"
        }
      },
      "admin": {
        "sports": {
          "matchOdd": ["Back", "Lay"],
          "matchOddOptions": [["b3","b2","b1"], ["l1","l2","l3"]],
          "bookMakerOdd": ["Back", "Lay"],
          "normalOdd": ["No", "Yes"]
        },
        "casino": {
          "gameTypes": ["teen20", "poker", "goal", "ab3", "teen6", "teen41"],
          "minBet": 5,
          "maxBet": 100000
        }
      },
      "techAdmin": {
        "sports": {
          "matchOdd": ["Back", "Lay"],
          "matchOddOptions": [["b3","b2","b1"], ["l1","l2","l3"]],
          "bookMakerOdd": ["Back", "Lay"],
          "normalOdd": ["No", "Yes"]
        },
        "casino": {
          "gameTypes": ["teen20", "poker", "goal", "ab3", "teen6", "teen41", "superover"],
          "minBet": 1,
          "maxBet": 500000
        }
      }
    },
    "paymentGatewayPermissions": {
      "canCreateGateways": true,
      "canManageGateways": true,
      "canAssignGateways": true,
      "canProcessRequests": true
    }
  }'
```

### **2. Get Whitelist by URL with User Type**

```bash
# Get client panel settings
curl -X GET "http://localhost:7080/api/v1/whitelists/single?url=https://example.com&userType=client" \
  -H "Content-Type: application/json"

# Get admin panel settings  
curl -X GET "http://localhost:7080/api/v1/whitelists/single?url=https://admin.example.com&userType=admin" \
  -H "Content-Type: application/json"

# Get techAdmin panel settings
curl -X GET "http://localhost:7080/api/v1/whitelists/single?url=https://techadmin.example.com&userType=techAdmin" \
  -H "Content-Type: application/json"
```

### **3. Response Structure**

```json
{
  "data": {
    "id": "uuid",
    "TechAdminUrl": "https://techadmin.example.com",
    "AdminUrl": "https://admin.example.com", 
    "ClientUrl": "https://example.com",
    "ClientUrls": [
      "https://example.com",
      "https://www.example.com",
      "https://mobile.example.com",
      "https://app.example.com"
    ],
    "CommonName": "Example Exchange",
    "panelSettings": {
      "sports": {
        "matchOdd": ["Back", "Lay"],
        "matchOddOptions": [["b3","b2","b1"], ["l1","l2","l3"]],
        "bookMakerOdd": ["Back", "Lay"],
        "normalOdd": ["No", "Yes"],
        "refundOptionIsActive": true,
        "refundPercentage": 10,
        "refundLimit": 1000,
        "minDeposit": 100
      },
      "casino": {
        "gameTypes": ["teen20", "poker", "goal", "ab3"],
        "minBet": 10,
        "maxBet": 50000,
        "refundOptionIsActive": false,
        "refundPercentage": 0,
        "refundLimit": 0,
        "minDeposit": 50
      },
      "theme": {
        "primaryBackground": "#1a1a1a",
        "primaryBackground90": "#1a1a1ae6",
        "secondaryBackground": "#2d2d2d",
        "secondaryBackground70": "#2d2d2db3",
        "secondaryBackground85": "#2d2d2de6",
        "textPrimary": "#ffffff",
        "textSecondary": "#cccccc"
      }
    },
    "allClientUrls": [
      "https://example.com",
      "https://www.example.com", 
      "https://mobile.example.com",
      "https://app.example.com"
    ],
    "paymentGatewayPermissions": {
      "canCreateGateways": true,
      "canManageGateways": true,
      "canAssignGateways": true,
      "canProcessRequests": true
    }
  },
  "userType": "client",
  "panelSettings": {
    "sports": { /* user-specific sports settings */ },
    "casino": { /* user-specific casino settings */ },
    "theme": { /* user-specific theme settings */ }
  }
}
```

## 🛠 **Helper Methods**

The Whitelist entity includes helper methods for easy access:

```typescript
// Get all client URLs (including primary ClientUrl)
const allUrls = whitelist.getAllClientUrls();

// Get client-specific settings
const clientSportsSettings = whitelist.getClientSportsSettings();
const clientCasinoSettings = whitelist.getClientCasinoSettings();
const clientThemeSettings = whitelist.getClientThemeSettings();

// Get admin-specific settings
const adminSportsSettings = whitelist.getAdminSportsSettings();
const adminCasinoSettings = whitelist.getAdminCasinoSettings();

// Get techAdmin-specific settings
const techAdminSportsSettings = whitelist.getTechAdminSportsSettings();
const techAdminCasinoSettings = whitelist.getTechAdminCasinoSettings();

// Check if URL is whitelisted
const isWhitelisted = whitelist.isUrlWhitelisted('https://example.com');

// Get panel settings for specific user type
const userSettings = whitelist.getPanelSettingsForUserType('client');
```

## 🔍 **Database Queries**

The system now supports enhanced URL matching:

```sql
-- Find whitelist by any URL (including ClientUrls array)
SELECT * FROM whitelists 
WHERE "ClientUrl" = $1 
   OR "AdminUrl" = $1 
   OR "TechAdminUrl" = $1
   OR $1 = ANY("ClientUrls")
LIMIT 1;

-- Check for URL conflicts during creation
SELECT * FROM whitelists 
WHERE "TechAdminUrl" = ANY($1) 
   OR "AdminUrl" = ANY($1) 
   OR "ClientUrl" = ANY($1)
   OR "ClientUrls" && $1;
```

## 🎯 **Use Cases**

### **1. Multi-Domain Support**
- **Primary Domain**: `https://example.com`
- **Subdomains**: `https://www.example.com`, `https://mobile.example.com`
- **App Domains**: `https://app.example.com`

### **2. Panel-Specific Configuration**
- **Client Panel**: Sports betting with specific odds, casino games with limits
- **Admin Panel**: Different sports/casino settings for admin users
- **TechAdmin Panel**: Full access to all games and settings

### **3. Sport vs Casino Separation**
- **Sports Settings**: Match odds, refund policies, minimum deposits
- **Casino Settings**: Game types, bet limits, different refund policies

## ✅ **Benefits**

1. **Flexibility**: Support multiple domains and subdomains
2. **Customization**: Different settings per user type
3. **Separation**: Sports and casino can have independent configurations
4. **Backward Compatibility**: Legacy fields still work
5. **Performance**: Optimized queries with proper indexing
6. **Scalability**: Easy to add new panel types and settings

## 🚀 **Ready for Production**

The enhanced whitelist system is now fully functional and ready for production use with:
- ✅ Multiple client URL support
- ✅ Panel-specific settings
- ✅ Sport/casino separation
- ✅ Payment gateway permissions
- ✅ Database migration completed
- ✅ API endpoints working
- ✅ Helper methods available
- ✅ Backward compatibility maintained
