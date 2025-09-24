# 🚀 Payment Gateway Implementation for Whitelist

## 📋 Overview
Your payment gateway system is fully implemented and ready to use! Here are all the routes and implementation details for enabling payment gateway functionality in your whitelist system.

## 🔗 Base URLs
- **Main Server**: `http://localhost:7080` (your current server)
- **Payment Gateway Routes**: `/api/v1/payment/*`
- **Payment Permissions Routes**: `/api/v1/payment-permissions/*`

## 📊 Complete Route Reference

### 1. Payment Gateway Management Routes (`/api/v1/payment/*`)

#### Create Payment Gateway
```http
POST /api/v1/payment/createpaymentgateway
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "gatewayMethod": "UPI",
  "gatewayDetails": {
    "minAmount": 100,
    "maxAmount": 50000,
    "upiId": "your-upi@paytm",
    "accountHolder": "Your Name"
  },
  "notes": "Primary UPI gateway"
}
```

#### Get Created Gateways (Admin Users)
```http
GET /api/v1/payment/paymentgateway/created/getall
Authorization: Bearer <token>
```

#### Update Payment Gateway
```http
PATCH /api/v1/payment/updatepaymentgateway/:id
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "gatewayMethod": "Bank Transfer",
  "gatewayDetails": {
    "minAmount": 500,
    "maxAmount": 100000,
    "accountNumber": "1234567890",
    "ifscCode": "SBIN0001234"
  }
}
```

#### Delete Payment Gateway
```http
DELETE /api/v1/payment/deletepaymentgateway/:id
Authorization: Bearer <token>
```

#### Toggle Gateway Status
```http
PATCH /api/v1/payment/paymentgateway/activateDeactivate/:id
Authorization: Bearer <token>
```

#### Get Assigned Gateways (Clients)
```http
GET /api/v1/payment/paymentgateway/assigned/getall
Authorization: Bearer <token>
```

### 2. Payment Gateway Permissions Routes (`/api/v1/payment-permissions/*`)

#### Grant Payment Gateway Permissions
```http
POST /api/v1/payment-permissions/grant-permissions
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "user-uuid",
  "userType": "techAdmin",
  "permissions": {
    "canCreateGateways": true,
    "canManageGateways": true,
    "canAssignGateways": true,
    "canProcessRequests": true
  }
}
```

#### Get User Payment Gateway Permissions
```http
GET /api/v1/payment-permissions/user-permissions/:userId
Authorization: Bearer <token>
```

#### Get My Payment Gateway Permissions
```http
GET /api/v1/payment-permissions/my-permissions
Authorization: Bearer <token>
```

#### Assign Gateway to User
```http
POST /api/v1/payment-permissions/assign-gateway
Authorization: Bearer <token>
Content-Type: application/json

{
  "gatewayId": "gateway-uuid",
  "assignedToUserId": "user-uuid",
  "assignedToUserType": "techAdmin",
  "notes": "Primary gateway assignment"
}
```

#### Get Assigned Gateways for User
```http
GET /api/v1/payment-permissions/assigned-gateways/:userId
Authorization: Bearer <token>
```

#### Remove Gateway Assignment
```http
DELETE /api/v1/payment-permissions/remove-assignment/:assignmentId
Authorization: Bearer <token>
```

### 3. Deposit Request Routes (`/api/v1/payment/*`)

#### Create Deposit Request (Clients)
```http
POST /api/v1/payment/createdepositrequest
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "gatewayId": "gateway-uuid",
  "amount": 1000,
  "paymentProof": <file>
}
```

#### Get My Deposit Requests (Clients)
```http
GET /api/v1/payment/getmydepositrequest
Authorization: Bearer <token>
```

#### Get Incoming Deposit Requests (Admins)
```http
GET /api/v1/payment/recievingDepositRequest
Authorization: Bearer <token>
```

#### Update Deposit Request (Approve/Decline)
```http
PUT /api/v1/payment/updateDepositRequest/:requestId
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "Approved", // or "Declined"
  "reason": "Payment verified successfully" // optional for decline
}
```

## 🔧 Whitelist Integration

### Step 1: Enable Payment Gateway Permissions in Whitelist

Run this SQL in pgAdmin:
```sql
-- Replace 'YOUR_WHITELIST_ID' with your actual whitelist ID
UPDATE whitelist_updated 
SET "paymentGatewayPermissions" = '{
  "canCreateGateways": true,
  "canManageGateways": true,
  "canAssignGateways": true,
  "canProcessRequests": true
}'
WHERE id = 'YOUR_WHITELIST_ID';
```

### Step 2: Check Whitelist Permissions
```http
GET /api/v1/payment-permissions/my-permissions
Authorization: Bearer <whitelist-token>
```

### Step 3: Create Payment Gateways
```http
POST /api/v1/payment/createpaymentgateway
Authorization: Bearer <whitelist-token>
Content-Type: multipart/form-data

{
  "gatewayMethod": "UPI",
  "gatewayDetails": {
    "minAmount": 100,
    "maxAmount": 50000,
    "upiId": "your-upi@paytm",
    "accountHolder": "Your Name"
  }
}
```

### Step 4: Assign Gateways to Tech Admin
```http
POST /api/v1/payment-permissions/assign-gateway
Authorization: Bearer <whitelist-token>
Content-Type: application/json

{
  "gatewayId": "gateway-uuid",
  "assignedToUserId": "tech-admin-uuid",
  "assignedToUserType": "techAdmin"
}
```

## 🎯 Sample Gateway Configurations

### UPI Gateway
```json
{
  "gatewayMethod": "UPI",
  "gatewayDetails": {
    "minAmount": 100,
    "maxAmount": 50000,
    "upiId": "your-upi@paytm",
    "accountHolder": "Your Name"
  }
}
```

### Bank Transfer Gateway
```json
{
  "gatewayMethod": "Bank Transfer",
  "gatewayDetails": {
    "minAmount": 500,
    "maxAmount": 100000,
    "accountNumber": "1234567890",
    "ifscCode": "SBIN0001234",
    "accountHolder": "Your Name",
    "bankName": "State Bank of India",
    "branchName": "Main Branch"
  }
}
```

### Paytm Gateway
```json
{
  "gatewayMethod": "Paytm",
  "gatewayDetails": {
    "minAmount": 100,
    "maxAmount": 25000,
    "phoneNumber": "9876543210",
    "accountHolder": "Your Name"
  }
}
```

### PhonePe Gateway
```json
{
  "gatewayMethod": "PhonePe",
  "gatewayDetails": {
    "minAmount": 100,
    "maxAmount": 25000,
    "phoneNumber": "9876543210",
    "accountHolder": "Your Name"
  }
}
```

## 🔐 Authentication & Authorization

### Required Headers
```http
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

### User Roles & Permissions
- **Developer**: Full access to all payment gateway features
- **TechAdmin**: Can create, manage, and assign gateways
- **Admin**: Can create, manage, and assign gateways
- **MiniAdmin**: Can create, manage, and assign gateways
- **SuperMaster**: Can create, manage, and assign gateways
- **Master**: Can create, manage, and assign gateways
- **SuperAgent**: Can create, manage, and assign gateways
- **Agent**: Can create, manage, and assign gateways
- **Client**: Can view assigned gateways and create deposit requests

## 📱 Frontend Integration Examples

### React/JavaScript Example
```javascript
// Create Payment Gateway
const createGateway = async (gatewayData) => {
  const formData = new FormData();
  formData.append('gatewayMethod', gatewayData.method);
  formData.append('gatewayDetails', JSON.stringify(gatewayData.details));
  
  const response = await fetch('/api/v1/payment/createpaymentgateway', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
};

// Get My Permissions
const getMyPermissions = async () => {
  const response = await fetch('/api/v1/payment-permissions/my-permissions', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};

// Assign Gateway to User
const assignGateway = async (gatewayId, userId, userType) => {
  const response = await fetch('/api/v1/payment-permissions/assign-gateway', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      gatewayId,
      assignedToUserId: userId,
      assignedToUserType: userType
    })
  });
  
  return response.json();
};
```

## 🧪 Testing Your Implementation

### 1. Test Server Connection
```bash
curl -X GET http://localhost:7080/api/v1/payment-permissions/my-permissions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Test Gateway Creation
```bash
curl -X POST http://localhost:7080/api/v1/payment/createpaymentgateway \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gatewayMethod": "UPI",
    "gatewayDetails": {
      "minAmount": 100,
      "maxAmount": 50000,
      "upiId": "test@paytm",
      "accountHolder": "Test User"
    }
  }'
```

### 3. Test Gateway Assignment
```bash
curl -X POST http://localhost:7080/api/v1/payment-permissions/assign-gateway \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gatewayId": "GATEWAY_UUID",
    "assignedToUserId": "USER_UUID",
    "assignedToUserType": "techAdmin"
  }'
```

## 📊 Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "id": "uuid",
    "gatewayMethod": "UPI",
    "gatewayDetails": {...},
    "isActive": true,
    "createdAt": "2024-09-24T00:00:00.000Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error description"
}
```

## 🚀 Quick Start Checklist

- [ ] ✅ Server is running on port 7080
- [ ] ✅ Payment gateway routes are registered
- [ ] ✅ Whitelist has payment gateway permissions enabled
- [ ] ✅ Tech admin can create payment gateways
- [ ] ✅ Tech admin can assign gateways to users
- [ ] ✅ Clients can view assigned gateways
- [ ] ✅ Clients can create deposit requests
- [ ] ✅ Admins can process deposit requests
- [ ] ✅ File uploads work for payment proofs
- [ ] ✅ Activity tracking is working

## 🆘 Troubleshooting

### Common Issues:
1. **401 Unauthorized**: Check your JWT token
2. **403 Forbidden**: Verify user has payment gateway permissions
3. **404 Not Found**: Check if gateway/user exists
4. **500 Internal Error**: Check server logs for detailed error

### Debug Endpoints:
- Check permissions: `GET /api/v1/payment-permissions/my-permissions`
- View all gateways: `GET /api/v1/payment/paymentgateway/created/getall`
- View assignments: `GET /api/v1/payment-permissions/assigned-gateways/USER_ID`

Your payment gateway system is fully functional and ready to use! 🎉
