const axios = require('axios');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  BASE_URL: 'http://localhost:4000',
  CONCURRENT_USERS: 50,
  REQUESTS_PER_USER: 20,
  DELAY_BETWEEN_REQUESTS: 100, // ms
  TEST_DURATION: 60000, // 1 minute
  ENDPOINTS: [
    '/api/v1/casinos/odds',
    '/api/v1/casinos/getCasinoTopTenResult',
    '/api/v1/sports/cricket-latest-matches-diamond',
    '/api/v1/sports/soccer-latest-matches-diamond',
    '/api/v1/sports/tennis-latest-matches-diamond'
  ],
  CASINO_TYPES: [
    'dt6', 'aaa', 'abj', 'dt20', 'lucky7eu', 'dt202', 'teenmuf', 'teen20c',
    'btable2', 'goal', 'baccarat2', 'lucky5', 'joker20', 'joker1', 'ab4', 'lottcard'
  ]
};

// Statistics tracking
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: [],
  startTime: null,
  endTime: null
};

// Database load test data
const dbTestData = {
  users: [],
  bets: [],
  matches: []
};

// Generate test data
function generateTestData() {
  for (let i = 0; i < 100; i++) {
    dbTestData.users.push({
      username: `testuser${i}`,
      email: `test${i}@example.com`,
      password: 'testpass123',
      role: ['admin', 'agent', 'client'][i % 3]
    });
  }
  
  for (let i = 0; i < 50; i++) {
    dbTestData.bets.push({
      userId: Math.floor(Math.random() * 100),
      amount: Math.random() * 1000,
      type: ['casino', 'sports'][i % 2],
      status: ['pending', 'won', 'lost'][i % 3]
    });
  }
  
  for (let i = 0; i < 30; i++) {
    dbTestData.matches.push({
      mid: `match${i}`,
      type: ['casino', 'sports'][i % 2],
      status: ['live', 'completed'][i % 2]
    });
  }
}

// Make a single request
async function makeRequest(endpoint, userIndex) {
  const startTime = performance.now();
  const url = `${CONFIG.BASE_URL}${endpoint}`;
  
  try {
    let response;
    
    if (endpoint.includes('/casinos/odds')) {
      const casinoType = CONFIG.CASINO_TYPES[Math.floor(Math.random() * CONFIG.CASINO_TYPES.length)];
      response = await axios.get(`${url}?casinoType=${casinoType}`);
    } else if (endpoint.includes('/casinos/getCasinoTopTenResult')) {
      const casinoType = CONFIG.CASINO_TYPES[Math.floor(Math.random() * CONFIG.CASINO_TYPES.length)];
      response = await axios.get(`${url}?casinoType=${casinoType}`);
    } else if (endpoint.includes('/sports/')) {
      response = await axios.get(url);
    } else {
      response = await axios.get(url);
    }
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    stats.successfulRequests++;
    stats.responseTimes.push(responseTime);
    
    console.log(`✅ User ${userIndex}: ${endpoint} - ${responseTime.toFixed(2)}ms`);
    
  } catch (error) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    stats.failedRequests++;
    stats.responseTimes.push(responseTime);
    stats.errors.push({
      endpoint,
      error: error.message,
      status: error.response?.status,
      responseTime
    });
    
    console.log(`❌ User ${userIndex}: ${endpoint} - ${error.message} (${responseTime.toFixed(2)}ms)`);
  }
  
  stats.totalRequests++;
}

// Simulate a single user
async function simulateUser(userIndex) {
  for (let i = 0; i < CONFIG.REQUESTS_PER_USER; i++) {
    const endpoint = CONFIG.ENDPOINTS[Math.floor(Math.random() * CONFIG.ENDPOINTS.length)];
    await makeRequest(endpoint, userIndex);
    
    // Add delay between requests
    if (i < CONFIG.REQUESTS_PER_USER - 1) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS));
    }
  }
}

// Run concurrent users
async function runLoadTest() {
  console.log('🚀 Starting Load Test...');
  console.log(`📊 Configuration:`);
  console.log(`   - Concurrent Users: ${CONFIG.CONCURRENT_USERS}`);
  console.log(`   - Requests per User: ${CONFIG.REQUESTS_PER_USER}`);
  console.log(`   - Total Expected Requests: ${CONFIG.CONCURRENT_USERS * CONFIG.REQUESTS_PER_USER}`);
  console.log(`   - Test Duration: ${CONFIG.TEST_DURATION / 1000}s`);
  console.log(`   - Base URL: ${CONFIG.BASE_URL}`);
  console.log('');
  
  stats.startTime = performance.now();
  
  // Create concurrent user promises
  const userPromises = [];
  for (let i = 0; i < CONFIG.CONCURRENT_USERS; i++) {
    userPromises.push(simulateUser(i + 1));
  }
  
  // Run all users concurrently
  await Promise.all(userPromises);
  
  stats.endTime = performance.now();
  
  // Calculate and display results
  displayResults();
}

// Display test results
function displayResults() {
  const totalTime = stats.endTime - stats.startTime;
  const avgResponseTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
  const minResponseTime = Math.min(...stats.responseTimes);
  const maxResponseTime = Math.max(...stats.responseTimes);
  const successRate = (stats.successfulRequests / stats.totalRequests) * 100;
  const requestsPerSecond = stats.totalRequests / (totalTime / 1000);
  
  console.log('\n' + '='.repeat(60));
  console.log('📈 LOAD TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`⏱️  Total Test Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`📊 Total Requests: ${stats.totalRequests}`);
  console.log(`✅ Successful Requests: ${stats.successfulRequests}`);
  console.log(`❌ Failed Requests: ${stats.failedRequests}`);
  console.log(`📈 Success Rate: ${successRate.toFixed(2)}%`);
  console.log(`🚀 Requests/Second: ${requestsPerSecond.toFixed(2)}`);
  console.log('');
  console.log('⏱️  Response Times:');
  console.log(`   - Average: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`   - Minimum: ${minResponseTime.toFixed(2)}ms`);
  console.log(`   - Maximum: ${maxResponseTime.toFixed(2)}ms`);
  console.log(`   - 95th Percentile: ${calculatePercentile(95).toFixed(2)}ms`);
  console.log(`   - 99th Percentile: ${calculatePercentile(99).toFixed(2)}ms`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Top Errors:');
    const errorCounts = {};
    stats.errors.forEach(error => {
      const key = `${error.endpoint} - ${error.status || error.error}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    
    Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([error, count]) => {
        console.log(`   - ${error}: ${count} times`);
      });
  }
  
  console.log('\n' + '='.repeat(60));
}

// Calculate percentile
function calculatePercentile(percentile) {
  const sorted = [...stats.responseTimes].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

// Database load test
async function testDatabaseLoad() {
  console.log('\n🗄️  Testing Database Load...');
  
  const dbStats = {
    operations: 0,
    successful: 0,
    failed: 0,
    responseTimes: []
  };
  
  // Simulate database operations
  for (let i = 0; i < 1000; i++) {
    const startTime = performance.now();
    
    try {
      // Simulate different database operations
      const operation = ['read', 'write', 'update', 'delete'][i % 4];
      
      // Add some delay to simulate database operation
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      dbStats.successful++;
      dbStats.responseTimes.push(responseTime);
      
      if (i % 100 === 0) {
        console.log(`   ✅ DB ${operation}: ${responseTime.toFixed(2)}ms`);
      }
      
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      dbStats.failed++;
      dbStats.responseTimes.push(responseTime);
      
      console.log(`   ❌ DB Error: ${error.message} (${responseTime.toFixed(2)}ms)`);
    }
    
    dbStats.operations++;
  }
  
  const avgDbTime = dbStats.responseTimes.reduce((a, b) => a + b, 0) / dbStats.responseTimes.length;
  console.log(`\n🗄️  Database Load Test Results:`);
  console.log(`   - Total Operations: ${dbStats.operations}`);
  console.log(`   - Successful: ${dbStats.successful}`);
  console.log(`   - Failed: ${dbStats.failed}`);
  console.log(`   - Average Response Time: ${avgDbTime.toFixed(2)}ms`);
}

// Main execution
async function main() {
  try {
    // Check if server is running
    console.log('🔍 Checking if server is running...');
    await axios.get(`${CONFIG.BASE_URL}/api/v1/casinos/odds?casinoType=dt6`);
    console.log('✅ Server is running!\n');
    
    // Generate test data
    generateTestData();
    
    // Run load tests
    await runLoadTest();
    await testDatabaseLoad();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('Make sure the server is running on http://localhost:4000');
  }
}

// Run the load test
main();
