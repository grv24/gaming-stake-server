# BlueBet Activity Tracking System Documentation

## Table of Contents
1. [Overview](#overview)
2. [Activity Tracking Components](#activity-tracking-components)
3. [Login Activity Tracking](#login-activity-tracking)
4. [Betting Activity Tracking](#betting-activity-tracking)
5. [Real-time Activity Monitoring](#real-time-activity-monitoring)
6. [Session Management](#session-management)
7. [Event-Driven Activity Processing](#event-driven-activity-processing)
8. [Performance Monitoring](#performance-monitoring)
9. [Activity Reports & Analytics](#activity-reports--analytics)
10. [API Endpoints](#api-endpoints)
11. [Database Schema](#database-schema)
12. [Security & Privacy](#security--privacy)
13. [Best Practices](#best-practices)
14. [Troubleshooting](#troubleshooting)

## Overview

The BlueBet application implements a sophisticated multi-layered activity tracking system that monitors user behavior, betting activities, login sessions, and system performance. The system provides comprehensive insights into user engagement, security monitoring, and business analytics.

### Key Features
- **Real-time Activity Monitoring**: Live tracking of user actions and system events
- **Comprehensive Login Tracking**: Detailed IP, location, and session information
- **Betting Activity Analytics**: Complete betting history and pattern analysis
- **Performance Metrics**: System performance monitoring with Prometheus
- **Event-Driven Architecture**: Asynchronous processing of user activities
- **Security Monitoring**: Suspicious activity detection and prevention

## Activity Tracking Components

### 1. Core Tracking Models

#### Base User Schema (`models/User/baseUser.js`)
```javascript
const BaseUserSchema = new mongoose.Schema({
  // ... other fields
  loginReports: [
    {
      _id: false,
      country: String,
      region: String,
      city: String,
      isp: String,
      IpAddress: String,
      loginDate: String,
      lat: String,
      lon: String,
      zip: String,
    },
  ],
  IpAddress: { type: String, default: null },
  // ... other fields
});
```

#### Current Bet Tracking (`models/Settings/User/currentBet.js`)
```javascript
const placeCurrentBetSchema = new mongoose.Schema({
  currentBet: { type: mongoose.Schema.Types.Mixed, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "BaseUserSchema" },
  userType: String, // Demo/Normal User Type
  userPts: Number,
  commission: {},
  sessionCommission: {},
  partnerShip: {},
  exposure: {
    exposure: { type: Number, default: 0 },
    totalExposure: { type: Number, default: 0 },
    isPreviousExposure: { type: Boolean, default: false },
  },
  processing: { type: Boolean, default: false },
}, { timestamps: true });
```

#### Bet History Models
- **Sports Bet History** (`models/Settings/User/BetHistory/sportBetHistory.js`)
- **Casino Bet History** (`models/Settings/User/BetHistory/casinoBetHistory.js`)

### 2. Real-time Monitoring Components

#### Socket.IO Handlers (`socket/socketHandlers.js`)
```javascript
export default function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log("A user connected");
    
    socket.on("checkLoginId", async (loginId, whiteListId) => {
      // Real-time login validation
    });
    
    socket.on("userLoginStatus", ({ event, data }) => {
      socket.broadcast.emit(event, data);
    });
    
    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });
}
```

#### Event Handlers (`events/eventHandlers.js`)
```javascript
eventEmitter.on("userUpdateEvent", async ({ userId, processBet, newBets }) => {
  // Process user activity updates
  // Calculate exposure and profit/loss
  // Update user account details
  // Emit real-time updates
});
```

## Login Activity Tracking

### Login Report Structure
Each user login is tracked with comprehensive information:

```javascript
{
  country: "India",
  region: "Maharashtra", 
  city: "Mumbai",
  isp: "Reliance Jio",
  IpAddress: "192.168.1.1",
  loginDate: "2024-01-15T10:30:00Z",
  lat: "19.0760",
  lon: "72.8777",
  zip: "400001"
}
```

### Login Tracking Implementation
```javascript
// In clientLogin function (controllers/User/auth.js)
if (IpAddress) {
  const userAddressDetails = await retrieveUserAddress(IpAddress);
  
  await ClientModel.updateOne(
    { _id: client._id },
    {
      $push: {
        loginReports: {
          $each: [userAddressDetails],
          $slice: -50, // Keep only last 50 login records
        },
      },
      $set: { IpAddress: IpAddress },
    },
    { session }
  );
}
```

### Login Report Retrieval
```javascript
// GET /api/user/get/my/login/report
export const getMyLoginReports = async (req, res) => {
  try {
    const user = await BaseUser.findById(req.profile._id).select("loginReports");
    return res.status(200).json({
      success: true,
      loginReports: user.loginReports || [],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Server error while fetching login reports.",
    });
  }
};
```

## Betting Activity Tracking

### Current Bet Tracking
The system tracks all active bets in real-time:

```javascript
// Sports Bet Tracking
const CurrentBetModel = mongoose.model("currentsportsbet", placeCurrentBetSchema);

// Casino Bet Tracking  
const CurrentCasinoBetModel = mongoose.model("currentcasinobet", placeCurrentCasinoBetSchema);
```

### Bet History Tracking
Completed bets are moved to history collections:

```javascript
// Sports Bet History Schema
const sportBetHistorySchema = new mongoose.Schema({
  currentBet: { type: mongoose.Schema.Types.Mixed },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "BaseUserSchema" },
  initialProfitLoss: {
    profit: String,
    loss: String,
  },
  isRollback: { type: Boolean, default: false },
  isCancel: { type: Boolean, default: false },
  isLedgerUpdated: { type: Boolean, default: false },
  userType: String,
  betPlacedAt: Date,
  betResult: String,
  userPts: Number,
  commission: {},
  partnerShip: {},
  exposure: {
    exposure: { type: Number, default: 0 },
    totalExposure: { type: Number, default: 0 },
    isPreviousExposure: { type: Boolean, default: false },
  },
  declaredBy: { type: mongoose.Schema.Types.ObjectId, ref: "BaseUserSchema" },
}, { timestamps: true });
```

### Bet Processing Flow
1. **Bet Placement**: Bet stored in `CurrentBetModel` or `CurrentCasinoBetModel`
2. **Real-time Updates**: Socket.IO events for live updates
3. **Result Processing**: Bets moved to history collections
4. **Commission Calculation**: Automatic commission distribution
5. **Ledger Updates**: Financial records updated

## Real-time Activity Monitoring

### Socket.IO Integration
```javascript
// Real-time balance updates
io.sockets.emit("updatechips" + userId, {
  Balance: newBalance
});

// Real-time exposure updates
io.sockets.emit("updateExposure" + userId, {
  Exposure: newExposure
});

// Login status broadcasting
io.sockets.emit(`leaveOldSignIn${userId}`, {
  success: true,
  message: "New Login Detected"
});
```

### Redis Change Streams
```javascript
// Watch for betting activity changes
export const watchCurrentSportsBets = () => {
  const changeStream = CurrentBetModel.watch();
  
  changeStream.on("change", async (change) => {
    if (["insert", "update"].includes(change.operationType)) {
      const bet = change.fullDocument;
      await redisClient.hset(
        "allSportBets",
        bet._id.toString(),
        JSON.stringify(bet)
      );
    }
  });
};
```

## Session Management

### JWT Token Management
```javascript
// Token creation with user data
const token = jwt.sign({
  userId: user._id,
  PersonalDetails: user.PersonalDetails,
  AccountDetails: user.AccountDetails,
  IpAddress: user.IpAddress,
  __type: user.__type,
}, process.env.TOKEN_KEY, {
  expiresIn: process.env.JWT_EXPIRES_IN,
});
```

### Redis Session Caching
```javascript
// Wallet session management
await redisClient.pipeline()
  .set(`walletSession${userId}`, JSON.stringify(authToken), "EX", 14400)
  .exec();
```

### Session Validation
```javascript
// Middleware for session validation
export const isUser = async (req, res, next) => {
  try {
    const token = authHeader.split(" ")[1];
    const decode = jwt.verify(token, process.env.TOKEN_KEY);
    const user = await BaseUser.findOne({ _id: decode.userId });
    
    if (!user) {
      return res.status(400).json({ success: false, error: "No User Found" });
    }
    
    req.profile = user;
    return next();
  } catch (error) {
    // Handle token errors
  }
};
```

## Event-Driven Activity Processing

### Event Emitter System
```javascript
// Event emission for user updates
eventEmitter.emit("userUpdateEvent", {
  userId: user._id,
  processBet: "sports", // or "casino"
  newBets: [betId1, betId2]
});
```

### Event Handler Processing
```javascript
eventEmitter.on("userUpdateEvent", async ({ userId, processBet, newBets }) => {
  // Calculate old exposure
  const calculateOldExposure = async (model, matchCondition, idField) => {
    return await model.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: idField,
          exposure: { $sum: "$exposure.exposure" },
        },
      },
    ]);
  };
  
  // Calculate profit/loss
  const calculateProfitLoss = async (model, matchCondition, idField) => {
    // Implementation for profit/loss calculation
  };
  
  // Update user account details
  // Emit real-time updates
});
```

## Performance Monitoring

### Prometheus Metrics
```javascript
// HTTP request metrics
const httpRequestDurationMicroseconds = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Histogram of HTTP request durations in seconds',
  buckets: [0.1, 0.3, 0.5, 1, 2, 5],
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests received',
  labelNames: ['method', 'route', 'status_code'],
});
```

### Request Monitoring Middleware
```javascript
const requestMetricsMiddleware = (req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  
  res.on('finish', () => {
    end({
      route: req.route ? req.route.path : req.url,
      status_code: res.statusCode,
      method: req.method,
    });
    
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route ? req.route.path : req.url,
      status_code: res.statusCode,
    });
  });
  
  next();
};
```

## Activity Reports & Analytics

### Profit/Loss Reports
```javascript
export const getProfitLoss = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = { userId: req.profile._id };
    
    // Date filtering
    if (startDate) {
      filter.createdAt = { $gte: new Date(startDate) };
    }
    if (endDate) {
      filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate) };
    }
    
    // Fetch betting history
    const sportBetHistoryDocs = await SportBetHistoryModel.find(filter);
    const casinoBetHistoryDocs = await CasinoBetHistoryModel.find(filter);
    
    const combinedData = [...sportBetHistoryDocs, ...casinoBetHistoryDocs];
    
    return res.status(200).json({ success: true, data: combinedData });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
```

### Account Statements
```javascript
export const getSportReportStatement = async (req, res) => {
  try {
    const sportBetsHistory = await SportBetHistoryModel.aggregate([
      { $match: { userId: req.profile._id } },
      {
        $group: {
          _id: "$currentBet.eventId",
          stake: { $sum: { $toDouble: "$currentBet.stake" } },
          profitOrLoss: {
            $sum: {
              $cond: {
                if: { $eq: ["$currentBet.loss", ""] },
                then: { $toDouble: "$currentBet.profit" },
                else: { $multiply: [-1, { $toDouble: "$currentBet.loss" }] },
              },
            },
          },
          // ... other fields
        },
      },
      { $sort: { updatedAt: -1 } },
    ]);
    
    return res.status(200).json({ success: true, data: sportBetsHistory });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
```

### User Activity Metrics
```javascript
export const getAllMembers = async (req, res) => {
  try {
    const userId = req.profile._id;
    const cacheKey = `userCount_${userId}`;
    
    // Check Redis cache
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        members: JSON.parse(cachedData),
      });
    }
    
    // Recursive count calculation
    const countDownlineUsers = async (userId) => {
      const downlineCount = await BaseUser.countDocuments({ upline: userId });
      if (downlineCount === 0) return 0;
      
      const downlineUsers = await BaseUser.find({ upline: userId }, "_id");
      let totalCount = downlineCount;
      
      for (const user of downlineUsers) {
        totalCount += await countDownlineUsers(user._id);
      }
      
      return totalCount;
    };
    
    const memberCount = await countDownlineUsers(userId);
    
    // Cache result for 1 hour
    await redisClient.set(cacheKey, JSON.stringify(memberCount), "EX", 3600);
    
    return res.status(200).json({ success: true, members: memberCount });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
```

## API Endpoints

### Activity Tracking Endpoints

#### Login Reports
- `GET /api/user/get/my/login/report` - Get user login history
- `GET /api/user/get/my/login/report?loginId=USER_ID` - Get specific user login history

#### Betting Activity
- `GET /api/sports/bet-history` - Get sports betting history
- `GET /api/casino/bet-history` - Get casino betting history
- `GET /api/sports/current-bets` - Get current sports bets
- `GET /api/casino/current-bets` - Get current casino bets

#### Reports & Analytics
- `GET /api/profit-loss` - Get profit/loss report
- `GET /api/statements/sport-report` - Get sports statement
- `GET /api/statements/casino-report` - Get casino statement
- `GET /api/user/get-all-members` - Get downline member count

#### Real-time Updates
- WebSocket connections for live updates
- Socket events for balance, exposure, and status changes

### Request Parameters

#### Date Filtering
```javascript
// Query parameters for date-based filtering
{
  startDate: "2024-01-01", // ISO date string
  endDate: "2024-01-31",   // ISO date string
  sportType: "cricket",     // Optional sport filter
  eventId: "EVENT_123"     // Optional event filter
}
```

#### Pagination
```javascript
// Pagination parameters
{
  page: 1,        // Page number (default: 1)
  limit: 10,      // Items per page (default: 10)
  searchValue: ""  // Search term for filtering
}
```

## Database Schema

### Activity Tracking Collections

#### Users Collection
```javascript
{
  _id: ObjectId,
  PersonalDetails: {
    userName: String,
    loginId: String,
    // ... other personal details
  },
  loginReports: [
    {
      country: String,
      region: String,
      city: String,
      isp: String,
      IpAddress: String,
      loginDate: String,
      lat: String,
      lon: String,
      zip: String
    }
  ],
  IpAddress: String,
  // ... other user fields
}
```

#### Current Bets Collections
```javascript
// currentsportsbet collection
{
  _id: ObjectId,
  currentBet: Mixed, // Bet details
  userId: ObjectId,
  userType: String,
  userPts: Number,
  commission: Object,
  sessionCommission: Object,
  partnerShip: Object,
  exposure: {
    exposure: Number,
    totalExposure: Number,
    isPreviousExposure: Boolean
  },
  processing: Boolean,
  createdAt: Date,
  updatedAt: Date
}

// currentcasinobet collection
{
  _id: ObjectId,
  currentBet: Mixed, // Casino bet details
  userId: ObjectId,
  userType: String,
  userPts: Number,
  commission: Object,
  partnerShip: Object,
  exposure: {
    exposure: Number,
    totalExposure: Number,
    isPreviousExposure: Boolean
  },
  processing: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### Bet History Collections
```javascript
// sportsbethistory collection
{
  _id: ObjectId,
  currentBet: Mixed, // Original bet details
  userId: ObjectId,
  initialProfitLoss: {
    profit: String,
    loss: String
  },
  isRollback: Boolean,
  isCancel: Boolean,
  isLedgerUpdated: Boolean,
  userType: String,
  betPlacedAt: Date,
  betResult: String,
  userPts: Number,
  commission: Object,
  partnerShip: Object,
  exposure: {
    exposure: Number,
    totalExposure: Number,
    isPreviousExposure: Boolean
  },
  declaredBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}

// casinobethistory collection
{
  _id: ObjectId,
  currentBet: Mixed, // Casino bet details
  userId: ObjectId,
  initialProfitLoss: {
    profit: String,
    loss: String
  },
  isRollback: Boolean,
  isCancel: Boolean,
  isLedgerUpdated: Boolean,
  userType: String,
  betPlacedAt: Date,
  userPts: Number,
  commission: Object,
  partnerShip: Object,
  exposure: {
    exposure: Number,
    totalExposure: Number,
    isPreviousExposure: Boolean
  },
  declaredBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes for Performance
```javascript
// User collection indexes
BaseUserSchema.index({ "PersonalDetails.loginId": 1, whiteList: 1 }, { unique: true });

// Bet history indexes
SportBetHistoryModel.index({ userId: 1, createdAt: -1 });
CasinoBetHistoryModel.index({ userId: 1, createdAt: -1 });

// Current bet indexes
CurrentBetModel.index({ userId: 1, createdAt: -1 });
CurrentCasinoBetModel.index({ userId: 1, createdAt: -1 });
```

## Security & Privacy

### Data Protection
- **IP Address Tracking**: Stored for security monitoring
- **Location Data**: Used for fraud detection and compliance
- **Session Management**: Secure JWT tokens with expiration
- **Data Retention**: Login reports limited to last 50 entries

### Privacy Considerations
- **User Consent**: Users should be informed about data collection
- **Data Minimization**: Only necessary data is collected
- **Access Control**: Activity data restricted by user hierarchy
- **Audit Trail**: All access to activity data is logged

### Security Measures
- **Rate Limiting**: Prevent abuse of activity endpoints
- **Input Validation**: All activity data is validated
- **SQL Injection Prevention**: Parameterized queries used
- **XSS Protection**: Output sanitization implemented

## Best Practices

### Performance Optimization
1. **Database Indexing**: Proper indexes on frequently queried fields
2. **Redis Caching**: Cache frequently accessed data
3. **Pagination**: Implement pagination for large datasets
4. **Connection Pooling**: Use connection pooling for database access
5. **Query Optimization**: Use aggregation pipelines efficiently

### Monitoring & Alerting
1. **Real-time Alerts**: Set up alerts for suspicious activities
2. **Performance Monitoring**: Monitor system performance metrics
3. **Error Tracking**: Track and log all errors
4. **Capacity Planning**: Monitor resource usage trends

### Data Management
1. **Data Archiving**: Archive old activity data
2. **Backup Strategy**: Regular backups of activity data
3. **Data Cleanup**: Regular cleanup of temporary data
4. **Compliance**: Ensure compliance with data protection regulations

### Development Guidelines
1. **Event-Driven Design**: Use events for activity processing
2. **Asynchronous Processing**: Process activities asynchronously
3. **Error Handling**: Implement comprehensive error handling
4. **Logging**: Detailed logging for debugging and monitoring

## Troubleshooting

### Common Issues

#### Login Tracking Issues
- **Problem**: Login reports not being created
- **Solution**: Check IP address retrieval service and database connection
- **Debug**: Verify `retrieveUserAddress` function and session handling

#### Real-time Updates Not Working
- **Problem**: Socket.IO events not firing
- **Solution**: Check Socket.IO connection and event emission
- **Debug**: Verify client-side Socket.IO connection and event listeners

#### Performance Issues
- **Problem**: Slow activity queries
- **Solution**: Check database indexes and query optimization
- **Debug**: Use MongoDB explain() to analyze query performance

#### Cache Issues
- **Problem**: Redis cache not working
- **Solution**: Check Redis connection and cache key management
- **Debug**: Verify Redis connection and cache expiration settings

### Debug Information
- **Enable Debug Logging**: Set appropriate log levels
- **Monitor Database Queries**: Use MongoDB profiler
- **Check Redis Operations**: Monitor Redis operations
- **Socket.IO Debug**: Enable Socket.IO debug mode
- **Performance Metrics**: Use Prometheus metrics for monitoring

### Error Codes
```javascript
// Common error responses
{
  success: false,
  error: "Error message",
  code: "ERROR_CODE", // Optional error code
  details: {} // Optional additional details
}
```

## Future Enhancements

### Planned Features
1. **Advanced Analytics**: Machine learning-based activity analysis
2. **Fraud Detection**: Automated suspicious activity detection
3. **User Behavior Insights**: Detailed user behavior analytics
4. **Real-time Dashboards**: Live activity monitoring dashboards
5. **Mobile App Integration**: Enhanced mobile activity tracking

### Scalability Improvements
1. **Microservices Architecture**: Break down into smaller services
2. **Event Streaming**: Use Apache Kafka for event streaming
3. **Database Sharding**: Implement database sharding
4. **CDN Integration**: Use CDN for static content
5. **Load Balancing**: Implement load balancing for high availability

This comprehensive activity tracking system provides the foundation for monitoring user behavior, ensuring security, and generating valuable business insights in your BlueBet application.
