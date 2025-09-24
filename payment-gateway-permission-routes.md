# 🔐 Payment Gateway Permission Checking Routes

## 📋 Overview
New routes to check payment gateway permissions for tech admins and admins with detailed information.

## 🔗 Available Routes

### 1. Check Specific User's Payment Gateway Permissions

#### Route 1: Check by User ID Only
```http
GET /api/v1/payment-permissions/check-permissions/:userId
Authorization: Bearer <token>
```

#### Route 2: Check by User ID and User Type
```http
GET /api/v1/payment-permissions/check-permissions/:userId/:userType
Authorization: Bearer <token>
```

**Parameters:**
- `userId` (required): The UUID of the user to check
- `userType` (optional): Specific user type to check (techAdmin, admin, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "userType": "techAdmin",
    "userName": "John Doe",
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

### 2. Get My Own Payment Gateway Permissions

```http
GET /api/v1/payment-permissions/my-permissions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "current-user-uuid",
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

### 3. Get User Payment Gateway Permissions (Basic)

```http
GET /api/v1/payment-permissions/user-permissions/:userId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
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

## 🎯 Use Cases

### 1. Check Tech Admin Permissions
```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/check-permissions/TECH_ADMIN_UUID/techAdmin" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 2. Check Admin Permissions
```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/check-permissions/ADMIN_UUID/admin" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 3. Check Any User's Permissions (Auto-detect user type)
```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/check-permissions/USER_UUID" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 4. Check Your Own Permissions
```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/my-permissions" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔐 Permission Logic

### Who Can Check Permissions:
1. **Users can check their own permissions** (any user type)
2. **Admins with `canAssignGateways` permission** can check anyone's permissions
3. **Developers** have full access

### Permission Types:
- `canCreateGateways`: Can create new payment gateways
- `canManageGateways`: Can update/delete existing gateways
- `canAssignGateways`: Can assign gateways to users
- `canProcessRequests`: Can approve/decline deposit requests

## 📊 Response Fields Explained

### Basic Information:
- `userId`: The user's unique identifier
- `userType`: The user's role (techAdmin, admin, etc.)
- `userName`: Display name or login ID
- `hasPaymentGatewayPermissions`: Boolean indicating if user has any permissions

### Detailed Permissions:
- `permissions`: Object with all permission flags
- `gatewayStats`: Statistics about user's gateway activity
- `permissionSummary`: Simplified permission flags

### Gateway Statistics:
- `assignedGatewaysCount`: Number of gateways assigned to this user
- `createdGatewaysCount`: Number of gateways created by this user

## 🧪 Testing Examples

### Test 1: Check Tech Admin with Full Permissions
```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/check-permissions/TECH_ADMIN_UUID/techAdmin" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "userId": "tech-admin-uuid",
    "userType": "techAdmin",
    "userName": "Tech Admin User",
    "hasPaymentGatewayPermissions": true,
    "permissions": {
      "canCreateGateways": true,
      "canManageGateways": true,
      "canAssignGateways": true,
      "canProcessRequests": true
    },
    "gatewayStats": {
      "assignedGatewaysCount": 0,
      "createdGatewaysCount": 0
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

### Test 2: Check Admin with Limited Permissions
```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/check-permissions/ADMIN_UUID/admin" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "userId": "admin-uuid",
    "userType": "admin",
    "userName": "Admin User",
    "hasPaymentGatewayPermissions": true,
    "permissions": {
      "canCreateGateways": true,
      "canManageGateways": false,
      "canAssignGateways": false,
      "canProcessRequests": true
    },
    "gatewayStats": {
      "assignedGatewaysCount": 2,
      "createdGatewaysCount": 1
    },
    "permissionSummary": {
      "canCreate": true,
      "canManage": false,
      "canAssign": false,
      "canProcess": true
    }
  }
}
```

### Test 3: Check User with No Permissions
```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/check-permissions/USER_UUID" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "userType": "client",
    "userName": "Client User",
    "hasPaymentGatewayPermissions": false,
    "permissions": {
      "canCreateGateways": false,
      "canManageGateways": false,
      "canAssignGateways": false,
      "canProcessRequests": false
    },
    "gatewayStats": {
      "assignedGatewaysCount": 0,
      "createdGatewaysCount": 0
    },
    "permissionSummary": {
      "canCreate": false,
      "canManage": false,
      "canAssign": false,
      "canProcess": false
    }
  }
}
```

## 🚀 Frontend Integration

### React/JavaScript Example
```javascript
// Check user permissions
const checkUserPermissions = async (userId, userType = null) => {
  const url = userType 
    ? `/api/v1/payment-permissions/check-permissions/${userId}/${userType}`
    : `/api/v1/payment-permissions/check-permissions/${userId}`;
    
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('User permissions:', data.data.permissions);
    console.log('Gateway stats:', data.data.gatewayStats);
    return data.data;
  } else {
    console.error('Failed to check permissions:', data.message);
    return null;
  }
};

// Check my own permissions
const checkMyPermissions = async () => {
  const response = await fetch('/api/v1/payment-permissions/my-permissions', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  return data.success ? data.data : null;
};

// Usage examples
const techAdminPermissions = await checkUserPermissions('tech-admin-uuid', 'techAdmin');
const myPermissions = await checkMyPermissions();
```

## ✅ Benefits

1. **Detailed Information**: Get comprehensive permission data
2. **Gateway Statistics**: See user's gateway activity
3. **Flexible Checking**: Check by user ID only or with specific user type
4. **Self-Service**: Users can check their own permissions
5. **Admin Control**: Admins can check anyone's permissions
6. **Security**: Proper permission checks prevent unauthorized access

## 🔧 Error Handling

### Common Error Responses:

#### 400 Bad Request
```json
{
  "success": false,
  "message": "User ID is required"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "You do not have permission to view payment gateway permissions"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "User not found"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Detailed error message"
}
```

These routes provide comprehensive permission checking for your payment gateway system! 🎉
