# Commission System API Documentation

## Overview

The Commission System API provides comprehensive endpoints for managing commission calculations, settlements, and monitoring in the GameStake platform. This system handles multi-tier revenue sharing across different user hierarchies and sports types.

## Base Configuration

- **Base URL**: `http://localhost:7080`
- **API Version**: `v1`
- **Content-Type**: `application/json`
- **Authentication**: Bearer Token (if required)

## Table of Contents

1. [Commission Calculation APIs](#commission-calculation-apis)
2. [Commission Report APIs](#commission-report-apis)
3. [Commission Settlement APIs](#commission-settlement-apis)
4. [Commission Management APIs](#commission-management-apis)
5. [Casino Settlement Monitor APIs](#casino-settlement-monitor-apis)
6. [Data Types Reference](#data-types-reference)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## Commission Calculation APIs

### 1. Calculate Commission

Calculate commission for a bet without creating transactions.

**Endpoint:** `POST /api/v1/commission/calculate`

**Request Body:**
```json
{
  "betId": "string",
  "userId": "string", 
  "betAmount": 1000,
  "sportType": "Casino|Sports|Matka",
  "commissionType": "panel|match|session"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "betId": "string",
    "userId": "string",
    "totalCommission": 50,
    "commissionBreakdown": [
      {
        "uplineUserId": "string",
        "uplineType": "agent",
        "commissionAmount": 25,
        "commissionRate": 2.5
      }
    ]
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:7080/api/v1/commission/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "betId": "casino-bet-12345",
    "userId": "user-uuid-here",
    "betAmount": 1000,
    "sportType": "Casino",
    "commissionType": "panel"
  }'
```

### 2. Create Commission Transactions

Create commission transactions for a bet.

**Endpoint:** `POST /api/v1/commission/transactions`

**Request Body:**
```json
{
  "betId": "string",
  "userId": "string",
  "betAmount": 1000,
  "sportType": "Casino",
  "commissionType": "panel"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Commission transactions created successfully",
  "data": [
    {
      "id": "uuid",
      "betId": "string",
      "userId": "string",
      "commissionAmount": 25,
      "status": "pending"
    }
  ]
}
```

---

## Commission Report APIs

### 3. Get Commission Report for User

Get detailed commission report for a specific user.

**Endpoint:** `GET /api/v1/commission/report/{userId}`

**Query Parameters:**
- `startDate` (optional): `2024-01-01`
- `endDate` (optional): `2024-12-31`
- `status` (optional): `pending|settled|cancelled`

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "string",
    "totalCommission": 1500,
    "pendingCommission": 200,
    "settledCommission": 1300,
    "transactions": [
      {
        "id": "uuid",
        "betId": "string",
        "commissionAmount": 50,
        "status": "settled",
        "transactionDate": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

**Example:**
```bash
curl "http://localhost:7080/api/v1/commission/report/user-uuid-here?startDate=2024-01-01&endDate=2024-12-31"
```

### 4. Get Pending Transactions

Get all pending commission transactions.

**Endpoint:** `GET /api/v1/commission/pending`

**Query Parameters:**
- `userId` (optional): Filter by specific user
- `sportType` (optional): Filter by sport type
- `limit` (optional): Number of records (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPending": 25,
    "totalAmount": 5000,
    "transactions": [
      {
        "id": "uuid",
        "betId": "string",
        "userId": "string",
        "commissionAmount": 100,
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### 5. Get Commission Analytics

Get comprehensive commission analytics and statistics.

**Endpoint:** `GET /api/v1/commission/analytics`

**Query Parameters:**
- `startDate` (optional): `2024-01-01`
- `endDate` (optional): `2024-12-31`
- `groupBy` (optional): `userType|sportType|commissionType`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCommission": 50000,
    "commissionByUserType": {
      "agent": 20000,
      "superAgent": 15000,
      "master": 10000,
      "superMaster": 5000
    },
    "commissionBySport": {
      "Casino": 30000,
      "Sports": 15000,
      "Matka": 5000
    },
    "commissionByType": {
      "panel": 40000,
      "match": 8000,
      "session": 2000
    }
  }
}
```

---

## Commission Settlement APIs

### 6. Settle Transactions

Settle specific commission transactions.

**Endpoint:** `POST /api/v1/commission/settle`

**Request Body:**
```json
{
  "transactionIds": ["uuid1", "uuid2"],
  "settlementDate": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transactions settled successfully",
  "data": {
    "settledCount": 2,
    "totalAmount": 200,
    "settlementDate": "2024-01-15T10:30:00Z"
  }
}
```

### 7. Process Daily Settlement

Process daily settlement for all pending transactions.

**Endpoint:** `POST /api/v1/commission/settlement/daily`

**Request Body:**
```json
{
  "settlementDate": "2024-01-15",
  "userId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Daily settlement completed",
  "data": {
    "settlementDate": "2024-01-15",
    "settledCount": 50,
    "totalAmount": 10000,
    "errors": []
  }
}
```

### 8. Process Settlement for Date Range

Process settlement for a specific date range.

**Endpoint:** `POST /api/v1/commission/settlement/date-range`

**Request Body:**
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "userId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Date range settlement completed",
  "data": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "settledCount": 500,
    "totalAmount": 100000
  }
}
```

### 9. Get Settlement Report

Get comprehensive settlement report.

**Endpoint:** `GET /api/v1/commission/settlement/report`

**Query Parameters:**
- `startDate` (optional): `2024-01-01`
- `endDate` (optional): `2024-12-31`
- `userId` (optional): Filter by user

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSettled": 1000,
    "totalAmount": 200000,
    "dailyBreakdown": [
      {
        "date": "2024-01-15",
        "settledCount": 50,
        "amount": 10000
      }
    ]
  }
}
```

### 10. Get Settlement Status

Get settlement status for a specific user.

**Endpoint:** `GET /api/v1/commission/settlement/status/{userId}`

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "string",
    "lastSettlementDate": "2024-01-15T10:30:00Z",
    "pendingAmount": 500,
    "settledAmount": 2000,
    "nextSettlementDate": "2024-01-16T00:00:00Z"
  }
}
```

---

## Commission Management APIs

### 11. Cancel Transactions

Cancel specific commission transactions.

**Endpoint:** `POST /api/v1/commission/cancel`

**Request Body:**
```json
{
  "transactionIds": ["uuid1", "uuid2"],
  "reason": "Bet cancelled by user"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transactions cancelled successfully",
  "data": {
    "cancelledCount": 2,
    "refundAmount": 200
  }
}
```

### 12. Refund Transactions

Process refunds for commission transactions.

**Endpoint:** `POST /api/v1/commission/refund`

**Request Body:**
```json
{
  "transactionIds": ["uuid1", "uuid2"],
  "refundAmount": 200,
  "reason": "Commission refund"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Refund processed successfully",
  "data": {
    "refundedCount": 2,
    "refundAmount": 200
  }
}
```

### 13. Validate Commission Configuration

Validate commission configuration for a user.

**Endpoint:** `GET /api/v1/commission/validate/{userId}`

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "string",
    "isValid": true,
    "issues": [],
    "commissionSettings": {
      "commissionLena": true,
      "commissionDena": false,
      "percentageWiseCommission": 2.5,
      "partnerShipWiseCommission": 1.0
    }
  }
}
```

---

## Casino Settlement Monitor APIs

### 14. Get Casino Settlement Health

Monitor the health of casino settlement system.

**Endpoint:** `GET /api/v1/commission/casino/health`

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy|warning|critical",
    "message": "Casino settlement system is healthy",
    "stats": {
      "totalPending": 0,
      "issuesFound": 0,
      "fixableIssues": 0,
      "criticalIssues": 0,
      "settlementSuccessRate": 100
    },
    "lastChecked": "2024-01-15T10:30:00Z"
  }
}
```

### 15. Analyze Pending Casino Bets

Analyze all pending casino bets and identify issues.

**Endpoint:** `GET /api/v1/commission/casino/pending-analysis`

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalPending": 3,
      "issuesFound": 3,
      "fixableIssues": 3,
      "criticalIssues": 0,
      "settlementSuccessRate": 0
    },
    "issues": [
      {
        "betId": "cb247192-82c2-4b84-ac9c-d311471267b5",
        "issue": "Match has no winner data",
        "severity": "medium",
        "fixable": true,
        "suggestedFix": "Winner data needs to be fetched from external API"
      }
    ],
    "recommendations": [
      "🔧 3 issues can be auto-fixed",
      "⚠️ Settlement success rate is 0.0% - below threshold"
    ]
  }
}
```

### 16. Auto-Fix Casino Settlement Issues

Automatically fix fixable casino settlement issues.

**Endpoint:** `POST /api/v1/commission/casino/auto-fix`

**Response:**
```json
{
  "success": true,
  "message": "Auto-fix process completed",
  "data": {
    "fixed": 3,
    "failed": 0,
    "errors": []
  }
}
```

---

## Data Types Reference

### SportType Values
- `Casino` - Casino games
- `Sports` - Sports betting
- `Matka` - Matka games

### CommissionType Values
- `panel` - Panel commission
- `match` - Match commission
- `session` - Session commission

### CommissionStatus Values
- `pending` - Transaction pending
- `settled` - Transaction settled
- `cancelled` - Transaction cancelled

### User Hierarchy
1. `Developer` - Top level
2. `TechAdmin` - Technical administrator
3. `Admin` - Administrator
4. `MiniAdmin` - Mini administrator
5. `SuperMaster` - Super master
6. `Master` - Master
7. `SuperAgent` - Super agent
8. `Agent` - Agent
9. `Client` - Client (bottom level)

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details (development only)"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

### Error Examples

**Validation Error:**
```json
{
  "success": false,
  "error": "betId, userId, betAmount, and sportType are required"
}
```

**Not Found Error:**
```json
{
  "success": false,
  "error": "User not found"
}
```

**Server Error:**
```json
{
  "success": false,
  "error": "Failed to calculate commission",
  "details": "Database connection timeout"
}
```

---

## Rate Limiting

- **Default Limit**: 100 requests per minute per IP
- **Commission Calculation**: 50 requests per minute per user
- **Settlement Operations**: 10 requests per minute per user
- **Analytics**: 20 requests per minute per user

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## Postman Collection

### Environment Variables

Create these variables in Postman:

```json
{
  "baseUrl": "http://localhost:7080",
  "userId": "your-test-user-uuid",
  "betId": "test-bet-12345",
  "commissionTxId": "commission-tx-uuid-1"
}
```

### Quick Test Commands

**Test Commission Calculation:**
```bash
curl -X POST http://localhost:7080/api/v1/commission/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "betId": "test-bet-123",
    "userId": "test-user-456",
    "betAmount": 1000,
    "sportType": "Casino",
    "commissionType": "panel"
  }'
```

**Test Commission Analytics:**
```bash
curl http://localhost:7080/api/v1/commission/analytics
```

**Test Casino Health:**
```bash
curl http://localhost:7080/api/v1/commission/casino/health
```

---

## Best Practices

### 1. Error Handling
- Always check the `success` field in responses
- Handle rate limiting gracefully
- Implement retry logic for transient errors

### 2. Performance
- Use pagination for large datasets
- Cache analytics data when possible
- Batch operations when processing multiple items

### 3. Security
- Validate all input parameters
- Use HTTPS in production
- Implement proper authentication

### 4. Monitoring
- Monitor settlement health regularly
- Set up alerts for critical issues
- Track commission success rates

---

## Support

For technical support or questions about the Commission API:

- **Documentation**: This document
- **Health Check**: `GET /api/v1/commission/casino/health`
- **Status**: Monitor settlement success rates

---

*Last Updated: January 2024*
*API Version: v1*

