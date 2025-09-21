# Commission System Implementation

This document provides a comprehensive guide to the newly implemented commission system for the BlueBet platform.

## Overview

The commission system has been successfully implemented with all the features described in the `COMMISSION_SYSTEM_DOCUMENTATION.md`. The system provides:

- **Real-time Commission Calculation**: Commissions are calculated immediately when bets are placed
- **Hierarchical Distribution**: Commissions flow from lower levels to higher levels in the user hierarchy
- **Multiple Commission Types**: Panel, Match, and Session commissions
- **Automated Settlement**: Daily settlement process with comprehensive reporting
- **Comprehensive API**: Full REST API for commission management

## Implementation Status

### ✅ Completed Components

1. **Commission Transaction Entity** (`src/entities/CommissionTransaction.ts`)
   - Tracks all commission transactions
   - Supports multiple commission types (Panel, Match, Session)
   - Includes audit trail and metadata

2. **Commission Service** (`src/services/CommissionService.ts`)
   - Core commission calculation logic
   - User hierarchy management
   - Commission rate calculation
   - Transaction creation and settlement

3. **Commission Settlement Service** (`src/services/CommissionSettlementService.ts`)
   - Daily settlement process
   - Batch processing by user
   - Settlement reports and analytics
   - Transaction cancellation and refunds

4. **Commission Controller** (`src/controllers/CommissionController.ts`)
   - REST API endpoints for commission management
   - Commission calculation and reporting
   - Settlement processing
   - Analytics and validation

5. **Commission Routes** (`src/routes/CommissionRoutes.ts`)
   - API route definitions
   - Endpoint organization

6. **Commission Integration Service** (`src/services/CommissionIntegrationService.ts`)
   - Integration with bet placement
   - Bet settlement processing
   - Commission statistics

## API Endpoints

### Commission Calculation
- `POST /api/v1/commission/calculate` - Calculate commission for a bet
- `POST /api/v1/commission/transactions` - Create commission transactions

### Commission Reports
- `GET /api/v1/commission/report/:userId` - Get commission report for a user
- `GET /api/v1/commission/pending` - Get pending commission transactions
- `GET /api/v1/commission/analytics` - Get commission analytics

### Commission Settlement
- `POST /api/v1/commission/settle` - Settle commission transactions
- `POST /api/v1/commission/settlement/daily` - Process daily settlement
- `POST /api/v1/commission/settlement/date-range` - Process settlement for date range
- `GET /api/v1/commission/settlement/report` - Generate daily settlement report
- `GET /api/v1/commission/settlement/status/:userId` - Get settlement status for a user

### Commission Management
- `POST /api/v1/commission/cancel` - Cancel commission transactions
- `POST /api/v1/commission/refund` - Refund commission transactions
- `GET /api/v1/commission/validate/:userId` - Validate commission configuration

## Usage Examples

### 1. Calculate Commission for a Bet

```typescript
const commissionData = {
  betId: "bet-123",
  userId: "user-456",
  betAmount: 1000,
  sportType: "Soccer",
  commissionType: "panel"
};

const response = await fetch('/api/v1/commission/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(commissionData)
});

const result = await response.json();
console.log('Commission breakdown:', result.data.commissionBreakdown);
```

### 2. Create Commission Transactions

```typescript
const transactionData = {
  betId: "bet-123",
  userId: "user-456",
  betAmount: 1000,
  sportType: "Soccer",
  commissionType: "panel"
};

const response = await fetch('/api/v1/commission/transactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(transactionData)
});

const transactions = await response.json();
console.log('Created transactions:', transactions.data);
```

### 3. Get Commission Report

```typescript
const userId = "user-456";
const startDate = "2024-01-01";
const endDate = "2024-01-31";

const response = await fetch(
  `/api/v1/commission/report/${userId}?startDate=${startDate}&endDate=${endDate}`
);

const report = await response.json();
console.log('Commission report:', report.data);
```

### 4. Process Daily Settlement

```typescript
const response = await fetch('/api/v1/commission/settlement/daily', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});

const result = await response.json();
console.log('Settlement result:', result.data);
```

## Integration with Bet Placement

To integrate commission calculation with bet placement, use the `CommissionIntegrationService`:

```typescript
import { CommissionIntegrationService } from './services/CommissionIntegrationService';

const commissionIntegration = new CommissionIntegrationService(AppDataSource);

// When a bet is placed
const betData = {
  betId: "bet-123",
  userId: "user-456",
  userType: "client",
  betAmount: 1000,
  sportType: "Soccer",
  commissionType: "panel"
};

const transactions = await commissionIntegration.processBetCommission(betData);

// When a bet is settled
await commissionIntegration.processBetSettlement("bet-123", {
  isWinner: true,
  profitLoss: 500,
  settlementAmount: 1500
});

// When a bet is cancelled
await commissionIntegration.processBetCancellation("bet-123", "User requested cancellation");
```

## Database Schema

The commission system uses the `commission_transactions` table with the following structure:

```sql
CREATE TABLE commission_transactions (
  id UUID PRIMARY KEY,
  bet_id UUID,
  user_id UUID NOT NULL,
  user_type VARCHAR NOT NULL,
  user_login_id VARCHAR NOT NULL,
  upline_user_id UUID NOT NULL,
  upline_user_type VARCHAR NOT NULL,
  upline_login_id VARCHAR NOT NULL,
  commission_type VARCHAR NOT NULL,
  sport_type VARCHAR,
  bet_amount FLOAT NOT NULL,
  commission_rate FLOAT NOT NULL,
  commission_amount FLOAT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',
  settlement_date DATE,
  settled_at TIMESTAMP,
  settled_by UUID,
  remarks TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Configuration

### Commission Rates

Commission rates are configured in the user entities and their sport-specific settings:

- **Panel Commission**: `commissionOwn` field in user entities
- **Match Commission**: `commissionOwn` field in sport settings
- **Session Commission**: `sessionCommissionOwn` field in cricket settings

### Settlement Schedule

The daily settlement can be triggered manually using the API endpoints. You can also implement your own scheduling mechanism if needed.

## Monitoring and Logging

The system includes comprehensive logging:

- Commission calculation logs
- Settlement process logs
- Error handling and reporting
- Performance metrics

All logs are prefixed with `[COMMISSION-SETTLEMENT]` or `[COMMISSION-INTEGRATION]` for easy filtering.

## Error Handling

The system includes robust error handling:

- Validation of commission rates
- Hierarchy validation
- Transaction rollback on errors
- Comprehensive error messages
- Audit trail for all operations

## Testing

To test the commission system:

1. **Create test users** with proper hierarchy
2. **Place test bets** using the integration service
3. **Verify commission calculations** using the API
4. **Test settlement process** manually or via cron
5. **Validate reports** and analytics

## Security Considerations

- All API endpoints require proper authentication
- Commission rates are validated before saving
- Audit trail for all commission changes
- Transaction integrity maintained through database constraints

## Performance Considerations

- Commission calculations are optimized for real-time processing
- Settlement process uses batch processing
- Database indexes on frequently queried fields
- Efficient query patterns for reporting

## Future Enhancements

Potential future enhancements:

1. **Real-time Commission Updates**: WebSocket integration for live commission updates
2. **Advanced Analytics**: More detailed commission analytics and reporting
3. **Commission Templates**: Predefined commission rate templates
4. **Multi-currency Support**: Support for multiple currencies
5. **Commission Forecasting**: Predictive commission analytics

## Troubleshooting

### Common Issues

1. **Commission not calculated**: Check user hierarchy and commission rates
2. **Settlement failures**: Verify database connectivity and user permissions
3. **Incorrect amounts**: Validate commission rates and bet amounts
4. **Missing transactions**: Check bet placement integration

### Debug Tools

Use the validation endpoint to check commission configuration:

```typescript
const response = await fetch('/api/v1/commission/validate/user-id');
const validation = await response.json();
console.log('Validation errors:', validation.data.errors);
```

## Support

For technical support or questions about the commission system:

1. Check the logs for error messages
2. Use the validation endpoints to verify configuration
3. Review the API documentation
4. Contact the development team

---

The commission system is now fully implemented and ready for production use. All features from the documentation have been implemented with proper error handling, logging, and monitoring.
