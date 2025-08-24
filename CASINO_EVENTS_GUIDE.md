# Casino Events Testing Guide

## 🎰 Quick Test Setup

### 1. Start Both Services
```bash
# Start both API server and cron service
npm run start:all

# Or use the convenience script
./start-services.sh
```

### 2. Verify Services Are Running
```bash
# Check if both processes are running
ps aux | grep -E "(server|cron-service)"

# Should show something like:
# node cron-service.ts
# node src/server.ts
```

### 3. Test Casino Events

#### Option A: Manual Trigger (Recommended for testing)
```bash
# Trigger a test casino event
curl -X POST http://localhost:4000/api/v1/casinos/trigger-event \
  -H "Content-Type: application/json" \
  -d '{"casinoType": "dt6"}'
```

#### Option B: Wait for Cron Jobs
- Sports events: Every 30 seconds
- Casino events: Every second (configurable)
- Check console logs for `[CASINO]` messages

**Note**: Casino events run every second by default. You can change this by setting the `CASINO_CRON_INTERVAL` environment variable:
```env
# Examples:
CASINO_CRON_INTERVAL="*/30 * * * * *"  # Every 30 seconds
CASINO_CRON_INTERVAL="*/2 * * * *"     # Every 2 minutes
```

#### Option C: Use Test Scripts
```bash
# Test Redis Pub/Sub directly
node test-redis-pubsub.js

# Test complete event flow with Socket.IO
node test-casino-events.js
```

## 🔍 Debugging Steps

### Step 1: Check Service Logs

**API Server Logs** (should show):
```
✅ Subscribed to casino_odds_updates:* pattern
✅ [REDIS] Subscriber connected successfully
📨 [REDIS] Received pmessage - Pattern: casino_odds_updates:*, Channel: casino_odds_updates:dt6
🎰 [SOCKET] Processing casino update for: dt6
✅ [SOCKET] Successfully broadcasted casino odds update for: dt6
```

**Cron Service Logs** (should show):
```
📤 [CASINO] Publishing to channel: casino_odds_updates:dt6
📄 [CASINO] Message: {"casinoType":"dt6",...}
✅ [CASINO] Successfully published to casino_odds_updates:dt6
```

### Step 2: Check Redis Connection
```bash
# Test Redis connectivity
redis-cli ping
# Should return: PONG

# Check active channels
redis-cli pubsub channels "casino_odds_updates:*"
```

### Step 3: Test Socket.IO Connection
```bash
# Test if Socket.IO server is responding
curl http://localhost:4000/socket.io/
```

## 🚨 Common Issues

### Issue: "No events received"
**Causes:**
- Only API server running (no cron service)
- Redis connection issues
- Socket.IO not connected

**Solutions:**
1. Ensure both services are running: `npm run start:all`
2. Check Redis: `redis-cli ping`
3. Check logs for connection errors

### Issue: "Events delayed or slow"
**Causes:**
- External API slow/unresponsive
- Cron job intervals too frequent
- Network issues

**Solutions:**
1. Check external API: `curl http://localhost:8085/api/new/casino?casinoType=dt6`
2. Adjust cron intervals in `src/cron/CasinoCronJob.ts`
3. Check network connectivity

### Issue: "Socket.IO connection errors"
**Causes:**
- API server not running
- Port conflicts
- CORS issues

**Solutions:**
1. Check if API server is running: `lsof -i :4000`
2. Check for port conflicts
3. Verify CORS settings in `src/config/socketHandler.ts`

## 📊 Monitoring

### Real-time Monitoring
```bash
# Watch API server logs
tail -f logs/api-server.log

# Watch cron service logs  
tail -f logs/cron-service.log

# Monitor Redis channels
redis-cli monitor
```

### Performance Metrics
- **Event Latency**: Time from cron job to client reception
- **Event Frequency**: How often events are published
- **Connection Count**: Number of active Socket.IO connections

## 🛠️ Development Tips

### Testing Different Casino Types
```bash
# Test specific casino type
curl -X POST http://localhost:4000/api/v1/casinos/trigger-event \
  -H "Content-Type: application/json" \
  -d '{"casinoType": "teen"}'

# Available casino types: dt6, teen, poker, teen20, teen9, teen8, poker20, poker6, card32eu, war, aaa, abj, dt20, lucky7eu, dt202, teenmuf, joker20, poison20, joker1, teen20c, btable2, goal, ab4, lottcard, lucky5, baccarat2
```

### Custom Event Data
```bash
# Test with custom data
curl -X POST http://localhost:4000/api/v1/casinos/trigger-event \
  -H "Content-Type: application/json" \
  -d '{
    "casinoType": "dt6",
    "customData": {
      "test": true,
      "timestamp": "'$(date +%s)'"
    }
  }'
```

### Debug Mode
Set environment variable for verbose logging:
```bash
DEBUG=socket.io:* npm run start:all
```

## 📞 Support

If you're still experiencing issues:

1. **Check all logs** for error messages
2. **Verify Redis is running** and accessible
3. **Ensure external API** is responding
4. **Test with manual trigger** first
5. **Check network connectivity** between services

The separated architecture should resolve the original API delay issues while maintaining real-time casino event functionality.
