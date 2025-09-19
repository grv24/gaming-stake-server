# Casino Broadcast System

A real-time casino odds broadcasting system with Redis caching and Socket.IO integration.

## 🎯 Features

- **Real-time Casino Odds**: Live updates for all casino types
- **Redis Caching**: Efficient data storage and retrieval
- **Dynamic Discovery**: Automatically discovers casino types from Redis
- **Socket.IO Integration**: Real-time client communication
- **Cron Jobs**: Automated data fetching from third-party APIs

## 🏗️ Architecture

```
Third-party APIs → Cron Jobs → Redis Cache → Socket.IO → Clients
```

### Data Flow:
1. **Cron Jobs** fetch data from third-party APIs
2. **Redis Cache** stores casino data with keys: `casino:{casinoType}:current` and `casino:{casinoType}:results`
3. **Dynamic Discovery** finds all casino types in Redis
4. **Socket.IO** broadcasts all casino data to connected clients
5. **Clients** receive real-time updates

## 🚀 Quick Start

### Prerequisites
- Node.js
- Redis
- TypeScript

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm run serve
```

## 📁 Project Structure

```
src/
├── config/
│   ├── redisConfig.ts      # Redis connection configuration
│   ├── redisPubSub.ts      # Redis Pub/Sub setup
│   └── socketHandler.ts    # Socket.IO event handlers
├── controllers/
│   ├── casino/            # Casino-related controllers
│   └── sports/            # Sports-related controllers
├── services/
│   ├── casino/            # Casino data services
│   └── sports/            # Sports data services
├── corn.server.ts         # Cron jobs for data fetching
└── server.ts              # Main server file
```

## 🔧 Key Components

### Socket Handler (`src/config/socketHandler.ts`)
- Manages WebSocket connections
- Discovers casino types from Redis
- Broadcasts real-time updates to clients

### Casino Service (`src/services/casino/CasinoService.ts`)
- Fetches casino odds from external APIs
- Stores data in Redis cache
- Publishes notifications for updates

### Cron Server (`src/corn.server.ts`)
- Runs scheduled jobs to fetch fresh data
- Updates Redis cache with new data
- Triggers real-time broadcasts

## 📡 Client Integration

Connect to the Socket.IO server and listen for casino updates:

```javascript
const socket = io('http://localhost:3000');

// Listen for casino odds updates
socket.on('casinoOddsUpdate', (data) => {
  console.log('Casino Update:', data.casinoType, data.data);
});

// Request all casino data
socket.emit('requestAllCasinoData');
```

## 🎰 Supported Casino Types

The system dynamically discovers casino types from Redis, supporting any casino type including:
- Traditional games: poker, baccarat, teen, etc.
- Special games: joker1, joker20, lucky5, etc.
- Custom implementations

## 🔄 Real-time Updates

- **Live Updates**: Casino data updates automatically
- **Redis-based**: All data sourced from Redis cache
- **Dynamic**: Adapts to any casino types in Redis
- **Efficient**: Only broadcasts what's actually in Redis

## 🎰 Casino Bet Settlement

### Check Pending Casino Bets
```bash
# Check all pending casino bets
npx ts-node src/debug/check-casino-bets.ts

# Check pending bets for specific casino type
npx ts-node src/debug/check-casino-bets.ts poker20
```

### Manual Settlement Commands
```bash
# Settle specific casino match manually
npx ts-node src/debug/manual-settlement.ts <casinoType> <matchId>

# Example: Settle Poker20 match
npx ts-node src/debug/manual-settlement.ts poker20 109250919071557

# Example: Settle Dragon Tiger 6 match
npx ts-node src/debug/manual-settlement.ts dt6 118250919060021
```

### Debug and Monitoring
```bash
# Check recent settled bets
npx ts-node src/debug/check-recent-settled-bets.ts

# Check match results for specific casino type
npx ts-node src/debug/check-poker20-results.ts

# Fetch results from third-party API
npx ts-node src/debug/fetch-poker20-results.ts
```

### Settlement Process
1. **Automatic**: Casino bets are settled automatically when result data becomes available
2. **Manual**: Use debug scripts to manually trigger settlement for specific matches
3. **Monitoring**: Check pending bets and settlement status using debug commands
4. **Troubleshooting**: Debug scripts help identify and resolve settlement issues

## 📝 License

This project is proprietary and confidential.