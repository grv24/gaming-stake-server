# 🎰 Casino Settlement Reversal System

## Overview
A comprehensive manual settlement reversal system that allows upline users to reverse incorrect casino bet settlements with proper role-based access control and audit trails.

## 🚀 Features

### ✅ **Role-Based Access Control**
- **SuperAdmin/Admin**: Can reverse any settlement
- **Master**: Can reverse settlements for SuperMaster, Agent, SuperAgent, Client
- **SuperMaster**: Can reverse settlements for Agent, SuperAgent, Client  
- **Agent**: Can reverse settlements for SuperAgent, Client
- **SuperAgent**: Can reverse settlements for Client
- **Client**: Cannot reverse settlements (read-only)

### ✅ **Comprehensive Reversal Process**
- Reverts bet status from "won"/"lost" back to "pending"
- Restores user balance to pre-settlement state
- Restores user exposure
- Logs reversal for audit trail
- Validates upline-downline relationship

### ✅ **Audit Trail**
- Complete reversal history with timestamps
- Reversal reasons (minimum 10 characters)
- Original settlement data preserved
- Who performed the reversal
- When the reversal occurred

## 📋 API Endpoints

### 1. **Reverse Settlement**
```http
POST /api/casino/reverse-settlement
```

**Request Body:**
```json
{
  "betId": "61113df7-708a-4279-921c-4acb2eb457b6",
  "reason": "Incorrect settlement due to wrong winner determination"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bet settlement reversed successfully",
  "data": {
    "betId": "61113df7-708a-4279-921c-4acb2eb457b6",
    "originalStatus": "lost",
    "newStatus": "pending",
    "balanceRestored": -500,
    "exposureRestored": 500,
    "reversalReason": "Incorrect settlement due to wrong winner determination",
    "reversedBy": "admin-user-id",
    "reversedAt": "2025-01-14T10:30:00.000Z"
  }
}
```

### 2. **Get Reversal History**
```http
GET /api/casino/reversal-history?page=1&limit=50&downlineUserId=optional
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reversals": [
      {
        "id": "reversal_61113df7-708a-4279-921c-4acb2eb457b6_1642248600000",
        "originalBetId": "61113df7-708a-4279-921c-4acb2eb457b6",
        "userId": "5566764a-57ce-42c1-8f7a-bee045f18004",
        "userType": "client",
        "matchId": "118250915050752",
        "reversalReason": "Incorrect settlement due to wrong winner determination",
        "reversedBy": "admin-user-id",
        "reversedAt": "2025-01-14T10:30:00.000Z",
        "originalResult": {
          "winner": "2",
          "profitLoss": -500,
          "status": "lost"
        },
        "createdAt": "2025-01-14T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1,
      "pages": 1
    }
  }
}
```

## 🔧 Technical Implementation

### **Database Changes**
The reversal system stores additional data in the `betData` field:

```json
{
  "betData": {
    "mid": 118250915050752,
    "sid": "2",
    "loss": 125,
    "name": "Tiger",
    "stake": 500,
    "profit": 500,
    "result": null,  // Cleared after reversal
    "reversal": {   // New reversal data
      "reversedBy": "admin-user-id",
      "reversedAt": "2025-01-14T10:30:00.000Z",
      "reason": "Incorrect settlement due to wrong winner determination",
      "originalResult": {
        "winner": "2",
        "profitLoss": -500,
        "status": "lost"
      },
      "originalProfitLoss": -500
    }
  }
}
```

### **Audit Log Entry**
A separate audit entry is created for each reversal:

```json
{
  "id": "reversal_61113df7-708a-4279-921c-4acb2eb457b6_1642248600000",
  "userId": "5566764a-57ce-42c1-8f7a-bee045f18004",
  "userType": "client",
  "matchId": "118250915050752",
  "status": "reversed",
  "betData": {
    "originalBetId": "61113df7-708a-4279-921c-4acb2eb457b6",
    "reversalReason": "Incorrect settlement due to wrong winner determination",
    "reversedBy": "admin-user-id",
    "reversedAt": "2025-01-14T10:30:00.000Z",
    "originalResult": {
      "winner": "2",
      "profitLoss": -500,
      "status": "lost"
    }
  }
}
```

## 🛡️ Security Features

### **Validation Checks**
1. **Bet ID Required**: Must provide valid bet ID
2. **Reason Required**: Minimum 10 characters explanation
3. **User Type Validation**: Only upline users can reverse
4. **Relationship Validation**: Can only reverse downline settlements
5. **Bet Status Check**: Cannot reverse already pending bets
6. **User Existence**: Validates user and bet existence

### **Transaction Safety**
- All operations wrapped in database transactions
- Atomic operations ensure data consistency
- Rollback on any failure
- Pessimistic locking for concurrent access

## 📊 Use Cases

### **Scenario 1: Wrong Winner Determination**
```json
// Original settlement (incorrect)
{
  "status": "lost",
  "winner": "2",  // Tiger won
  "profitLoss": -500
}

// After reversal
{
  "status": "pending",
  "result": null,
  "reversal": {
    "reason": "Tiger actually lost, Dragon won",
    "originalResult": { "winner": "2", "profitLoss": -500 }
  }
}
```

### **Scenario 2: Incorrect Lay/Back Logic**
```json
// Original settlement (incorrect Lay bet logic)
{
  "status": "lost",
  "profitLoss": 500  // Should be negative for Lay loss
}

// After reversal
{
  "status": "pending",
  "result": null,
  "reversal": {
    "reason": "Lay bet loss should show negative profitLoss",
    "originalResult": { "profitLoss": 500 }
  }
}
```

## 🔄 Workflow

1. **Detect Issue**: Upline user identifies incorrect settlement
2. **Validate Access**: System checks user hierarchy permissions
3. **Reverse Settlement**: 
   - Change bet status to "pending"
   - Restore user balance
   - Restore user exposure
   - Clear result data
4. **Log Audit**: Create reversal audit entry
5. **Notify**: Return confirmation with reversal details

## 🚨 Error Handling

### **Common Errors**
- `400`: Missing bet ID or insufficient reason
- `403`: Insufficient permissions or invalid hierarchy
- `404`: Bet or user not found
- `500`: Database or system errors

### **Error Response Format**
```json
{
  "success": false,
  "message": "You can only reverse settlements for your downline users",
  "error": "Permission denied"
}
```

## 📈 Benefits

✅ **Data Integrity**: Ensures accurate settlement records  
✅ **User Trust**: Provides transparency and correction capability  
✅ **Audit Compliance**: Complete trail of all settlement changes  
✅ **Role Security**: Proper access control prevents abuse  
✅ **Flexibility**: Handles various settlement error scenarios  
✅ **Recovery**: Quick correction of settlement mistakes  

## 🔧 Integration

The reversal system integrates seamlessly with:
- **Automatic Settlement**: 60-second interval settlement
- **Manual Settlement**: Existing manual settlement endpoints
- **Socket Broadcasting**: Real-time updates to clients
- **User Management**: Role-based access control
- **Audit Systems**: Complete transaction logging

---

**Note**: This system provides a robust solution for handling settlement errors while maintaining data integrity and proper access controls. All reversals are logged and traceable for compliance and debugging purposes.
