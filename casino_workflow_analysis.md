# 🎰 Casino Workflow Analysis
## Game Stake Server - Complete Casino System Documentation

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [Real-time Monitoring](#real-time-monitoring)
5. [Betting Process](#betting-process)
6. [Settlement Process](#settlement-process)
7. [Game Types](#game-types)
8. [API Endpoints](#api-endpoints)
9. [Socket.IO Events](#socketio-events)
10. [Performance Optimizations](#performance-optimizations)
11. [Error Handling](#error-handling)
12. [Database Schema](#database-schema)

---

## Overview

The Game Stake Server implements a **Redis-first, real-time casino system** that eliminates the need for traditional cron jobs. The system provides:

- **Real-time game data** from external providers via Redis
- **Automatic settlement** when games complete
- **Live updates** to connected clients via Socket.IO
- **Commission management** with automatic distribution
- **High-performance** batch operations

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CASINO WORKFLOW                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

1. DATA SOURCE (External Provider)
   ↓
   Redis Keys: casino_data:{casinoType} & r_{casinoType}
   ↓

2. REAL-TIME DATA MONITORING (Socket Handler)
   ├── Change Detection (Every 10 seconds)
   ├── Game State Analysis (RUNNING → FINISHING → FINISHED)
   ├── Redis Pub/Sub Monitoring
   └── Automatic Settlement Trigger
   ↓

3. CLIENT INTERACTIONS
   ├── Join Casino Room (Socket.IO)
   ├── Request Casino Data (API)
   ├── Place Bets (API)
   └── Receive Real-time Updates
   ↓

4. BETTING PROCESS
   ├── User Places Bet → CasinoBetController
   ├── Balance Check & Deduction
   ├── Commission Calculation
   ├── Database Transaction
   └── Real-time Broadcast
   ↓

5. SETTLEMENT PROCESS
   ├── Game Completion Detection
   ├── Result Fetching (Third-party API)
   ├── Winner Determination
   ├── Bet Settlement (Won/Lost)
   ├── Balance Updates
   └── Commission Distribution
```

---

## Data Flow

### Redis Data Structure
- **`casino_data:{casinoType}`** - Current active game data
- **`r_{casinoType}`** - Historical results (top 10)

### Data Flow Pattern
```
External Provider → Redis (195.35.20.50:6379) → Your Server (7080) → Clients (Socket.IO)
```

### Key Components
1. **Redis Configuration** - Enhanced connection with health checks
2. **Socket Handler** - Real-time change detection and broadcasting
3. **Casino Service** - Data fetching and processing
4. **Settlement Service** - Automatic bet settlement
5. **Bet Controller** - Bet placement and management

---

## Real-time Monitoring

### Socket Handler Features
- **Change Detection Interval:** 10 seconds
- **Game State Analysis:**
  - `RUNNING` (lt > 5 seconds)
  - `FINISHING` (lt ≤ 5 seconds) 
  - `FINISHED` (lt = 0) → Triggers settlement
- **Automatic Settlement:** When game finishes (lt = 0)

### Monitoring Intervals
- **Database Update:** 60 seconds (configurable)
- **Change Detection:** 10 seconds (configurable)
- **Fallback Broadcast:** 30 seconds (configurable)
- **Automatic Settlement:** 60 seconds (configurable)

### Game State Analysis
```typescript
const analyzeGameTiming = (casinoType: string, gameData: any) => {
  const lt = Number(gameData.lt) || 0; // Last time (seconds remaining)
  const ft = Number(gameData.ft) || 0; // Finish time (total duration)
  
  if (lt > 5) return { phase: 'RUNNING', shouldBroadcast: true, shouldSettle: false };
  if (lt > 0 && lt <= 5) return { phase: 'FINISHING', shouldBroadcast: true, shouldSettle: false };
  if (lt === 0) return { phase: 'FINISHED', shouldBroadcast: true, shouldSettle: true };
  return { phase: 'SUSPENDED', shouldBroadcast: true, shouldSettle: false };
};
```

---

## Betting Process

### CasinoBetController.createBet()
```typescript
1. Validate bet data (stake, mid, gameSlug)
2. Check user balance with pessimistic lock
3. Deduct stake from user balance
4. Create CasinoBet record (status: "pending")
5. Calculate commission & partnership
6. Create AccountTransaction
7. Broadcast to Socket.IO clients
```

### Bet Validation
- **Required Fields:** userId, betData.stake, betData.mid, betData.gameSlug
- **Balance Check:** Pessimistic locking to prevent race conditions
- **Commission Calculation:** Automatic based on user hierarchy
- **Transaction Safety:** Database transactions with rollback support

### Bet Status Flow
```
pending → (game completion) → won/lost → (settlement) → completed
```

---

## Settlement Process

### CasinoSettlementService
```typescript
1. Detect game completion (lt = 0)
2. Fetch result from third-party API
3. Update CasinoMatchNew with winner
4. Find all pending bets for match
5. Determine win/loss for each bet
6. Update bet status (won/lost)
7. Update user balances
8. Distribute commissions
9. Create settlement transactions
```

### Settlement Triggers
1. **Automatic:** When game timer reaches 0 (lt = 0)
2. **Manual:** Admin-triggered settlement
3. **Batch:** Periodic settlement of completed games

### Settlement Types
- **Individual Settlement:** Single match settlement
- **Batch Settlement:** Multiple matches at once
- **Emergency Settlement:** Manual intervention

---

## Game Types

### Supported Casino Games
1. **Card Games:**
   - Poker (poker, poker20, poker6)
   - Teen (teen, teen20, teen9, teen8, teen20c, teenmuf)
   - Card32 (card32eu)
   - Baccarat (baccarat2)

2. **Dragon Tiger:**
   - DT6 (dt6)
   - DT20 (dt20)
   - DT202 (dt202)

3. **Special Games:**
   - War (war)
   - Joker (joker20, joker1)
   - Lucky5 (lucky5)
   - Goal (goal)
   - AAA (aaa)

4. **Andar Bahar:**
   - ABJ (abj)
   - AB4 (ab4)

5. **Other Games:**
   - Lucky7 (lucky7eu)
   - LottCard (lottcard)
   - Poison20 (poison20)
   - Bollywood Casino (btable2)

---

## API Endpoints

### Casino Data
- `GET /api/v1/casinos/data?casinoType={type}` - Get casino data from Redis
- `GET /api/v1/casinos/odds?casinoType={type}` - Get casino odds

### Betting
- `POST /api/v1/casinos/bet` - Place casino bet
- `GET /api/v1/casinos/bets` - Get user's casino bets
- `GET /api/v1/casinos/bets/{userId}` - Get specific user's bets

### Settlement
- `POST /api/v1/casinos/settle` - Manual settlement (admin)
- `POST /api/v1/casinos/settle/{matchId}` - Settle specific match

### Admin
- `GET /api/v1/casinos/pending-bets` - Get all pending bets
- `POST /api/v1/casinos/trigger-update` - Trigger manual update

---

## Socket.IO Events

### Client to Server
- `joinCasino` - Subscribe to casino updates
- `leaveCasino` - Unsubscribe from casino updates
- `joinCasinos` - Subscribe to multiple casinos
- `leaveCasinos` - Unsubscribe from multiple casinos
- `requestAllCasinoData` - Request all casino data
- `triggerCasinoUpdate` - Trigger manual update

### Server to Client
- `casinoOddsUpdate` - Real-time game updates
- `casinoBetPlaced` - Bet confirmation
- `casinoSettlement` - Settlement notifications
- `casinoUpdateTriggered` - Update confirmation

### Event Data Structure
```typescript
// casinoOddsUpdate event
{
  casinoType: string,
  data: {
    casinoType: string,
    current: any,        // Current game data
    results: any[],     // Historical results
    timestamp: number,
    source: string,      // "redis_cache" | "live_update" | "provider_update"
    hasData: boolean,
    gameState?: {
      phase: string,     // "RUNNING" | "FINISHING" | "FINISHED" | "SUSPENDED"
      shouldBroadcast: boolean,
      shouldSettle: boolean,
      timeRemaining: number,
      gameProgress: number
    }
  }
}
```

---

## Performance Optimizations

### 1. Redis-First Architecture
- Direct data access from Redis
- No database queries for real-time data
- Efficient caching strategy

### 2. Change Detection
- Only broadcast when data changes
- Smart filtering prevents unnecessary updates
- Cache comparison for efficient change detection

### 3. Batch Operations
- Single batch settlement for multiple matches
- Batch database updates
- Parallel processing where possible

### 4. Smart Filtering
- Only process active games
- Skip empty casino rooms
- Filter by subscriber count

### 5. Connection Pooling
- Efficient database connections
- Redis connection pooling
- Socket.IO connection management

### 6. Circuit Breaker Pattern
- Prevents API overload
- Automatic failure recovery
- Rate limiting and retry logic

---

## Error Handling

### Circuit Breaker Implementation
```typescript
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}
```

### Error Recovery
1. **Automatic Retry:** With exponential backoff
2. **Fallback Mechanisms:** Alternative data sources
3. **Graceful Degradation:** Continue operation on errors
4. **Health Checks:** Monitor service status

### Error Types Handled
- **API Failures:** Third-party service unavailability
- **Database Errors:** Connection issues, transaction failures
- **Redis Errors:** Connection problems, data parsing errors
- **Socket Errors:** Connection drops, message failures

---

## Database Schema

### CasinoBet Entity
```typescript
@Entity({ name: "casino_bet_updated" })
export class CasinoBet {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: String;

  @Column({ type: "varchar" })
  userType !: String;

  @Column({ type: "varchar", length: 255 })
  matchId!: string;

  @Column({ type: "jsonb", nullable: true })
  commission: any;

  @Column({ type: "jsonb", nullable: true })
  partnership: any;

  @Column({ type: "jsonb", nullable: true })
  exposure: any;

  @Column({ default: "pending" })
  status!: "pending" | "won" | "lost";

  @Column({ type: "jsonb", nullable: true })
  betData: any;

  @Column({ type: "varchar", length: 45, nullable: true })
  ipAddress!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  userAgent!: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;
}
```

### CasinoMatchNew Entity
```typescript
@Entity({ name: "casino_match_new" })
export class CasinoMatchNew {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", unique: true })
  mid!: String;

  @Column({ type: "varchar", length: 255, name: "casinotype" })
  casinoType!: string;

  @Column({ type: "varchar", nullable: true })
  winner!: string | null;

  @Column({ type: "jsonb", nullable: true })
  data: any;

  @Column({ type: "jsonb", nullable: true, default: null })
  result: any;

  @CreateDateColumn({ type: "timestamp", name: "createdat" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updatedat" })
  updatedAt!: Date;
}
```

---

## Configuration

### Environment Variables
```bash
# Casino Configuration
CASINO_SETTLEMENT_INTERVAL=60000          # 60 seconds
CASINO_CHANGE_DETECTION_INTERVAL=10000    # 10 seconds
CASINO_FALLBACK_BROADCAST_INTERVAL=30000  # 30 seconds
CASINO_AUTO_SETTLEMENT=true
CASINO_MAX_CONCURRENT_SETTLEMENTS=5

# Redis Configuration
REDIS_URL=redis://:password@195.35.20.50:6379
REDIS_HOST=195.35.20.50
REDIS_PORT=6379
REDIS_PASSWORD=Securepassword@098

# Database Configuration
POSTGRES_HOST=195.35.20.50
POSTGRES_PORT=5432
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=Securepassword@1234
POSTGRES_DATABASE=postgresdb
```

---

## Monitoring and Logging

### Log Files
- **Casino Socket Logs:** `logs/casino-socket/casino-socket-YYYY-MM-DD.log`
- **Server Logs:** `logs/server.log`
- **Settlement Logs:** `logs/settlement/`

### Key Metrics
- **Active Connections:** Number of connected clients
- **Casino Subscriptions:** Active casino room subscriptions
- **Settlement Rate:** Successful settlements per minute
- **Error Rate:** Failed operations percentage
- **Response Time:** API response times

### Health Checks
- **Database Health:** Connection status and response time
- **Redis Health:** Connection status and ping response
- **API Health:** Third-party service availability
- **Socket Health:** Active connections and room status

---

## Conclusion

The Game Stake Server's casino system represents a **highly optimized, real-time gaming platform** that eliminates traditional cron job dependencies. Key advantages include:

1. **Real-time Performance:** Sub-second data updates via Redis
2. **Automatic Settlement:** No manual intervention required
3. **Scalable Architecture:** Handles high concurrent users
4. **Robust Error Handling:** Circuit breaker and retry mechanisms
5. **Comprehensive Monitoring:** Detailed logging and health checks

This architecture provides a **superior user experience** with instant updates and automatic settlements, making it ideal for high-traffic casino operations.

---

*Generated on: $(date)*
*Version: 1.0*
*Author: Game Stake Server Team*
