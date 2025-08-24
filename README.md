# Casino Server

## 🏗️ Architecture

The application is now split into two independent services to prevent performance issues:

### 1. **API Server** (`src/server.ts`)
- Handles all HTTP requests and WebSocket connections
- Runs on port 4000 by default
- No cron jobs - pure API service for fast responses

### 2. **Cron Service** (`cron-service.ts`)
- Runs independently in a separate process
- Handles all background data fetching and updates
- Updates Redis cache and database
- No HTTP server - pure background processing

## 🚀 Quick Start

### Option 1: Run Both Services Together
```bash
# Start both API server and cron service
npm run start:all

# Or use the convenience script
./start-services.sh
```

### Option 2: Run Services Separately
```bash
# Terminal 1: Start API server only
npm run api

# Terminal 2: Start cron service only  
npm run cron
```

### Option 3: Development Mode
```bash
# Run both in development mode with auto-reload
npm run dev:all

# Or separately
npm run api:dev    # API server with nodemon
npm run cron:dev   # Cron service with nodemon
```

## 📊 Service Management

### Available Scripts
- `npm run api` - Start API server only
- `npm run cron` - Start cron service only
- `npm run start:all` - Start both services together
- `npm run dev:all` - Start both in development mode
- `npm run build` - Build TypeScript to JavaScript

### Environment Variables

Create a `.env` file:
```env
# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USERNAME=your_username
POSTGRES_PASSWORD=your_password
POSTGRES_DATABASE=your_database

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Server Configuration
PORT=4000
NODE_ENV=development

# External API Configuration
EXTERNAL_API_BASE_URL=http://localhost:8085
```

## ⏰ Cron Job Configuration

### Sports Cron Job
- **Interval**: Every 30 seconds
- **Purpose**: Fetch sports odds data
- **Storage**: Redis cache + database updates

### Casino Cron Job  
- **Interval**: Every second (configurable)
- **Purpose**: Fetch casino data for 26 casino types
- **Processing**: Batch processing (3 types at a time)
- **Storage**: Redis cache + database updates
- **Configuration**: Set `CASINO_CRON_INTERVAL` environment variable to change interval

### Environment Variables for Cron Jobs
```env
# Casino cron job interval (default: every second)
CASINO_CRON_INTERVAL="* * * * * *"  # Every second
# CASINO_CRON_INTERVAL="*/30 * * * * *"  # Every 30 seconds  
# CASINO_CRON_INTERVAL="*/2 * * * *"     # Every 2 minutes
```

## 🔧 Troubleshooting

### API Response Delays
If you experience slow API responses:

1. **Check if cron service is running**:
   ```bash
   ps aux | grep cron-service
   ```

2. **Run API server only** (without cron service):
   ```bash
   npm run api
   ```

3. **Check external API health**:
   ```bash
   curl http://localhost:8085/api/new/getlistdata
   ```

### Casino Events Not Triggering

If `casinoOddsUpdate` events are not working:

1. **Check if both services are running**:
   ```bash
   # Should show both processes
   ps aux | grep -E "(server|cron-service)"
   ```

2. **Test Redis Pub/Sub directly**:
   ```bash
   node test-redis-pubsub.js
   ```

3. **Test complete event flow**:
   ```bash
   node test-casino-events.js
   ```

4. **Manual trigger test**:
   ```bash
   # Trigger a test event via API
   curl -X POST http://localhost:4000/api/v1/casinos/trigger-event \
     -H "Content-Type: application/json" \
     -d '{"casinoType": "dt6"}'
   ```

5. **Check logs for debugging**:
   - API server logs: Look for `[SOCKET]` and `[REDIS]` messages
   - Cron service logs: Look for `[CASINO]` messages
   - Both should show successful publishing and receiving

6. **Verify Redis connection**:
   ```bash
   # Check if Redis is running
   redis-cli ping
   
   # Check Redis channels
   redis-cli pubsub channels "casino_odds_updates:*"
   ```

### Common Issues and Solutions

#### Issue: Events not received by clients
**Solution**: Ensure both API server and cron service are running
```bash
npm run start:all
```

#### Issue: Redis connection errors
**Solution**: Check Redis configuration in `.env`
```env
REDIS_URL=redis://localhost:6379
```

#### Issue: Socket.IO connection errors
**Solution**: Check if API server is running on correct port
```bash
lsof -i :4000
```

#### Issue: Cron service not publishing events
**Solution**: Check external API connectivity
```bash
curl http://localhost:8085/api/new/casino?casinoType=dt6
```

### Service Separation Benefits
- ✅ **No API delays** - Cron jobs run in separate process
- ✅ **Independent scaling** - Scale API and cron separately  
- ✅ **Better monitoring** - Separate logs and metrics
- ✅ **Fault isolation** - Cron issues don't affect API
- ✅ **Resource optimization** - Each service uses optimal resources

## 📈 Performance Monitoring

### Test API Response Times
```bash
# Use the included test script
node test-api.js
```

### Monitor Services
```bash
# Check running processes
ps aux | grep -E "(server|cron-service)"

# Check ports
lsof -i :4000  # API server
```

## 🛠️ Development

### Project Structure
```
├── src/
│   ├── server.ts          # Main API server
│   ├── app.ts            # Express app setup
│   ├── controllers/      # API controllers
│   ├── services/         # Business logic
│   ├── entities/         # Database models
│   └── cron/            # Cron job logic
├── cron-service.ts       # Independent cron service
├── start-services.sh     # Service manager script
└── test-api.js          # API performance test
```

### Adding New Cron Jobs
1. Add logic to `src/cron/` directory
2. Import and start in `cron-service.ts`
3. Use the same DataSource pattern for database access

## 🔒 Security Notes
- Cron service runs with minimal logging
- Database connections are properly managed
- Graceful shutdown handling for both services
- Environment-based configuration