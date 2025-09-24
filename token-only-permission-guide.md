# 🔐 Token-Only Payment Gateway Permission Checking

## 📋 Overview
Simple routes to check payment gateway permissions using only your authentication token - no need to specify user IDs or user types!

## 🚀 Simple Routes (Token Only)

### 1. Check Your Own Permissions (Detailed)
```http
GET /api/v1/payment-permissions/check-permissions
Authorization: Bearer <your-token>
```

### 2. Check Your Own Permissions (Basic)
```http
GET /api/v1/payment-permissions/my-permissions
Authorization: Bearer <your-token>
```

## 🎯 Super Simple Usage

### Using curl:
```bash
# Check your detailed permissions
curl -X GET "http://localhost:7080/api/v1/payment-permissions/check-permissions" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check your basic permissions
curl -X GET "http://localhost:7080/api/v1/payment-permissions/my-permissions" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Using JavaScript:
```javascript
// Check detailed permissions
const checkPermissions = async () => {
  const response = await fetch('/api/v1/payment-permissions/check-permissions', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  console.log('My permissions:', data.data.permissions);
  console.log('Gateway stats:', data.data.gatewayStats);
};

// Check basic permissions
const checkMyPermissions = async () => {
  const response = await fetch('/api/v1/payment-permissions/my-permissions', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  console.log('My permissions:', data.data.permissions);
};
```

## 📊 Response Examples

### Detailed Response (`/check-permissions`):
```json
{
  "success": true,
  "data": {
    "userId": "your-user-uuid",
    "userType": "techAdmin",
    "userName": "Your Name",
    "hasPaymentGatewayPermissions": true,
    "permissions": {
      "canCreateGateways": true,
      "canManageGateways": true,
      "canAssignGateways": true,
      "canProcessRequests": true
    },
    "gatewayStats": {
      "assignedGatewaysCount": 5,
      "createdGatewaysCount": 3
    },
    "permissionSummary": {
      "canCreate": true,
      "canManage": true,
      "canAssign": true,
      "canProcess": true
    }
  }
}
```

### Basic Response (`/my-permissions`):
```json
{
  "success": true,
  "data": {
    "userId": "your-user-uuid",
    "userType": "techAdmin",
    "permissions": {
      "canCreateGateways": true,
      "canManageGateways": true,
      "canAssignGateways": true,
      "canProcessRequests": true
    }
  }
}
```

## 🔧 Advanced Usage (Still Available)

If you need to check other users' permissions (as an admin), you can still use:

```bash
# Check specific user's permissions
curl -X GET "http://localhost:7080/api/v1/payment-permissions/check-permissions/USER_UUID" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Check specific user type's permissions
curl -X GET "http://localhost:7080/api/v1/payment-permissions/check-permissions/USER_UUID/techAdmin" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## 🎯 Use Cases

### 1. Frontend Permission Checks
```javascript
// Check if user can create gateways
const canCreateGateways = async () => {
  const response = await fetch('/api/v1/payment-permissions/check-permissions', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  return data.data.permissions.canCreateGateways;
};

// Show/hide UI elements based on permissions
if (await canCreateGateways()) {
  document.getElementById('create-gateway-btn').style.display = 'block';
}
```

### 2. API Route Protection
```javascript
// Middleware to check permissions
const requirePaymentGatewayPermission = (permission) => {
  return async (req, res, next) => {
    const response = await fetch('/api/v1/payment-permissions/check-permissions', {
      headers: { 'Authorization': req.headers.authorization }
    });
    
    const data = await response.json();
    
    if (!data.data.permissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `You need ${permission} permission`
      });
    }
    
    next();
  };
};

// Use in routes
app.post('/create-gateway', 
  requirePaymentGatewayPermission('canCreateGateways'),
  createGateway
);
```

### 3. Dashboard Statistics
```javascript
// Get user's gateway statistics
const getUserStats = async () => {
  const response = await fetch('/api/v1/payment-permissions/check-permissions', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  
  return {
    canCreate: data.data.permissions.canCreateGateways,
    canManage: data.data.permissions.canManageGateways,
    assignedGateways: data.data.gatewayStats.assignedGatewaysCount,
    createdGateways: data.data.gatewayStats.createdGatewaysCount
  };
};
```

## ✅ Benefits

1. **Super Simple**: Just use your token, no user IDs needed
2. **Automatic**: Automatically detects your user type
3. **Comprehensive**: Get detailed permissions and statistics
4. **Flexible**: Still supports checking other users if needed
5. **Secure**: Proper permission checks prevent unauthorized access

## 🧪 Quick Test

```bash
# Test with your token
curl -X GET "http://localhost:7080/api/v1/payment-permissions/check-permissions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## 🚀 Perfect for:

- **Frontend applications** checking user permissions
- **API middleware** protecting routes
- **Dashboard widgets** showing user capabilities
- **Quick permission checks** during development
- **User onboarding** showing available features

Now you can check payment gateway permissions with just your token! 🎉
