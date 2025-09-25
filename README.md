# Gaming Stake Server

A comprehensive, high-performance gaming platform with real-time casino and sports betting, advanced payment gateway management, hierarchical user system, and automated commission settlement.

## 🎯 **Platform Overview**

This is a full-featured gaming platform that supports:
- **Real-time Casino Gaming** with 70+ casino types
- **Sports Betting** with live odds and automated settlement
- **Payment Gateway Management** with multi-tenant support
- **Hierarchical User System** with role-based permissions
- **Automated Commission Settlement** with complex calculations
- **Activity Tracking** and comprehensive audit trails
- **Redis Caching** for high-performance data access
- **Socket.IO Integration** for real-time updates

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Third-party   │    │   Cron Jobs     │    │   Redis Cache   │
│      APIs       │───▶│   (Data Fetch)  │───▶│   (Storage)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Socket.IO     │◀───│   Main Server   │◀───│   Database     │
│  (Real-time)    │    │   (Express)     │    │  (PostgreSQL)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Data Flow:**
1. **Cron Jobs** fetch live data from third-party APIs
2. **Redis Cache** stores casino odds, sports data, and user sessions
3. **PostgreSQL Database** manages users, bets, transactions, and settlements
4. **Socket.IO** broadcasts real-time updates to connected clients
5. **Express Server** handles API requests and business logic

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js >= 18.0.0
- PostgreSQL >= 13
- Redis >= 6.0
- TypeScript >= 5.0

### **Installation**
```bash
# Clone the repository
git clone <repository-url>
cd game-stake-server

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.development
cp .env.example .env.production

# Configure your environment files
# .env.development for development
# .env.production for production
```

### **Environment Configuration**
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=your_database

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Server Configuration
PORT=7080
NODE_ENV=development
JWT_SECRET=your_jwt_secret

# Third-party API Configuration
DIAMOND_API_URL=http://your-diamond-api.com
FANCY_API_URL=http://your-fancy-api.com
```

### **Development**
```bash
# Start development server
npm run dev

# Start with cron jobs
npm run dev:all

# Build TypeScript
npm run build

# Type checking
npm run type-check
```

### **Production**
```bash
# Build and start production server
npm run build
npm run start

# Using PM2
npm run pm2:start

# Using Docker
npm run docker:build
npm run docker:run
```

## 📁 **Project Structure**

```
src/
├── config/                    # Configuration files
│   ├── env.ts               # Environment configuration
│   ├── database.ts          # Database connection & pooling
│   ├── redisConfig.ts       # Redis client configuration
│   ├── redisPubSub.ts       # Redis Pub/Sub setup
│   ├── socketHandler.ts     # Socket.IO event handlers
│   └── activitySocketHandler.ts # Activity tracking
├── controllers/              # API controllers
│   ├── casino/             # Casino game controllers
│   ├── sports/             # Sports betting controllers
│   ├── payment/            # Payment gateway controllers
│   ├── users/              # User management controllers
│   ├── settlement/         # Bet settlement controllers
│   └── whitelist/          # Whitelist management
├── entities/                # Database entities
│   ├── casino/             # Casino game entities
│   ├── sports/             # Sports betting entities
│   ├── payment/            # Payment gateway entities
│   ├── users/              # User hierarchy entities
│   ├── Transactions/        # Transaction entities
│   └── whitelist/          # Whitelist entities
├── services/                # Business logic services
│   ├── casino/             # Casino game services
│   ├── sports/             # Sports betting services
│   ├── CommissionService.ts # Commission calculations
│   ├── CommissionSettlementService.ts # Commission settlement
│   └── PaymentGatewayService.ts # Payment processing
├── routes/                  # API routes
│   ├── casino/             # Casino game routes
│   ├── sports/             # Sports betting routes
│   ├── payment/            # Payment gateway routes
│   ├── users/              # User management routes
│   └── whitelist/          # Whitelist routes
├── middlewares/             # Express middlewares
│   ├── RoleAuth.ts         # Role-based authentication
│   └── ActivityTrackingMiddleware.ts # Activity tracking
├── cron/                    # Scheduled jobs
│   ├── CasinoCronJob.ts    # Casino data fetching
│   └── SportsCronJob.ts    # Sports data fetching
├── debug/                   # Debug utilities
│   ├── check-casino-bets.ts # Casino bet debugging
│   ├── manual-settlement.ts # Manual settlement
│   └── debug-server.ts      # Debug server
├── Helpers/                 # Utility functions
│   ├── Request/            # Request helpers
│   └── users/              # User helpers
├── app.ts                   # Express app setup
├── server.ts               # Main server file
└── corn.server.ts          # Cron job server
```

## 🎰 **Casino Gaming System**

### **Supported Casino Types (70+ Games)**
- **Traditional Games**: poker, baccarat, teen, dragon tiger
- **Special Games**: joker1, joker20, lucky5, lucky7, lucky15
- **Race Games**: race2, race17, race20
- **Card Games**: 3cardj, patti2, trio, war
- **Number Games**: ab3, ab4, ab20, abj, notenum
- **Custom Games**: And many more dynamically discovered from Redis

### **Casino Features**
- **Real-time Odds**: Live updates every 5 seconds
- **Automated Settlement**: Automatic bet settlement when results are available
- **Manual Settlement**: Debug tools for manual settlement
- **Result Validation**: Multiple API sources for result verification
- **Bet Management**: Comprehensive bet tracking and history

### **Casino API Integration**
```javascript
// Connect to casino updates
const socket = io('http://localhost:7080');

// Listen for casino odds updates
socket.on('casinoOddsUpdate', (data) => {
  console.log('Casino Update:', data.casinoType, data.data);
});

// Request all casino data
socket.emit('requestAllCasinoData');
```

## ⚽ **Sports Betting System**

### **Supported Sports**
- **Cricket**: Live matches, ball-by-ball updates
- **Soccer**: Live matches, goal updates
- **Tennis**: Live matches, set updates

### **Sports Features**
- **Live Odds**: Real-time odds updates
- **Automated Settlement**: Automatic bet settlement using third-party APIs
- **Multiple APIs**: Diamond API and Fancy API integration
- **Market Types**: Match odds, bookmaker, period winner, etc.
- **Result Validation**: Cross-validation between multiple API sources

### **Sports Settlement Process**
1. **Batch Processing**: Groups bets by event ID for efficiency
2. **API Selection**: Diamond API for match odds, Fancy API for others
3. **Result Fetching**: Fetches results from third-party APIs
4. **Bet Settlement**: Automatically settles winning/losing bets
5. **Balance Updates**: Updates user balances and exposure

## 💳 **Payment Gateway System**

### **Gateway Types**
- **UPI**: PhonePe, Paytm, Google Pay
- **Bank Transfer**: NEFT, RTGS, IMPS
- **Digital Wallets**: Various wallet providers
- **Custom Gateways**: Extensible for new payment methods

### **Payment Features**
- **Multi-tenant Support**: Group-based gateway management
- **Permission System**: Role-based gateway access
- **File Uploads**: Gateway images, QR codes, payment proofs
- **Assignment System**: Gateway assignment to users
- **Request Processing**: Deposit/withdrawal request handling

### **Payment Gateway Management**
```bash
# Create payment gateway
POST /api/payment/createpaymentgateway

# Assign gateway to user
POST /api/payment/assigngateway

# Process deposit request
POST /api/payment/depositrequest
```

## 👥 **User Hierarchy System**

### **User Types (Hierarchical)**
```
TechAdmin (100% commission)
    ↓
Admin (90% own, 10% upline)
    ↓
MiniAdmin (10% own, 10% upline)
    ↓
SuperMaster (10% own, 10% upline)
    ↓
Master (5% own, 5% upline)
    ↓
SuperAgent (10% own, 10% upline)
    ↓
Agent (5% own, 5% upline)
    ↓
Client (0% commission)
```

### **User Features**
- **Role-based Permissions**: Granular permission system
- **Commission Calculation**: Automatic commission calculation
- **Balance Management**: Real-time balance updates
- **Exposure Tracking**: Risk management and exposure limits
- **Activity Tracking**: Comprehensive user activity logs

## 💰 **Commission System**

### **Commission Types**
- **Panel Commission**: Standard commission from downline
- **Partnership Commission**: Special partnership arrangements
- **Sport-specific**: Different rates for different sports
- **Casino Commission**: Commission from casino games

### **Commission Features**
- **Automatic Calculation**: Real-time commission calculation
- **Hierarchical Distribution**: Multi-level commission distribution
- **Settlement Processing**: Automated commission settlement
- **Transaction Tracking**: Complete commission transaction history

### **Commission Calculation**
```typescript
// Example commission calculation
const commission = await commissionService.calculateCommission(
  betId,
  userId,
  betAmount,
  SportType.CRICKET,
  CommissionType.PANEL
);
```

## 🔧 **Key Services**

### **Casino Settlement Service**
- **Automatic Settlement**: Settles casino bets when results are available
- **Manual Settlement**: Debug tools for manual settlement
- **Result Validation**: Multiple API sources for result verification
- **Batch Processing**: Efficient batch settlement processing

### **Sports Settlement Service**
- **API Integration**: Diamond and Fancy API integration
- **Market Processing**: Handles different market types
- **Result Updates**: Updates match results from APIs
- **Bet Settlement**: Automatically settles sports bets

### **Commission Service**
- **Hierarchy Management**: Manages user hierarchy relationships
- **Rate Calculation**: Calculates commission rates per user type
- **Transaction Processing**: Processes commission transactions
- **Settlement Management**: Manages commission settlements

## 📊 **Monitoring & Debugging**

### **Debug Commands**
```bash
# Check pending casino bets
npx ts-node src/debug/check-casino-bets.ts

# Manual casino settlement
npx ts-node src/debug/manual-settlement.ts poker20 109250919071557

# Check sports settlement
npx ts-node src/debug/check-match-results.ts

# Debug server
npm run debug
```

### **Health Monitoring**
```bash
# Server health check
npm run health

# Redis monitoring
npm run redis:monitor

# Log monitoring
npm run logs:casino
npm run logs:sport
```

### **Performance Monitoring**
- **Database Pool Status**: Connection pool monitoring
- **Redis Performance**: Redis connection and performance metrics
- **Socket.IO Metrics**: Real-time connection metrics
- **API Response Times**: API performance tracking

## 🐳 **Docker & Deployment**

### **Docker Commands**
```bash
# Build Docker image
npm run docker:build

# Run in development
npm run docker:dev

# Run in production
npm run docker:prod

# Stop containers
npm run docker:down
```

### **PM2 Process Management**
```bash
# Start with PM2
npm run pm2:start

# Monitor processes
npm run pm2:status

# View logs
npm run pm2:logs

# Restart processes
npm run pm2:restart
```

## 🔒 **Security Features**

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: Granular permission system
- **Input Validation**: Comprehensive input validation
- **SQL Injection Protection**: TypeORM query protection
- **File Upload Security**: Secure file upload handling
- **Rate Limiting**: API rate limiting protection
- **Activity Tracking**: Comprehensive audit trails

## 📈 **Performance Features**

- **Redis Caching**: High-performance data caching
- **Connection Pooling**: Database connection pooling
- **Batch Processing**: Efficient batch operations
- **Async Processing**: Non-blocking async operations
- **Memory Optimization**: Optimized memory usage
- **Database Indexing**: Optimized database queries

## 🛠️ **Development Tools**

### **Scripts Available**
```bash
# Development
npm run dev              # Start development server
npm run dev:all          # Start server + cron jobs
npm run build            # Build TypeScript
npm run type-check       # Type checking

# Debugging
npm run debug            # Start debug server
npm run debug:test       # Test debug endpoints
npm run debug:casino     # Casino debug info

# Monitoring
npm run health           # Health check
npm run logs             # View server logs
npm run logs:casino      # Casino logs
npm run logs:sport       # Sports logs

# Database
npm run redis:info       # Redis info
npm run redis:monitor    # Redis monitoring
npm run redis:flush      # Flush Redis

# Process Management
npm run pm2:start        # Start with PM2
npm run pm2:status       # PM2 status
npm run pm2:logs         # PM2 logs

# Docker
npm run docker:build     # Build Docker image
npm run docker:run       # Run Docker container
npm run docker:dev      # Docker development
npm run docker:prod     # Docker production
```

## 📝 **API Documentation**

### **Authentication**
All API endpoints require JWT authentication except public endpoints.

### **User Management**
- `POST /api/users/login` - User login
- `POST /api/users/logout` - User logout
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### **Casino Gaming**
- `GET /api/casino/types` - Get casino types
- `GET /api/casino/odds/:type` - Get casino odds
- `POST /api/casino/bet` - Place casino bet
- `GET /api/casino/bets` - Get user bets

### **Sports Betting**
- `GET /api/sports/matches` - Get live matches
- `GET /api/sports/odds/:matchId` - Get match odds
- `POST /api/sports/bet` - Place sports bet
- `GET /api/sports/bets` - Get user bets

### **Payment Gateway**
- `POST /api/payment/createpaymentgateway` - Create gateway
- `GET /api/payment/gateways` - Get gateways
- `POST /api/payment/assigngateway` - Assign gateway
- `POST /api/payment/depositrequest` - Create deposit request

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Database Connection Issues**
   ```bash
   # Check database connection
   npm run health
   
   # Check database logs
   tail -f logs/server.log
   ```

2. **Redis Connection Issues**
   ```bash
   # Check Redis connection
   npm run redis:info
   
   # Monitor Redis
   npm run redis:monitor
   ```

3. **Socket.IO Connection Issues**
   ```bash
   # Check socket connections
   npm run debug:status
   
   # Test socket endpoints
   npm run debug:test
   ```

### **Log Files**
- `logs/server.log` - Main server logs
- `logs/casino-socket/` - Casino socket logs
- `logs/sport-settlement/` - Sports settlement logs

## 📄 **License**

This project is proprietary and confidential. All rights reserved.

## 🤝 **Contributing**

This is a proprietary project. For internal development:

1. Follow the existing code structure
2. Add comprehensive error handling
3. Include proper logging
4. Write tests for new features
5. Update documentation

## 📞 **Support**

For technical support and questions:
- Check the debug tools and logs
- Review the troubleshooting section
- Contact the development team

---

**Built with ❤️ using Node.js, TypeScript, PostgreSQL, Redis, and Socket.IO**