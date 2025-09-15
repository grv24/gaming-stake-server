# 🎰 Downline Settled Bets Management API

## Overview
A comprehensive system for upline users to view and manage settled bets of their downline users with advanced filtering, pagination, and analytics.

## 🚀 Features

### ✅ **Role-Based Access Control**
- **SuperAdmin/Admin**: Can view all settled bets
- **Master**: Can view SuperMaster, Agent, SuperAgent, Client settled bets
- **SuperMaster**: Can view Agent, SuperAgent, Client settled bets  
- **Agent**: Can view SuperAgent, Client settled bets
- **SuperAgent**: Can view Client settled bets
- **Client**: Cannot access (read-only for own bets)

### ✅ **Advanced Filtering & Search**
- Filter by specific downline user
- Filter by bet status (won/lost)
- Filter by casino game type
- Filter by date range
- Sort by various fields
- Pagination support

### ✅ **Comprehensive Analytics**
- Total bets count
- Win/Loss statistics
- Total stake amounts
- Total profit/loss
- Win rate percentage
- User-specific summaries

## 📋 API Endpoints

### 1. **Get Downline Settled Bets**
```http
GET /api/casino/downline-settled-bets
```

**Query Parameters:**
```json
{
  "page": 1,                    // Page number (default: 1)
  "limit": 50,                   // Items per page (default: 50)
  "downlineUserId": "optional",  // Specific downline user ID
  "status": "won",               // Filter by status: "won", "lost", or both
  "casinoType": "dt6",           // Filter by casino game type
  "startDate": "2025-01-01",    // Start date filter
  "endDate": "2025-01-31",      // End date filter
  "sortBy": "createdAt",        // Sort field: "createdAt", "updatedAt", "stake", "profitLoss"
  "sortOrder": "DESC"            // Sort direction: "ASC" or "DESC"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bets": [
      {
        "id": "61113df7-708a-4279-921c-4acb2eb457b6",
        "userId": "5566764a-57ce-42c1-8f7a-bee045f18004",
        "userType": "client",
        "matchId": "118250915050752",
        "status": "lost",
        "stake": 500,
        "profitLoss": -500,
        "winner": "2",
        "winnerNation": "Tiger",
        "betName": "Tiger",
        "gameName": "1 Day Dragon Tiger",
        "gameSlug": "dt6",
        "casinoType": "dt6",
        "oddCategory": "Lay",
        "betRate": 1.25,
        "settledAt": "2025-01-14T10:30:00.000Z",
        "createdAt": "2025-01-14T09:30:00.000Z",
        "updatedAt": "2025-01-14T10:30:00.000Z",
        "user": {
          "id": "5566764a-57ce-42c1-8f7a-bee045f18004",
          "username": "client_user_123",
          "userType": "client"
        }
      }
    ],
    "summary": {
      "totalBets": 150,
      "wonBets": 75,
      "lostBets": 75,
      "totalStake": 75000,
      "totalProfitLoss": -2500,
      "winRate": "50.00"
    },
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    },
    "filters": {
      "status": ["won", "lost"],
      "casinoType": "dt6",
      "startDate": "2025-01-01",
      "endDate": "2025-01-31",
      "sortBy": "createdAt",
      "sortOrder": "DESC"
    }
  }
}
```

### 2. **Get Downline Users List**
```http
GET /api/casino/downline-users
```

**Response:**
```json
{
  "success": true,
  "data": {
    "downlineUsers": [
      {
        "id": "5566764a-57ce-42c1-8f7a-bee045f18004",
        "username": "client_user_123",
        "userType": "client",
        "balance": 5000,
        "exposure": 1000,
        "createdAt": "2025-01-01T00:00:00.000Z"
      },
      {
        "id": "6677875b-68df-53d2-9f8b-cff156291115",
        "username": "agent_user_456",
        "userType": "agent",
        "balance": 15000,
        "exposure": 2500,
        "createdAt": "2025-01-02T00:00:00.000Z"
      }
    ],
    "total": 25,
    "userTypes": ["client", "agent", "superagent"]
  }
}
```

## 🔧 Usage Examples

### **Example 1: View All Settled Bets**
```bash
GET /api/casino/downline-settled-bets?page=1&limit=20
```

### **Example 2: Filter by Specific User**
```bash
GET /api/casino/downline-settled-bets?downlineUserId=5566764a-57ce-42c1-8f7a-bee045f18004
```

### **Example 3: Filter by Casino Game**
```bash
GET /api/casino/downline-settled-bets?casinoType=dt6&status=won
```

### **Example 4: Date Range Filter**
```bash
GET /api/casino/downline-settled-bets?startDate=2025-01-01&endDate=2025-01-31
```

### **Example 5: Sort by Profit/Loss**
```bash
GET /api/casino/downline-settled-bets?sortBy=profitLoss&sortOrder=ASC
```

### **Example 6: Get Downline Users**
```bash
GET /api/casino/downline-users
```

## 📊 Analytics & Insights

### **Summary Statistics**
The API provides comprehensive analytics for each query:

```json
{
  "summary": {
    "totalBets": 150,        // Total number of settled bets
    "wonBets": 75,           // Number of winning bets
    "lostBets": 75,          // Number of losing bets
    "totalStake": 75000,     // Total stake amount
    "totalProfitLoss": -2500, // Net profit/loss
    "winRate": "50.00"       // Win rate percentage
  }
}
```

### **Performance Metrics**
- **Win Rate**: Percentage of winning bets
- **Average Stake**: Total stake divided by number of bets
- **Average Profit/Loss**: Total profit/loss divided by number of bets
- **Risk Assessment**: Based on exposure vs balance ratios

## 🛡️ Security Features

### **Access Control**
1. **User Type Validation**: Only upline users can access
2. **Hierarchy Validation**: Can only view downline users
3. **Relationship Validation**: Validates upline-downline relationships
4. **Data Privacy**: Users can only see their authorized downline data

### **Query Validation**
1. **Pagination Limits**: Maximum 100 items per page
2. **Date Validation**: Validates date formats and ranges
3. **Sort Field Validation**: Only allows safe sort fields
4. **Input Sanitization**: Prevents injection attacks

## 🔄 Use Cases

### **Scenario 1: Master Checking Agent Performance**
```bash
# Get all settled bets for agents
GET /api/casino/downline-settled-bets?userType=agent&sortBy=profitLoss&sortOrder=DESC
```

### **Scenario 2: Agent Monitoring Client Activity**
```bash
# Get client settled bets for today
GET /api/casino/downline-settled-bets?downlineUserId=client123&startDate=2025-01-14&endDate=2025-01-14
```

### **Scenario 3: Casino Game Analysis**
```bash
# Analyze Dragon Tiger performance
GET /api/casino/downline-settled-bets?casinoType=dt6&status=won
```

### **Scenario 4: Risk Assessment**
```bash
# Get high-stake losing bets
GET /api/casino/downline-settled-bets?status=lost&sortBy=stake&sortOrder=DESC&limit=10
```

## 🚨 Error Handling

### **Common Errors**
- `403`: Insufficient permissions
- `400`: Invalid query parameters
- `404`: Downline user not found
- `500`: Server/database errors

### **Error Response Format**
```json
{
  "success": false,
  "message": "You can only view settled bets for your downline users",
  "error": "Permission denied"
}
```

## 📈 Performance Features

### **Optimization**
- **Database Indexing**: Optimized queries for large datasets
- **Pagination**: Efficient handling of large result sets
- **Selective Fields**: Only fetches required data
- **Caching**: Redis caching for frequently accessed data

### **Scalability**
- **Batch Processing**: Handles multiple user types efficiently
- **Memory Management**: Optimized for large datasets
- **Query Optimization**: Efficient database queries
- **Response Compression**: Reduced payload sizes

## 🔧 Integration

### **Frontend Integration**
```javascript
// Example React component usage
const fetchDownlineSettledBets = async (filters) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/casino/downline-settled-bets?${params}`);
  return response.json();
};

// Usage
const bets = await fetchDownlineSettledBets({
  page: 1,
  limit: 20,
  casinoType: 'dt6',
  status: 'won'
});
```

### **Dashboard Integration**
```javascript
// Dashboard analytics
const getDashboardStats = async () => {
  const [bets, users] = await Promise.all([
    fetch('/api/casino/downline-settled-bets?limit=1000'),
    fetch('/api/casino/downline-users')
  ]);
  
  return {
    bets: await bets.json(),
    users: await users.json()
  };
};
```

## 📋 Benefits

✅ **Complete Visibility**: Full view of downline betting activity  
✅ **Advanced Analytics**: Comprehensive performance metrics  
✅ **Flexible Filtering**: Multiple filter options for specific needs  
✅ **Role Security**: Proper access control and data privacy  
✅ **Performance Optimized**: Efficient queries and pagination  
✅ **Real-time Data**: Up-to-date settlement information  
✅ **Audit Trail**: Complete history of all settled bets  
✅ **Risk Management**: Tools for monitoring and risk assessment  

---

**Note**: This system provides comprehensive tools for upline users to monitor, analyze, and manage their downline users' casino betting activity with proper security and performance optimization.
