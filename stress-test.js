const axios = require('axios');
const { performance } = require('perf_hooks');

// Stress test configuration
const STRESS_CONFIG = {
  BASE_URL: 'http://localhost:4000',
  START_USERS: 10,
  MAX_USERS: 500,
  USER_INCREMENT: 10,
  REQUESTS_PER_USER: 10,
  DELAY_BETWEEN_PHASES: 2000, // 2 seconds
  ENDPOINTS: [
    '/api/v1/casinos/odds?casinoType=dt6',
    '/api/v1/casinos/getCasinoTopTenResult?casinoType=dt6',
    '/api/v1/sports/cricket-latest-matches-diamond'
  ]
};

// Stress test statistics
const stressStats = {
  phases: [],
  currentPhase: 0,
  breakingPoint: null,
  startTime: null,
  endTime: null
};

// Phase statistics
class PhaseStats {
  constructor(userCount) {
    this.userCount = userCount;
    this.startTime = null;
    this.endTime = null;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.responseTimes = [];
    this.errors = [];
  }
  
  get successRate() {
    return this.totalRequests > 0 ? (this.successfulRequests / this.totalRequests) * 100 : 0;
  }
  
  get avgResponseTime() {
    return this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0;
  }
  
  get requestsPerSecond() {
    const duration = this.endTime ? (this.endTime - this.startTime) / 1000 : 0;
    return duration > 0 ? this.totalRequests / duration : 0;
  }
}

// Make a single request
async function makeRequest(endpoint, userIndex) {
  const startTime = performance.now();
  const url = `${STRESS_CONFIG.BASE_URL}${endpoint}`;
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    return { success: true, responseTime, status: response.status };
    
  } catch (error) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    return { 
      success: false, 
      responseTime, 
      error: error.message, 
      status: error.response?.status 
    };
  }
}

// Simulate a single user
async function simulateUser(userIndex, phaseStats) {
  for (let i = 0; i < STRESS_CONFIG.REQUESTS_PER_USER; i++) {
    const endpoint = STRESS_CONFIG.ENDPOINTS[Math.floor(Math.random() * STRESS_CONFIG.ENDPOINTS.length)];
    const result = await makeRequest(endpoint, userIndex);
    
    // Update phase statistics
    phaseStats.totalRequests++;
    phaseStats.responseTimes.push(result.responseTime);
    
    if (result.success) {
      phaseStats.successfulRequests++;
    } else {
      phaseStats.failedRequests++;
      phaseStats.errors.push(result);
    }
  }
}

// Run a stress test phase
async function runPhase(userCount) {
  const phaseStats = new PhaseStats(userCount);
  stressStats.phases.push(phaseStats);
  stressStats.currentPhase++;
  
  console.log(`\n🔥 Phase ${stressStats.currentPhase}: Testing with ${userCount} concurrent users...`);
  
  phaseStats.startTime = performance.now();
  
  // Create user promises
  const userPromises = [];
  for (let i = 0; i < userCount; i++) {
    userPromises.push(simulateUser(i + 1, phaseStats));
  }
  
  // Run all users concurrently
  await Promise.all(userPromises);
  
  phaseStats.endTime = performance.now();
  
  // Display phase results
  displayPhaseResults(phaseStats);
  
  // Check if this is the breaking point
  if (phaseStats.successRate < 95 && !stressStats.breakingPoint) {
    stressStats.breakingPoint = {
      userCount,
      phase: stressStats.currentPhase,
      successRate: phaseStats.successRate,
      avgResponseTime: phaseStats.avgResponseTime
    };
  }
  
  return phaseStats;
}

// Display phase results
function displayPhaseResults(phaseStats) {
  const duration = (phaseStats.endTime - phaseStats.startTime) / 1000;
  
  console.log(`   📊 Results:`);
  console.log(`      - Duration: ${duration.toFixed(2)}s`);
  console.log(`      - Total Requests: ${phaseStats.totalRequests}`);
  console.log(`      - Successful: ${phaseStats.successfulRequests}`);
  console.log(`      - Failed: ${phaseStats.failedRequests}`);
  console.log(`      - Success Rate: ${phaseStats.successRate.toFixed(2)}%`);
  console.log(`      - Requests/Second: ${phaseStats.requestsPerSecond.toFixed(2)}`);
  console.log(`      - Avg Response Time: ${phaseStats.avgResponseTime.toFixed(2)}ms`);
  
  if (phaseStats.errors.length > 0) {
    const errorTypes = {};
    phaseStats.errors.forEach(error => {
      const key = error.status || error.error;
      errorTypes[key] = (errorTypes[key] || 0) + 1;
    });
    
    console.log(`      - Top Errors:`);
    Object.entries(errorTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .forEach(([error, count]) => {
        console.log(`        * ${error}: ${count} times`);
      });
  }
}

// Run the complete stress test
async function runStressTest() {
  console.log('🚀 Starting Stress Test...');
  console.log(`📊 Configuration:`);
  console.log(`   - Start Users: ${STRESS_CONFIG.START_USERS}`);
  console.log(`   - Max Users: ${STRESS_CONFIG.MAX_USERS}`);
  console.log(`   - User Increment: ${STRESS_CONFIG.USER_INCREMENT}`);
  console.log(`   - Requests per User: ${STRESS_CONFIG.REQUESTS_PER_USER}`);
  console.log(`   - Base URL: ${STRESS_CONFIG.BASE_URL}`);
  console.log('');
  
  stressStats.startTime = performance.now();
  
  // Check if server is running
  try {
    await axios.get(`${STRESS_CONFIG.BASE_URL}/api/v1/casinos/odds?casinoType=dt6`);
    console.log('✅ Server is running and ready for stress test!\n');
  } catch (error) {
    console.error('❌ Server is not running on', STRESS_CONFIG.BASE_URL);
    return;
  }
  
  // Run phases with increasing load
  for (let userCount = STRESS_CONFIG.START_USERS; userCount <= STRESS_CONFIG.MAX_USERS; userCount += STRESS_CONFIG.USER_INCREMENT) {
    const phaseStats = await runPhase(userCount);
    
    // Stop if we've found the breaking point and success rate is very low
    if (stressStats.breakingPoint && phaseStats.successRate < 50) {
      console.log(`\n💥 Breaking point reached! System is failing with ${userCount} users.`);
      break;
    }
    
    // Add delay between phases
    if (userCount < STRESS_CONFIG.MAX_USERS) {
      console.log(`   ⏳ Waiting ${STRESS_CONFIG.DELAY_BETWEEN_PHASES / 1000}s before next phase...`);
      await new Promise(resolve => setTimeout(resolve, STRESS_CONFIG.DELAY_BETWEEN_PHASES));
    }
  }
  
  stressStats.endTime = performance.now();
  
  // Display final results
  displayStressTestResults();
}

// Display final stress test results
function displayStressTestResults() {
  const totalTime = stressStats.endTime - stressStats.startTime;
  
  console.log('\n' + '='.repeat(60));
  console.log('🔥 STRESS TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`⏱️  Total Test Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`📊 Total Phases: ${stressStats.phases.length}`);
  
  if (stressStats.breakingPoint) {
    console.log(`💥 Breaking Point Found:`);
    console.log(`   - Users: ${stressStats.breakingPoint.userCount}`);
    console.log(`   - Phase: ${stressStats.breakingPoint.phase}`);
    console.log(`   - Success Rate: ${stressStats.breakingPoint.successRate.toFixed(2)}%`);
    console.log(`   - Avg Response Time: ${stressStats.breakingPoint.avgResponseTime.toFixed(2)}ms`);
  } else {
    console.log(`✅ No breaking point found up to ${STRESS_CONFIG.MAX_USERS} users`);
  }
  
  console.log('\n📈 Performance Summary:');
  
  const bestPhase = stressStats.phases.reduce((best, current) => 
    current.requestsPerSecond > best.requestsPerSecond ? current : best
  );
  
  const worstPhase = stressStats.phases.reduce((worst, current) => 
    current.successRate < worst.successRate ? current : worst
  );
  
  console.log(`   - Best Performance: ${bestPhase.userCount} users, ${bestPhase.requestsPerSecond.toFixed(2)} req/s`);
  console.log(`   - Worst Performance: ${worstPhase.userCount} users, ${worstPhase.successRate.toFixed(2)}% success rate`);
  
  console.log('\n📊 Phase Details:');
  stressStats.phases.forEach((phase, index) => {
    console.log(`   Phase ${index + 1} (${phase.userCount} users):`);
    console.log(`     Success Rate: ${phase.successRate.toFixed(2)}%`);
    console.log(`     Requests/Second: ${phase.requestsPerSecond.toFixed(2)}`);
    console.log(`     Avg Response Time: ${phase.avgResponseTime.toFixed(2)}ms`);
  });
  
  console.log('\n' + '='.repeat(60));
}

// Memory monitoring
function monitorMemory() {
  const memUsage = process.memoryUsage();
  console.log(`\n🧠 Memory Usage:`);
  console.log(`   - RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   - Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   - Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
}

// Main execution
async function main() {
  try {
    await runStressTest();
    monitorMemory();
    console.log('\n✅ Stress test completed!');
  } catch (error) {
    console.error('❌ Error during stress test:', error.message);
  }
}

// Run the stress test
main();
