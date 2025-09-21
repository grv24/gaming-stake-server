# Balance Management API Documentation

## Overview
The Balance Management API provides comprehensive functionality for managing user balances, credit references, and financial operations in the gaming platform. This API is designed for Admin and TechAdmin users to handle the dashboard functionality shown in the balance management interface.

## Base URL
```
http://localhost:7080/api/v1/balance
```

## Authentication
All endpoints require proper authentication and authorization for Admin/TechAdmin users.

---

## Endpoints

### 1. Get Balance Dashboard
**GET** `/dashboard/:userId/:userType`

Retrieves the complete balance dashboard for a specific user, including all financial metrics.

#### Parameters
- `userId` (string): The unique identifier of the user
- `userType` (string): The type of user (techAdmin, admin, miniAdmin, superMaster, master, superAgent, agent, client)

#### Response
```json
{
  "success": true,
  "data": {
    "upperLevelCreditReference": 200000,
    "totalMasterBalance": 173237.75,
    "availableBalance": 85189,
    "downLevelOccupyBalance": 88048.75,
    "upperLevelOccupyBalance": 47765,
    "upperLevel": 26762.25,
    "availableBalanceWithProfitLoss": 85189,
    "downLevelCreditReference": 99000,
    "downLevelProfitLoss": -10951.25,
    "myProfitLoss": 0
  },
  "message": "Balance dashboard retrieved successfully"
}
```

#### cURL Example
```bash
curl -X GET "http://localhost:7080/api/v1/balance/dashboard/user123/admin" \
  -H "Content-Type: application/json"
```

---

### 2. Get Balance Summary
**GET** `/summary/:userId/:userType`

Retrieves a concise balance summary for a user.

#### Parameters
- `userId` (string): The unique identifier of the user
- `userType` (string): The type of user

#### Response
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "userType": "admin",
    "currentBalance": 173237.75,
    "availableBalance": 85189,
    "profitLoss": 0,
    "creditReference": 200000,
    "downlineBalance": 88048.75,
    "downlineProfitLoss": -10951.25,
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  },
  "message": "Balance summary retrieved successfully"
}
```

#### cURL Example
```bash
curl -X GET "http://localhost:7080/api/v1/balance/summary/user123/admin" \
  -H "Content-Type: application/json"
```

---

### 3. Transfer Balance
**POST** `/transfer`

Transfers balance between two users with different transfer types.

#### Request Body
```json
{
  "fromUserId": "user123",
  "toUserId": "user456",
  "amount": 1000,
  "transferType": "credit",
  "remarks": "Balance transfer for settlement"
}
```

#### Transfer Types
- `credit`: Transfer from sender to receiver
- `debit`: Transfer from receiver to sender
- `settlement`: Settlement transfer (adjusts uplineSettlement)

#### Response
```json
{
  "success": true,
  "message": "Successfully transferred 1000 via credit",
  "data": {
    "fromUserId": "user123",
    "toUserId": "user456",
    "amount": 1000,
    "transferType": "credit"
  }
}
```

#### cURL Example
```bash
curl -X POST "http://localhost:7080/api/v1/balance/transfer" \
  -H "Content-Type: application/json" \
  -d '{
    "fromUserId": "user123",
    "toUserId": "user456",
    "amount": 1000,
    "transferType": "credit",
    "remarks": "Balance transfer for settlement"
  }'
```

---

### 4. Update Credit Reference
**PUT** `/credit-reference`

Updates the credit reference amount for a user.

#### Request Body
```json
{
  "userId": "user123",
  "newCreditRef": 250000,
  "remarks": "Updated credit reference limit"
}
```

#### Response
```json
{
  "success": true,
  "message": "Credit reference updated from 200000 to 250000",
  "data": {
    "userId": "user123",
    "newCreditRef": 250000
  }
}
```

#### cURL Example
```bash
curl -X PUT "http://localhost:7080/api/v1/balance/credit-reference" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "newCreditRef": 250000,
    "remarks": "Updated credit reference limit"
  }'
```

---

### 5. Adjust Balance
**POST** `/adjust`

Adjusts various balance components for a user.

#### Request Body
```json
{
  "userId": "user123",
  "adjustmentType": "balance",
  "amount": 5000,
  "operation": "add",
  "remarks": "Balance adjustment for bonus"
}
```

#### Adjustment Types
- `balance`: Main balance
- `profitLoss`: Profit/Loss amount
- `liability`: Liability amount
- `exposure`: Exposure amount

#### Operations
- `add`: Add amount to current value
- `subtract`: Subtract amount from current value
- `set`: Set to specific amount

#### Response
```json
{
  "success": true,
  "message": "balance add: 173237.75 → 178237.75",
  "data": {
    "userId": "user123",
    "adjustmentType": "balance",
    "amount": 5000,
    "operation": "add"
  }
}
```

#### cURL Example
```bash
curl -X POST "http://localhost:7080/api/v1/balance/adjust" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "adjustmentType": "balance",
    "amount": 5000,
    "operation": "add",
    "remarks": "Balance adjustment for bonus"
  }'
```

---

### 6. Bulk Balance Adjustment
**POST** `/bulk-adjust`

Performs balance adjustments for multiple users in a single operation.

#### Request Body
```json
{
  "adjustments": [
    {
      "userId": "user123",
      "adjustmentType": "balance",
      "amount": 1000,
      "operation": "add",
      "remarks": "Bulk adjustment 1"
    },
    {
      "userId": "user456",
      "adjustmentType": "profitLoss",
      "amount": 500,
      "operation": "subtract",
      "remarks": "Bulk adjustment 2"
    }
  ]
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "successful": [
      {
        "userId": "user123",
        "success": true,
        "message": "balance add: 173237.75 → 174237.75"
      },
      {
        "userId": "user456",
        "success": true,
        "message": "profitLoss subtract: 1000 → 500"
      }
    ],
    "failed": []
  },
  "message": "Bulk adjustment completed: 2 successful, 0 failed"
}
```

#### cURL Example
```bash
curl -X POST "http://localhost:7080/api/v1/balance/bulk-adjust" \
  -H "Content-Type: application/json" \
  -d '{
    "adjustments": [
      {
        "userId": "user123",
        "adjustmentType": "balance",
        "amount": 1000,
        "operation": "add",
        "remarks": "Bulk adjustment 1"
      },
      {
        "userId": "user456",
        "adjustmentType": "profitLoss",
        "amount": 500,
        "operation": "subtract",
        "remarks": "Bulk adjustment 2"
      }
    ]
  }'
```

---

### 7. Get Balance History
**GET** `/history/:userId`

Retrieves the balance transaction history for a user.

#### Parameters
- `userId` (string): The unique identifier of the user
- `limit` (query, optional): Number of records to return (default: 50)

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "userId": "user123",
      "transactionType": "transfer",
      "amount": 1000,
      "balance": 5000,
      "remarks": "Balance transfer",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "message": "Balance history retrieved successfully"
}
```

#### cURL Example
```bash
curl -X GET "http://localhost:7080/api/v1/balance/history/user123?limit=20" \
  -H "Content-Type: application/json"
```

---

### 8. Get Occupy Balance Information
**GET** `/occupy/:userId/:userType`

Retrieves specific occupy balance information for a user, focusing on upper and down level occupy balances.

#### Parameters
- `userId` (string): The unique identifier of the user
- `userType` (string): The type of user

#### Response
```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "userType": "admin",
    "upperLevelOccupyBalance": 47765,
    "downLevelOccupyBalance": 88048.75,
    "totalMasterBalance": 173237.75,
    "availableBalance": 85189,
    "upperLevelCreditReference": 200000,
    "downLevelCreditReference": 99000,
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  },
  "message": "Occupy balance information retrieved successfully"
}
```

#### cURL Example
```bash
curl -X GET "http://localhost:7080/api/v1/balance/occupy/user123/admin" \
  -H "Content-Type: application/json"
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "User ID and User Type are required"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to get balance dashboard"
}
```

---

## Data Types

### BalanceDashboard
```typescript
interface BalanceDashboard {
  upperLevelCreditReference: number;
  totalMasterBalance: number;
  availableBalance: number;
  downLevelOccupyBalance: number;
  upperLevelOccupyBalance: number;
  upperLevel: number;
  availableBalanceWithProfitLoss: number;
  downLevelCreditReference: number;
  downLevelProfitLoss: number;
  myProfitLoss: number;
}
```

### BalanceTransferRequest
```typescript
interface BalanceTransferRequest {
  fromUserId: string;
  toUserId: string;
  amount: number;
  transferType: 'credit' | 'debit' | 'settlement';
  remarks?: string;
}
```

### CreditReferenceUpdate
```typescript
interface CreditReferenceUpdate {
  userId: string;
  newCreditRef: number;
  remarks?: string;
}
```

### BalanceAdjustment
```typescript
interface BalanceAdjustment {
  userId: string;
  adjustmentType: 'balance' | 'profitLoss' | 'liability' | 'exposure';
  amount: number;
  operation: 'add' | 'subtract' | 'set';
  remarks?: string;
}
```

---

## Postman Collection

```json
{
  "info": {
    "name": "Balance Management API",
    "description": "API for managing user balances and financial operations",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Balance Dashboard",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/v1/balance/dashboard/{{userId}}/{{userType}}",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v1", "balance", "dashboard", "{{userId}}", "{{userType}}"]
        }
      }
    },
    {
      "name": "Transfer Balance",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"fromUserId\": \"{{fromUserId}}\",\n  \"toUserId\": \"{{toUserId}}\",\n  \"amount\": 1000,\n  \"transferType\": \"credit\",\n  \"remarks\": \"Balance transfer\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/v1/balance/transfer",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v1", "balance", "transfer"]
        }
      }
    },
    {
      "name": "Update Credit Reference",
      "request": {
        "method": "PUT",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"userId\": \"{{userId}}\",\n  \"newCreditRef\": 250000,\n  \"remarks\": \"Updated credit reference\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/v1/balance/credit-reference",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v1", "balance", "credit-reference"]
        }
      }
    },
    {
      "name": "Adjust Balance",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"userId\": \"{{userId}}\",\n  \"adjustmentType\": \"balance\",\n  \"amount\": 5000,\n  \"operation\": \"add\",\n  \"remarks\": \"Balance adjustment\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/v1/balance/adjust",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v1", "balance", "adjust"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:7080"
    },
    {
      "key": "userId",
      "value": "user123"
    },
    {
      "key": "userType",
      "value": "admin"
    },
    {
      "key": "fromUserId",
      "value": "user123"
    },
    {
      "key": "toUserId",
      "value": "user456"
    }
  ]
}
```

---

## Usage Examples

### Dashboard Integration
```javascript
// Get balance dashboard for admin user
const response = await fetch('/api/v1/balance/dashboard/admin123/admin');
const dashboard = await response.json();

// Display dashboard data
document.getElementById('totalBalance').textContent = dashboard.data.totalMasterBalance;
document.getElementById('availableBalance').textContent = dashboard.data.availableBalance;
document.getElementById('profitLoss').textContent = dashboard.data.myProfitLoss;
```

### Balance Transfer
```javascript
// Transfer balance between users
const transferData = {
  fromUserId: 'admin123',
  toUserId: 'agent456',
  amount: 1000,
  transferType: 'credit',
  remarks: 'Settlement transfer'
};

const response = await fetch('/api/v1/balance/transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(transferData)
});
```

### Occupy Balance Information
```javascript
// Get occupy balance information
const response = await fetch('/api/v1/balance/occupy/admin123/admin');
const occupyData = await response.json();

// Display occupy balance data
document.getElementById('upperLevelOccupy').textContent = occupyData.data.upperLevelOccupyBalance;
document.getElementById('downLevelOccupy').textContent = occupyData.data.downLevelOccupyBalance;
```

### Credit Reference Update
```javascript
// Update credit reference
const creditUpdate = {
  userId: 'admin123',
  newCreditRef: 300000,
  remarks: 'Increased credit limit'
};

const response = await fetch('/api/v1/balance/credit-reference', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(creditUpdate)
});
```

---

## Notes

1. **Authorization**: All endpoints require proper Admin/TechAdmin authentication
2. **Transaction Safety**: All balance operations are wrapped in database transactions
3. **Audit Trail**: All balance changes are logged for audit purposes
4. **Validation**: Input validation is performed on all requests
5. **Error Handling**: Comprehensive error handling with meaningful error messages
6. **Performance**: Optimized queries for better performance with large datasets

This API provides complete functionality for the balance management dashboard shown in your interface, allowing Admins and TechAdmins to manage all aspects of user finances efficiently.
