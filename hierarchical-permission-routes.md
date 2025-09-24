# 🔐 Hierarchical Payment Gateway Permission Routes

## 📋 Overview
This system implements a hierarchical permission structure where:
- **Developers** can grant permissions to **Tech Admins**
- **Tech Admins** can grant permissions to **Admins**

## 🏗️ Permission Hierarchy

```
Developer (Highest Level)
    ↓ grants permissions to
Tech Admin
    ↓ grants permissions to  
Admin (Lower Level)
```

## 🚀 API Routes

### 1. Tech Admin → Admin Permission Routes

#### Grant Permissions to Admin
```http
POST /api/v1/payment-permissions/grant-admin-permissions/:adminId
Authorization: Bearer <tech-admin-token>
Content-Type: application/json

{
  "permissions": {
    "canCreateGateways": true,
    "canManageGateways": true,
    "canAssignGateways": false,
    "canProcessRequests": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment gateway permissions granted to admin successfully",
  "data": {
    "adminId": "admin-uuid",
    "adminName": "Admin Name",
    "permissions": {
      "canCreateGateways": true,
      "canManageGateways": true,
      "canAssignGateways": false,
      "canProcessRequests": true
    },
    "grantedBy": {
      "userId": "techadmin-uuid",
      "userType": "techAdmin",
      "userName": "Tech Admin Name"
    }
  }
}
```

#### Get All Admins for Permission Granting
```http
GET /api/v1/payment-permissions/admins-for-grant
Authorization: Bearer <tech-admin-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "admins": [
      {
        "id": "admin-uuid-1",
        "userName": "Admin One",
        "loginId": "admin1",
        "isActive": true,
        "currentPermissions": {
          "canCreateGateways": false,
          "canManageGateways": false,
          "canAssignGateways": false,
          "canProcessRequests": false
        }
      },
      {
        "id": "admin-uuid-2",
        "userName": "Admin Two", 
        "loginId": "admin2",
        "isActive": true,
        "currentPermissions": {
          "canCreateGateways": true,
          "canManageGateways": true,
          "canAssignGateways": false,
          "canProcessRequests": true
        }
      }
    ]
  }
}
```

### 2. Developer → Tech Admin Permission Routes

#### Grant Permissions to Tech Admin
```http
POST /api/v1/payment-permissions/grant-techadmin-permissions/:techAdminId
Authorization: Bearer <developer-token>
Content-Type: application/json

{
  "permissions": {
    "canCreateGateways": true,
    "canManageGateways": true,
    "canAssignGateways": true,
    "canProcessRequests": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment gateway permissions granted to tech admin successfully",
  "data": {
    "techAdminId": "techadmin-uuid",
    "techAdminName": "Tech Admin Name",
    "permissions": {
      "canCreateGateways": true,
      "canManageGateways": true,
      "canAssignGateways": true,
      "canProcessRequests": true
    },
    "grantedBy": {
      "userId": "developer-uuid",
      "userType": "developer",
      "userName": "Developer Name"
    }
  }
}
```

#### Get All Tech Admins for Permission Granting
```http
GET /api/v1/payment-permissions/techadmins-for-grant
Authorization: Bearer <developer-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "techAdmins": [
      {
        "id": "techadmin-uuid-1",
        "userName": "Tech Admin One",
        "loginId": "techadmin1",
        "isActive": true,
        "currentPermissions": {
          "canCreateGateways": false,
          "canManageGateways": false,
          "canAssignGateways": false,
          "canProcessRequests": false
        }
      },
      {
        "id": "techadmin-uuid-2",
        "userName": "Tech Admin Two",
        "loginId": "techadmin2", 
        "isActive": true,
        "currentPermissions": {
          "canCreateGateways": true,
          "canManageGateways": true,
          "canAssignGateways": true,
          "canProcessRequests": true
        }
      }
    ]
  }
}
```

## 🔒 Permission Types

### Available Permissions:
- **`canCreateGateways`** - Create new payment gateways
- **`canManageGateways`** - Edit/update existing gateways
- **`canAssignGateways`** - Assign gateways to users
- **`canProcessRequests`** - Process deposit/withdrawal requests

### Permission Levels:
- **Full Access** - All permissions enabled
- **Management Access** - Create, manage, and process (no assignment)
- **Basic Access** - Only process requests
- **No Access** - All permissions disabled

## 🧪 Usage Examples

### Example 1: Tech Admin Granting Full Access to Admin
```bash
curl -X POST "http://localhost:7080/api/v1/payment-permissions/grant-admin-permissions/ADMIN_UUID" \
  -H "Authorization: Bearer TECH_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": {
      "canCreateGateways": true,
      "canManageGateways": true,
      "canAssignGateways": true,
      "canProcessRequests": true
    }
  }'
```

### Example 2: Developer Granting Management Access to Tech Admin
```bash
curl -X POST "http://localhost:7080/api/v1/payment-permissions/grant-techadmin-permissions/TECHADMIN_UUID" \
  -H "Authorization: Bearer DEVELOPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": {
      "canCreateGateways": true,
      "canManageGateways": true,
      "canAssignGateways": false,
      "canProcessRequests": true
    }
  }'
```

### Example 3: Tech Admin Viewing Available Admins
```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/admins-for-grant" \
  -H "Authorization: Bearer TECH_ADMIN_TOKEN"
```

### Example 4: Developer Viewing Available Tech Admins
```bash
curl -X GET "http://localhost:7080/api/v1/payment-permissions/techadmins-for-grant" \
  -H "Authorization: Bearer DEVELOPER_TOKEN"
```

## 🔐 Security Features

### 1. Role-Based Access Control
- Only tech admins can grant permissions to admins
- Only developers can grant permissions to tech admins
- Proper authentication required for all operations

### 2. Permission Validation
- Validates permission object structure
- Ensures user exists before granting permissions
- Checks user is active before granting permissions

### 3. Audit Trail
- Records who granted permissions
- Tracks permission changes
- Maintains permission history

## 📊 Frontend Integration

### React Component Example:
```jsx
import React, { useState, useEffect } from 'react';

const PermissionManager = ({ userType, token }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({
    canCreateGateways: false,
    canManageGateways: false,
    canAssignGateways: false,
    canProcessRequests: false
  });

  // Fetch users based on current user type
  useEffect(() => {
    const fetchUsers = async () => {
      const endpoint = userType === 'developer' 
        ? '/api/v1/payment-permissions/techadmins-for-grant'
        : '/api/v1/payment-permissions/admins-for-grant';
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      setUsers(data.data.techAdmins || data.data.admins);
    };

    fetchUsers();
  }, [userType, token]);

  const grantPermissions = async () => {
    const endpoint = userType === 'developer'
      ? `/api/v1/payment-permissions/grant-techadmin-permissions/${selectedUser.id}`
      : `/api/v1/payment-permissions/grant-admin-permissions/${selectedUser.id}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ permissions })
    });

    const result = await response.json();
    
    if (result.success) {
      alert('Permissions granted successfully!');
      // Refresh user list
      window.location.reload();
    } else {
      alert('Error: ' + result.message);
    }
  };

  return (
    <div className="permission-manager">
      <h2>Grant Payment Gateway Permissions</h2>
      
      <div className="user-selection">
        <label>Select User:</label>
        <select onChange={(e) => setSelectedUser(users.find(u => u.id === e.target.value))}>
          <option value="">Choose a user...</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>
              {user.userName} ({user.loginId})
            </option>
          ))}
        </select>
      </div>

      {selectedUser && (
        <div className="permissions-form">
          <h3>Current Permissions for {selectedUser.userName}:</h3>
          <div className="current-permissions">
            <p>Create Gateways: {selectedUser.currentPermissions.canCreateGateways ? '✅' : '❌'}</p>
            <p>Manage Gateways: {selectedUser.currentPermissions.canManageGateways ? '✅' : '❌'}</p>
            <p>Assign Gateways: {selectedUser.currentPermissions.canAssignGateways ? '✅' : '❌'}</p>
            <p>Process Requests: {selectedUser.currentPermissions.canProcessRequests ? '✅' : '❌'}</p>
          </div>

          <h3>Grant New Permissions:</h3>
          <div className="permission-checkboxes">
            <label>
              <input 
                type="checkbox" 
                checked={permissions.canCreateGateways}
                onChange={(e) => setPermissions({...permissions, canCreateGateways: e.target.checked})}
              />
              Can Create Gateways
            </label>
            <label>
              <input 
                type="checkbox" 
                checked={permissions.canManageGateways}
                onChange={(e) => setPermissions({...permissions, canManageGateways: e.target.checked})}
              />
              Can Manage Gateways
            </label>
            <label>
              <input 
                type="checkbox" 
                checked={permissions.canAssignGateways}
                onChange={(e) => setPermissions({...permissions, canAssignGateways: e.target.checked})}
              />
              Can Assign Gateways
            </label>
            <label>
              <input 
                type="checkbox" 
                checked={permissions.canProcessRequests}
                onChange={(e) => setPermissions({...permissions, canProcessRequests: e.target.checked})}
              />
              Can Process Requests
            </label>
          </div>

          <button onClick={grantPermissions} className="grant-button">
            Grant Permissions
          </button>
        </div>
      )}
    </div>
  );
};

export default PermissionManager;
```

## 🎯 Use Cases

### 1. Onboarding New Admins
```javascript
// Tech admin grants basic permissions to new admin
const grantBasicPermissions = async (adminId) => {
  await fetch(`/api/v1/payment-permissions/grant-admin-permissions/${adminId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${techAdminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      permissions: {
        canCreateGateways: false,
        canManageGateways: false,
        canAssignGateways: false,
        canProcessRequests: true  // Start with basic access
      }
    })
  });
};
```

### 2. Promoting Admins
```javascript
// Tech admin promotes admin to full access
const promoteAdmin = async (adminId) => {
  await fetch(`/api/v1/payment-permissions/grant-admin-permissions/${adminId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${techAdminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      permissions: {
        canCreateGateways: true,
        canManageGateways: true,
        canAssignGateways: true,
        canProcessRequests: true  // Full access
      }
    })
  });
};
```

### 3. Emergency Access
```javascript
// Developer grants emergency access to tech admin
const grantEmergencyAccess = async (techAdminId) => {
  await fetch(`/api/v1/payment-permissions/grant-techadmin-permissions/${techAdminId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${developerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      permissions: {
        canCreateGateways: true,
        canManageGateways: true,
        canAssignGateways: true,
        canProcessRequests: true
      }
    })
  });
};
```

## ✅ Benefits

1. **Hierarchical Control** - Clear permission hierarchy
2. **Security** - Role-based access control
3. **Flexibility** - Granular permission control
4. **Audit Trail** - Track who granted what permissions
5. **Easy Management** - Simple API for permission management
6. **Frontend Ready** - Easy to integrate with React/Vue/Angular

## 🚀 Perfect for:

- **Admin dashboards** managing user permissions
- **Onboarding workflows** for new team members
- **Emergency access** scenarios
- **Permission audits** and compliance
- **Role-based UI** showing/hiding features

Now you have a complete hierarchical permission system! 🎉
