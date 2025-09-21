# BlueBet Commission System Documentation

## Table of Contents
1. [Overview](#overview)
2. [Commission Architecture](#commission-architecture)
3. [User Hierarchy & Commission Flow](#user-hierarchy--commission-flow)
4. [Commission Types](#commission-types)
5. [Commission Calculation Process](#commission-calculation-process)
6. [Commission Settings & Configuration](#commission-settings--configuration)
7. [Partnership System](#partnership-system)
8. [Sports-Specific Commission](#sports-specific-commission)
9. [Commission Settlement Process](#commission-settlement-process)
10. [Validation Rules](#validation-rules)
11. [Commission Reports](#commission-reports)
12. [Commission Management](#commission-management)
13. [API Endpoints](#api-endpoints)
14. [Best Practices](#best-practices)
15. [Troubleshooting](#troubleshooting)

## Overview

The BlueBet commission system is a sophisticated multi-tier revenue sharing model that distributes earnings across a hierarchical user structure. The system ensures fair compensation for all stakeholders while maintaining proper financial controls and audit trails.

### Key Features
- **Hierarchical Distribution**: Commissions flow from lower levels to higher levels
- **Multiple Commission Types**: Panel, Match, and Session commissions
- **Real-time Calculation**: Commissions calculated on every bet
- **Flexible Configuration**: Customizable commission rates per user
- **Comprehensive Reporting**: Detailed commission reports and analytics
- **Audit Trail**: Complete tracking of all commission changes

## Commission Architecture

### Core Principles
1. **Top-Down Hierarchy**: Higher-level users earn from all downline users
2. **Percentage-Based**: Commissions calculated as percentages of bet amounts
3. **Cumulative Earnings**: Users earn from their direct downline and all users below
4. **Real-Time Processing**: Commissions calculated immediately on bet placement
5. **Settlement Cycles**: Daily settlement with comprehensive reporting

### Database Schema
```javascript
// Commission structure in user models
panelCommission: {
  techAdmin: { userId: ObjectId, commission: Number },
  admin: { userId: ObjectId, commission: Number },
  miniAdmin: { userId: ObjectId, commission: Number },
  superMaster: { userId: ObjectId, commission: Number },
  master: { userId: ObjectId, commission: Number },
  superAgent: { userId: ObjectId, commission: Number },
  agent: { userId: ObjectId, commission: Number },
  own: Number,
  total: Number
}
```

## User Hierarchy & Commission Flow

### Commission Flow Diagram
```
Developer (Top Level - No Commission Earned)
    ↓
TechAdmin (Earns from: Admin, MiniAdmin, SuperMaster, Master, SuperAgent, Agent, Client)
    ↓
Admin (Earns from: MiniAdmin, SuperMaster, Master, SuperAgent, Agent, Client)
    ↓
MiniAdmin (Earns from: SuperMaster, Master, SuperAgent, Agent, Client)
    ↓
SuperMaster (Earns from: Master, SuperAgent, Agent, Client)
    ↓
Master (Earns from: SuperAgent, Agent, Client)
    ↓
SuperAgent (Earns from: Agent, Client)
    ↓
Agent (Earns from: Client)
    ↓
Client (No downline - Only pays commission)
```

### Commission Earning Rights by User Type

| User Type | Can Earn From | Commission Levels |
|-----------|---------------|-------------------|
| Developer | None | System level only |
| TechAdmin | All levels below | 7 levels |
| Admin | MiniAdmin and below | 6 levels |
| MiniAdmin | SuperMaster and below | 5 levels |
| SuperMaster | Master and below | 4 levels |
| Master | SuperAgent and below | 3 levels |
| SuperAgent | Agent and below | 2 levels |
| Agent | Client only | 1 level |
| Client | None | Pays commission only |

## Commission Types

### 1. Panel Commission
Panel commission is earned from all betting activities of downline users, regardless of sport or game type.

**Characteristics:**
- Universal commission type
- Applied to all betting activities
- Calculated as percentage of bet amount
- Earned by all upline users

**Example Structure:**
```javascript
panelCommission: {
  techAdmin: { userId: "64a1b2c3d4e5f6789", commission: 1.5 },
  admin: { userId: "64a1b2c3d4e5f6788", commission: 1.0 },
  miniAdmin: { userId: "64a1b2c3d4e5f6787", commission: 0.5 },
  superMaster: { userId: "64a1b2c3d4e5f6786", commission: 0.5 },
  master: { userId: "64a1b2c3d4e5f6785", commission: 1.0 },
  superAgent: { userId: "64a1b2c3d4e5f6784", commission: 1.0 },
  agent: { userId: "64a1b2c3d4e5f6783", commission: 2.0 },
  own: 2.0,
  total: 9.5
}
```

### 2. Match Commission (Sports Betting)
Match commission is earned specifically from sports betting activities.

**Sports Covered:**
- Soccer
- Tennis
- Cricket
- Matka
- Casino
- DiamondCasino

**Structure Example:**
```javascript
sportsSettings: {
  Soccer: {
    matchCommission: {
      techAdmin: { userId: ObjectId, matchCommission: 1.0 },
      admin: { userId: ObjectId, matchCommission: 0.8 },
      miniAdmin: { userId: ObjectId, matchCommission: 0.5 },
      superMaster: { userId: ObjectId, matchCommission: 0.5 },
      master: { userId: ObjectId, matchCommission: 0.8 },
      superAgent: { userId: ObjectId, matchCommission: 0.8 },
      agent: { userId: ObjectId, matchCommission: 1.5 },
      own: 1.5,
      total: 7.4
    }
  }
}
```

### 3. Session Commission (Cricket Only)
Cricket betting has an additional session commission structure for session-based betting.

**Characteristics:**
- Specific to Cricket sport
- Separate from match commission
- Applied to session betting only
- Independent commission structure

**Structure Example:**
```javascript
sportsSettings: {
  Cricket: {
    sessionCommission: {
      techAdmin: { userId: ObjectId, sessionCommission: 0.8 },
      admin: { userId: ObjectId, sessionCommission: 0.6 },
      miniAdmin: { userId: ObjectId, sessionCommission: 0.4 },
      superMaster: { userId: ObjectId, sessionCommission: 0.4 },
      master: { userId: ObjectId, sessionCommission: 0.6 },
      superAgent: { userId: ObjectId, sessionCommission: 0.6 },
      agent: { userId: ObjectId, sessionCommission: 1.2 },
      own: 1.2,
      total: 5.8
    }
  }
}
```

## Commission Calculation Process

### Step 1: Bet Placement
When a user places a bet, the system:
1. Validates the bet amount and user permissions
2. Checks exposure limits
3. Initiates commission calculation process

### Step 2: Commission Calculation
```javascript
// Example: Client places a ₹1000 bet
// Commission distribution up the hierarchy:

Client Bet: ₹1000
├── Agent Commission (2%): ₹20
├── SuperAgent Commission (1%): ₹10
├── Master Commission (1%): ₹10
├── SuperMaster Commission (0.5%): ₹5
├── MiniAdmin Commission (0.5%): ₹5
├── Admin Commission (1%): ₹10
└── TechAdmin Commission (1%): ₹10

Total Commission Distributed: ₹71
Remaining Amount: ₹929
```

### Step 3: Commission Tracking
Each user's commission is tracked in their account:
```javascript
AccountDetails: {
  profitLoss: Number,        // Updated with commission earnings
  totalSettledAmount: Number, // Total settled amounts
  Balance: Number,           // Current balance including commission
  Exposure: Number,          // Current exposure
  // ... other fields
}
```

### Step 4: Real-Time Updates
- Commission amounts are immediately calculated
- User balances are updated in real-time
- Commission reports are generated
- Audit logs are created

## Commission Settings & Configuration

### Commission Lena Ya Dena (Commission Take or Give)
```javascript
commissionLenaYaDena: {
  commissionLena: Boolean, // Can receive commission (default: true)
  commissionDena: Boolean   // Can give commission (default: false)
}
```

**Configuration Options:**
- **commissionLena: true, commissionDena: false** - User only receives commission, doesn't pay
- **commissionLena: false, commissionDena: true** - User only pays commission, doesn't receive
- **commissionLena: true, commissionDena: true** - User both receives and pays commission
- **commissionLena: false, commissionDena: false** - User neither receives nor pays commission

### Commission Calculation Methods
```javascript
commissionSettings: {
  percentageWise: Boolean,    // Commission calculated as percentage (default: true)
  partnerShipWise: Boolean    // Commission calculated as partnership share (default: false)
}
```

**Percentage Wise Calculation:**
- Commission = Bet Amount × Commission Percentage
- Example: ₹1000 × 2% = ₹20

**Partnership Wise Calculation:**
- Commission = Bet Amount × (Partnership Percentage / 100)
- Example: ₹1000 × (2/100) = ₹20

### Commission Rate Configuration
```javascript
// Setting commission rates for different levels
const commissionRates = {
  agent: 2.0,        // Agent earns 2% from clients
  superAgent: 1.0,   // SuperAgent earns 1% from agents and clients
  master: 1.0,       // Master earns 1% from superAgents, agents, and clients
  superMaster: 0.5,  // SuperMaster earns 0.5% from master and below
  miniAdmin: 0.5,     // MiniAdmin earns 0.5% from superMaster and below
  admin: 1.0,         // Admin earns 1% from miniAdmin and below
  techAdmin: 1.5     // TechAdmin earns 1.5% from admin and below
};
```

## Partnership System

### Partnership vs Commission
Partnership represents ownership percentage in the business, while commission represents earnings from betting activities.

### Partnership Structure
```javascript
panelPartnership: {
  techAdmin: { userId: ObjectId, partnership: 15 },
  admin: { userId: ObjectId, partnership: 20 },
  miniAdmin: { userId: ObjectId, partnership: 10 },
  superMaster: { userId: ObjectId, partnership: 10 },
  master: { userId: ObjectId, partnership: 15 },
  superAgent: { userId: ObjectId, partnership: 15 },
  agent: { userId: ObjectId, partnership: 10 },
  own: 5,
  total: 100
}
```

### Partnership Rules
1. **Total Partnership Must Equal 100%** - The sum of all partnership percentages must equal 100%
2. **Hierarchical Distribution** - Partnership flows from lower levels to higher levels
3. **Ownership Rights** - Higher partnership percentage gives more control and profit share
4. **Voting Rights** - Partnership percentage determines voting power in business decisions

### Partnership Benefits
- **Profit Sharing**: Share in overall business profits
- **Decision Making**: Voting rights in business decisions
- **Asset Ownership**: Share in business assets
- **Risk Sharing**: Share in business risks and liabilities

## Sports-Specific Commission

### Soccer Commission
```javascript
Soccer: {
  matchCommission: {
    techAdmin: { matchCommission: 1.0 },
    admin: { matchCommission: 0.8 },
    miniAdmin: { matchCommission: 0.5 },
    superMaster: { matchCommission: 0.5 },
    master: { matchCommission: 0.8 },
    superAgent: { matchCommission: 0.8 },
    agent: { matchCommission: 1.5 },
    own: 1.5,
    total: 7.4
  }
}
```

### Cricket Commission
```javascript
Cricket: {
  matchCommission: {
    techAdmin: { matchCommission: 1.2 },
    admin: { matchCommission: 1.0 },
    miniAdmin: { matchCommission: 0.6 },
    superMaster: { matchCommission: 0.6 },
    master: { matchCommission: 1.0 },
    superAgent: { matchCommission: 1.0 },
    agent: { matchCommission: 1.8 },
    own: 1.8,
    total: 8.0
  },
  sessionCommission: {
    techAdmin: { sessionCommission: 0.8 },
    admin: { sessionCommission: 0.6 },
    miniAdmin: { sessionCommission: 0.4 },
    superMaster: { sessionCommission: 0.4 },
    master: { sessionCommission: 0.6 },
    superAgent: { sessionCommission: 0.6 },
    agent: { sessionCommission: 1.2 },
    own: 1.2,
    total: 5.8
  }
}
```

### Casino Commission
```javascript
Casino: {
  matchCommission: {
    techAdmin: { matchCommission: 0.8 },
    admin: { matchCommission: 0.6 },
    miniAdmin: { matchCommission: 0.4 },
    superMaster: { matchCommission: 0.4 },
    master: { matchCommission: 0.6 },
    superAgent: { matchCommission: 0.6 },
    agent: { matchCommission: 1.2 },
    own: 1.2,
    total: 5.8
  }
}
```

## Commission Settlement Process

### Daily Settlement Workflow
1. **Data Collection**
   - Collect all bets placed in the last 24 hours
   - Group bets by user and upline hierarchy
   - Calculate total bet amounts per user

2. **Commission Calculation**
   - Apply commission rates to each bet
   - Calculate commission for each upline user
   - Sum total commission per user

3. **Balance Updates**
   - Add commission to user balances
   - Update profit/loss accounts
   - Record settlement transactions

4. **Report Generation**
   - Generate commission reports for each user
   - Create settlement summaries
   - Prepare audit trails

### Settlement Example
```javascript
// Daily settlement for Agent with 2% commission
const dailyBets = {
  client1: 25000,  // ₹25,000
  client2: 15000,  // ₹15,000
  client3: 10000   // ₹10,000
};

const totalBetsFromClients = 50000; // ₹50,000
const agentCommission = totalBetsFromClients * 0.02; // ₹1,000

// Update agent balance
agentBalance += agentCommission; // Add ₹1,000 to balance
agentProfitLoss += agentCommission; // Update profit/loss
```

### Settlement Timing
- **Daily Settlement**: Every day at 12:00 AM
- **Real-Time Updates**: Commission calculated immediately on bet placement
- **Monthly Reports**: Comprehensive monthly commission reports
- **Quarterly Reviews**: Detailed quarterly commission analysis

## Validation Rules

### Commission Rate Validation
1. **Percentage Limits**: All commission percentages must be between 0-100
2. **Total Commission**: Total commission cannot exceed 100% of the bet amount
3. **Minimum Commission**: Minimum commission rate is 0.01%
4. **Maximum Commission**: Maximum commission rate is 50% per level

### Hierarchy Validation
1. **Upline Commission**: Users cannot set commission rates higher than their upline
2. **Logical Progression**: Commission rates must decrease down the hierarchy
3. **Consistency Check**: Commission rates must be consistent across all sports
4. **Validation Rules**: System validates commission rates before saving

### Partnership Validation
1. **Total Partnership**: Total partnership must equal 100%
2. **Partnership Limits**: Partnership percentages must be between 0-100
3. **Ownership Validation**: Users cannot have negative partnership
4. **Hierarchy Check**: Partnership must follow hierarchy rules

### Business Rule Validation
```javascript
// Validation function example
function validateCommissionRates(user) {
  const errors = [];
  
  // Check percentage limits
  if (user.panelCommission.own < 0 || user.panelCommission.own > 50) {
    errors.push("Own commission must be between 0-50%");
  }
  
  // Check total commission
  const totalCommission = calculateTotalCommission(user);
  if (totalCommission > 100) {
    errors.push("Total commission cannot exceed 100%");
  }
  
  // Check hierarchy rules
  if (user.upline && user.panelCommission.own > user.upline.panelCommission.own) {
    errors.push("Commission cannot be higher than upline");
  }
  
  return errors;
}
```

## Commission Reports

### User-Level Reports
Each user can access:
- **Daily Commission Report**: Commission earned per day
- **Monthly Commission Summary**: Total commission for the month
- **Commission by Downline**: Commission earned from each downline user
- **Sports-wise Commission**: Commission breakdown by sport
- **Pending Settlements**: Unsettled commission amounts

### Admin Reports
Administrators can view:
- **System-wide Commission**: Total commission distributed across all users
- **Commission Trends**: Commission trends over time
- **User Performance**: Commission performance by user
- **Settlement Status**: Status of commission settlements
- **Commission Analytics**: Detailed commission analytics

### Report Structure
```javascript
// Commission report structure
const commissionReport = {
  userId: ObjectId,
  reportDate: Date,
  totalCommission: Number,
  commissionBreakdown: {
    panelCommission: Number,
    matchCommission: Number,
    sessionCommission: Number
  },
  downlineCommission: [
    {
      downlineUserId: ObjectId,
      downlineUserName: String,
      commissionEarned: Number,
      betAmount: Number
    }
  ],
  sportsBreakdown: {
    Soccer: Number,
    Tennis: Number,
    Cricket: Number,
    Matka: Number,
    Casino: Number,
    DiamondCasino: Number
  }
};
```

## Commission Management

### Manual Adjustments
Administrators can:
- **Adjust Commission Rates**: Modify commission rates for specific users
- **Process Refunds**: Handle commission refunds
- **Resolve Disputes**: Manage commission disputes
- **Set Limits**: Configure commission limits
- **Override Rules**: Override validation rules when necessary

### Commission Disputes
1. **Dispute Resolution Process**:
   - User submits dispute
   - Admin reviews dispute
   - Admin makes decision
   - Commission adjusted if needed
   - Dispute resolved

2. **Dispute Types**:
   - Incorrect commission calculation
   - Missing commission payment
   - Commission rate disputes
   - Settlement disputes

### Audit Trail
All commission changes are logged with:
- **User Information**: Who made the change
- **Timestamp**: When the change was made
- **Previous Values**: What the values were before
- **New Values**: What the values are after
- **Reason**: Why the change was made
- **Approval**: Who approved the change

```javascript
// Audit trail structure
const auditTrail = {
  userId: ObjectId,
  action: String,
  previousValues: Object,
  newValues: Object,
  reason: String,
  approvedBy: ObjectId,
  timestamp: Date,
  ipAddress: String
};
```

## API Endpoints

### Commission Management Endpoints
```javascript
// Get commission rates for a user
GET /api/commission/rates/:userId

// Update commission rates
PUT /api/commission/rates/:userId

// Get commission report
GET /api/commission/report/:userId

// Get commission history
GET /api/commission/history/:userId

// Process commission settlement
POST /api/commission/settle

// Get commission analytics
GET /api/commission/analytics
```

### Commission Calculation Endpoints
```javascript
// Calculate commission for a bet
POST /api/commission/calculate

// Get commission breakdown
GET /api/commission/breakdown/:betId

// Validate commission rates
POST /api/commission/validate
```

### Commission Reports Endpoints
```javascript
// Generate daily commission report
GET /api/commission/reports/daily

// Generate monthly commission report
GET /api/commission/reports/monthly

// Export commission report
GET /api/commission/reports/export/:format
```

## Best Practices

### Commission Rate Management
1. **Regular Review**: Review commission rates monthly
2. **Market Analysis**: Analyze market rates and adjust accordingly
3. **User Feedback**: Consider user feedback on commission rates
4. **Performance Metrics**: Use performance metrics to optimize rates

### Settlement Management
1. **Timely Settlement**: Ensure daily settlement runs on time
2. **Data Validation**: Validate all data before settlement
3. **Backup Procedures**: Maintain backup procedures for settlement
4. **Error Handling**: Implement proper error handling for settlement failures

### User Communication
1. **Clear Communication**: Communicate commission structure clearly to users
2. **Regular Updates**: Provide regular updates on commission changes
3. **Training**: Train users on commission system
4. **Support**: Provide support for commission-related queries

### System Maintenance
1. **Regular Monitoring**: Monitor commission system performance
2. **Data Cleanup**: Regular cleanup of old commission data
3. **Performance Optimization**: Optimize commission calculation performance
4. **Security**: Ensure commission data security

### Compliance
1. **Regulatory Compliance**: Ensure compliance with gambling regulations
2. **Tax Reporting**: Maintain proper tax reporting for commissions
3. **Audit Requirements**: Meet audit requirements for commission data
4. **Legal Compliance**: Ensure legal compliance in all jurisdictions

## Troubleshooting

### Common Issues

#### Commission Not Calculated
**Symptoms**: Commission not appearing in user accounts
**Causes**:
- Commission rates not set
- User hierarchy not properly configured
- Settlement process failed
- Data validation errors

**Solutions**:
1. Check commission rates are set for all upline users
2. Verify user hierarchy is correct
3. Run manual settlement process
4. Check system logs for errors

#### Incorrect Commission Amount
**Symptoms**: Commission amount doesn't match expected calculation
**Causes**:
- Wrong commission rates
- Incorrect bet amount
- Calculation errors
- Data corruption

**Solutions**:
1. Verify commission rates are correct
2. Check bet amount is accurate
3. Recalculate commission manually
4. Restore from backup if data corrupted

#### Settlement Failures
**Symptoms**: Daily settlement process fails
**Causes**:
- Database connection issues
- Insufficient system resources
- Data validation errors
- System errors

**Solutions**:
1. Check database connectivity
2. Monitor system resources
3. Fix data validation errors
4. Review system logs

#### Commission Disputes
**Symptoms**: Users disputing commission amounts
**Causes**:
- Misunderstanding of commission structure
- Incorrect commission rates
- Calculation errors
- Communication issues

**Solutions**:
1. Explain commission structure clearly
2. Verify commission rates are correct
3. Provide detailed commission breakdown
4. Improve communication

### Debugging Tools

#### Commission Calculator
```javascript
// Debug commission calculation
function debugCommissionCalculation(betAmount, userHierarchy) {
  console.log('Bet Amount:', betAmount);
  console.log('User Hierarchy:', userHierarchy);
  
  userHierarchy.forEach((user, index) => {
    const commission = betAmount * (user.commissionRate / 100);
    console.log(`Level ${index + 1}: ${user.userType} - ${user.commissionRate}% = ₹${commission}`);
  });
}
```

#### Commission Validator
```javascript
// Validate commission configuration
function validateCommissionConfig(user) {
  const issues = [];
  
  // Check commission rates
  if (user.panelCommission.own < 0) {
    issues.push('Own commission cannot be negative');
  }
  
  // Check total commission
  const total = calculateTotalCommission(user);
  if (total > 100) {
    issues.push('Total commission exceeds 100%');
  }
  
  return issues;
}
```

### Monitoring & Alerts

#### System Monitoring
- Monitor commission calculation performance
- Track settlement process success/failure
- Monitor user commission complaints
- Track commission-related errors

#### Alert System
- Alert on settlement failures
- Alert on commission calculation errors
- Alert on unusual commission patterns
- Alert on system performance issues

### Support Procedures

#### User Support
1. **Commission Queries**: Handle user commission queries
2. **Dispute Resolution**: Resolve commission disputes
3. **Training**: Provide commission system training
4. **Documentation**: Maintain commission documentation

#### Technical Support
1. **System Issues**: Resolve technical commission issues
2. **Performance**: Optimize commission system performance
3. **Updates**: Implement commission system updates
4. **Maintenance**: Perform regular system maintenance

---

## Conclusion

The BlueBet commission system provides a comprehensive, fair, and transparent revenue sharing model that benefits all stakeholders in the betting ecosystem. With its hierarchical structure, multiple commission types, and robust reporting system, it ensures proper compensation while maintaining financial integrity and regulatory compliance.

Regular monitoring, maintenance, and user education are essential for the successful operation of the commission system. The system's flexibility allows for adjustments based on market conditions and business requirements while maintaining the core principles of fairness and transparency.

