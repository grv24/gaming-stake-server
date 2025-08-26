# Load Testing Suite

This directory contains comprehensive load testing tools to evaluate the performance and scalability of your casino and sports betting server.

## 🚀 Quick Start

Make sure your server is running on `http://localhost:4000`, then run any of the following tests:

```bash
# Run all tests sequentially
npm run test:all

# Run individual tests
npm run test:load      # General load test
npm run test:db        # Database load test
npm run test:stress    # Stress test to find breaking point
```

## 📊 Test Types

### 1. General Load Test (`load-test.js`)

**Purpose**: Tests overall server performance with realistic user scenarios.

**Configuration**:
- **Concurrent Users**: 50
- **Requests per User**: 20
- **Total Requests**: 1,000
- **Test Duration**: ~1 minute
- **Endpoints Tested**:
  - `/api/casino/odds` (all casino types)
  - `/api/casino/results` (all casino types)
  - `/api/sports/odds`
  - `/api/users/admin/login`
  - `/api/users/agent/login`
  - `/api/users/client/login`

**Metrics Collected**:
- Response times (min, max, average, 95th/99th percentile)
- Success/failure rates
- Requests per second
- Error analysis

### 2. Database Load Test (`db-load-test.js`)

**Purpose**: Simulates database operations and connection pool usage.

**Configuration**:
- **Total Operations**: 10,000
- **Batch Size**: 100
- **Concurrent Batches**: 10
- **Operation Types**: read, write, update, delete, complex_query

**Metrics Collected**:
- Database operation performance by type
- Connection pool efficiency
- Memory usage
- Error rates

### 3. Stress Test (`stress-test.js`)

**Purpose**: Finds the breaking point by gradually increasing load.

**Configuration**:
- **Start Users**: 10
- **Max Users**: 500
- **User Increment**: 10
- **Requests per User**: 10
- **Breaking Point Detection**: <95% success rate

**Metrics Collected**:
- Breaking point identification
- Performance degradation analysis
- Phase-by-phase results
- Optimal user capacity

## 🎯 Casino Types Tested

The load tests cover all supported casino types:

### Default API Casino Types:
- `dt6`, `aaa`, `abj`, `dt20`, `lucky7eu`, `dt202`
- `teenmuf`, `teen20c`, `btable2`, `goal`, `baccarat2`
- `teen8`, `teen9`, `teen20`, `teen`
- `poker`, `poker6`, `poker20`, `card32eu`, `war`

### Alternative API Casino Types:
- `lucky5`, `joker20`, `joker1`, `ab4`, `lottcard`

## 📈 Understanding Results

### Response Time Percentiles
- **95th Percentile**: 95% of requests complete within this time
- **99th Percentile**: 99% of requests complete within this time
- **Average**: Mean response time across all requests

### Success Rate
- **Excellent**: >99%
- **Good**: 95-99%
- **Acceptable**: 90-95%
- **Poor**: <90%

### Requests per Second
- **High Performance**: >1000 req/s
- **Good Performance**: 500-1000 req/s
- **Acceptable**: 100-500 req/s
- **Poor**: <100 req/s

## 🔧 Customization

### Modify Load Test Configuration

Edit the `CONFIG` object in `load-test.js`:

```javascript
const CONFIG = {
  BASE_URL: 'http://localhost:4000',
  CONCURRENT_USERS: 50,        // Increase for higher load
  REQUESTS_PER_USER: 20,       // More requests per user
  DELAY_BETWEEN_REQUESTS: 100, // Reduce for faster testing
  TEST_DURATION: 60000,        // Test duration in ms
  // ... other settings
};
```

### Modify Database Test Configuration

Edit the `DB_CONFIG` object in `db-load-test.js`:

```javascript
const DB_CONFIG = {
  OPERATIONS: 10000,           // Total operations
  BATCH_SIZE: 100,             // Operations per batch
  CONCURRENT_BATCHES: 10,      // Concurrent batches
  // ... other settings
};
```

### Modify Stress Test Configuration

Edit the `STRESS_CONFIG` object in `stress-test.js`:

```javascript
const STRESS_CONFIG = {
  START_USERS: 10,             // Starting user count
  MAX_USERS: 500,              // Maximum users to test
  USER_INCREMENT: 10,          // Users added per phase
  REQUESTS_PER_USER: 10,       // Requests per user
  // ... other settings
};
```

## 🚨 Troubleshooting

### Common Issues

1. **Server Not Running**
   ```
   ❌ Error: connect ECONNREFUSED 127.0.0.1:4000
   ```
   **Solution**: Start your server with `npm run dev`

2. **High Error Rates**
   - Check server logs for errors
   - Verify database connectivity
   - Check Redis connection

3. **Slow Response Times**
   - Monitor database performance
   - Check for memory leaks
   - Verify external API responses

### Performance Optimization Tips

1. **Database Optimization**
   - Add database indexes
   - Optimize queries
   - Use connection pooling

2. **Server Optimization**
   - Enable compression
   - Use caching (Redis)
   - Optimize middleware

3. **External API Optimization**
   - Implement request caching
   - Use connection pooling
   - Add retry mechanisms

## 📊 Sample Results

### Load Test Results
```
============================================================
📈 LOAD TEST RESULTS
============================================================
⏱️  Total Test Time: 45.23s
📊 Total Requests: 1000
✅ Successful Requests: 987
❌ Failed Requests: 13
📈 Success Rate: 98.70%
🚀 Requests/Second: 22.11

⏱️  Response Times:
   - Average: 125.45ms
   - Minimum: 45.12ms
   - Maximum: 2345.67ms
   - 95th Percentile: 456.78ms
   - 99th Percentile: 1234.56ms
============================================================
```

### Stress Test Results
```
============================================================
🔥 STRESS TEST RESULTS
============================================================
⏱️  Total Test Time: 180.45s
📊 Total Phases: 15

💥 Breaking Point Found:
   - Users: 120
   - Phase: 12
   - Success Rate: 92.50%
   - Avg Response Time: 234.56ms

📈 Performance Summary:
   - Best Performance: 50 users, 45.67 req/s
   - Worst Performance: 120 users, 92.50% success rate
============================================================
```

## 🔄 Continuous Testing

For continuous monitoring, you can set up automated testing:

```bash
# Run tests every hour
while true; do
  npm run test:load
  sleep 3600
done
```

## 📝 Notes

- Tests are designed to be non-destructive
- No actual bets or transactions are created
- All test data is simulated
- Results may vary based on system resources
- Run tests during off-peak hours for accurate results

## 🤝 Contributing

To add new test scenarios:

1. Create a new test file
2. Add corresponding npm script
3. Update this README
4. Test thoroughly before committing
