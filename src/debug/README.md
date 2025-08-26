# Casino Debug System

This directory contains the casino debug system that helps monitor and debug casino data flow between Redis and Socket.IO.

## 🎯 Purpose

The debug system provides real-time monitoring of:
- **Redis Data**: What's stored in Redis cache for each casino
- **Socket.IO Data**: What's being broadcast to frontend clients
- **Data Comparison**: Side-by-side comparison to identify discrepancies
- **Connection Status**: Whether both Redis and Socket.IO are working
- **Update Timestamps**: When each casino was last updated

## 📁 Files Structure

```
src/debug/
├── README.md                 # This file
├── debug-server.ts          # Express server with Socket.IO for debug data
├── public/
│   └── debug.html           # Web-based debug interface
├── casino-debug-ui.tsx      # React component for debug UI
├── useCasinoDebug.ts        # React hook for debug data
├── CasinoDebugExample.tsx   # Example React component
└── CASINO_DEBUG_README.md   # Detailed React integration guide
```

## 🚀 Quick Start

### 1. Start Debug Server (Standalone)
```bash
npm run debug:server
```

### 2. Start Debug Server with Cron
```bash
# Set environment variable to enable debug
export ENABLE_DEBUG=true
npm run cron
```

### 3. Access Debug UI
```bash
# Open debug interface in browser
npm run debug:ui
# Or manually visit: http://localhost:4001/debug
```

## 🔧 Features

### Real-time Monitoring
- **Live Updates**: Automatically receives casino data updates
- **Connection Status**: Visual indicators for Socket.IO and Redis
- **Data Comparison**: Side-by-side Redis vs Socket.IO comparison
- **Status Tracking**: Active, inactive, and error status for each casino

### Interactive Controls
- **Casino Filtering**: Select specific casino types or view all 25
- **Data Toggles**: Show/hide Redis and Socket.IO data independently
- **Manual Requests**: Trigger data requests manually
- **Refresh Data**: Force refresh of casino data

### Data Visualization
- **Summary Cards**: Quick overview of statistics
- **Individual Casino Cards**: Detailed view of each casino's data
- **Comparison Table**: Tabular view for easy comparison
- **Raw Data Viewer**: Expandable JSON data for debugging

## 🌐 API Endpoints

The debug server provides these REST endpoints:

### GET `/health`
Health check endpoint
```json
{
  "status": "ok",
  "timestamp": "2025-01-26T12:00:00.000Z",
  "redis": "ready",
  "socket": 1
}
```

### GET `/api/casino-debug`
Get all casino debug data
```json
{
  "totalCasinos": 25,
  "activeCasinos": 18,
  "inactiveCasinos": 6,
  "errors": 1,
  "lastUpdate": "2025-01-26T12:00:00.000Z",
  "redisData": { /* casino data */ },
  "socketData": { /* casino data */ }
}
```

### GET `/api/casino-debug/:casinoType`
Get specific casino data
```json
{
  "casinoType": "dt6",
  "redis": { /* redis data */ },
  "socket": { /* socket data */ }
}
```

### POST `/api/casino-debug/refresh`
Force refresh casino data
```json
{
  "success": true,
  "message": "Casino data refreshed"
}
```

## 🔌 Socket.IO Events

### `casinoDebugData`
Receives updated casino debug data
```javascript
socket.on('casinoDebugData', (data) => {
  console.log('Updated casino data:', data);
});
```

### `requestAllCasinoData`
Request all casino data
```javascript
socket.emit('requestAllCasinoData');
```

## 🎰 Supported Casino Types

All 25 casino types are supported:
- **Default Structure**: dt6, teen, poker, teen20, teen9, teen8, poker20, poker6, card32eu, war
- **Alternative API**: lucky5, joker20, joker1, ab4, lottcard
- **Different Structure**: aaa, abj, dt20, lucky7eu, dt202, teenmuf, teen20c, btable2, goal, baccarat2

## 🔧 Configuration

### Environment Variables
```bash
# Enable debug server with cron
ENABLE_DEBUG=true

# Redis connection
REDIS_URL=redis://localhost:6379

# Debug server port (default: 4001)
DEBUG_PORT=4001
```

### Development Mode
The debug server automatically starts when:
- `NODE_ENV=development` is set, OR
- `ENABLE_DEBUG=true` is set

## 📊 Data Structure

### CasinoData Interface
```typescript
interface CasinoData {
  casinoType: string;
  hasCurrent: boolean;
  hasResults: boolean;
  currentSize: number;
  resultsSize: number;
  lastRedisUpdate: Date | null;
  lastSocketUpdate: Date | null;
  redisData?: any;
  socketData?: any;
  status: 'active' | 'inactive' | 'error';
}
```

### CasinoDebugData Interface
```typescript
interface CasinoDebugData {
  redisData: Map<string, CasinoData>;
  socketData: Map<string, CasinoData>;
  totalCasinos: number;
  activeCasinos: number;
  inactiveCasinos: number;
  errors: number;
  lastUpdate: Date;
}
```

## 🔍 Troubleshooting

### Connection Issues
1. **Socket.IO Not Connecting**: Check if debug server is running on port 4001
2. **Redis Not Available**: Debug server will show Redis as disconnected
3. **No Data Updates**: Verify casino cron jobs are running

### Data Issues
1. **Empty Casino Data**: Check if casino types are being processed correctly
2. **Status Not Updating**: Verify data structure matches expected format
3. **Timestamps Missing**: Ensure dates are being set correctly

### Performance
1. **Slow Updates**: Data refreshes every 30 seconds by default
2. **Memory Usage**: Monitor Map size for large numbers of casinos
3. **Network Load**: Socket.IO broadcasts to all connected clients

## 🔗 Integration with Main System

The debug system integrates with the existing casino tracking system:
- **Casino Tracker**: Provides real-time data via Socket.IO
- **Redis Cache**: Stores casino data for comparison
- **Socket Handler**: Broadcasts updates to connected clients
- **Casino Service**: Fetches and processes casino data

## 🎯 Use Cases

1. **Development**: Monitor casino data during development
2. **Testing**: Verify data flow between Redis and Socket.IO
3. **Debugging**: Identify issues with specific casino types
4. **Monitoring**: Track system health and performance
5. **Documentation**: Understand data structures and flow

## 📝 Notes

- Debug server only runs in development mode or when explicitly enabled
- Web interface uses Tailwind CSS for styling
- Socket.IO provides real-time updates
- All data is stored in memory (not persisted)
- Debug server runs on port 4001 by default
