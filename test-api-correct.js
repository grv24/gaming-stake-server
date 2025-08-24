const axios = require('axios');

const BASE_URL = 'http://localhost:4000';

async function testApiCorrect() {
  console.log('🧪 Testing API Server with Correct Endpoints...\n');

  const endpoints = [
    '/api/v1/sports/cricket-latest-matches-diamond',
    '/api/v1/sports/soccer-latest-matches-diamond', 
    '/api/v1/sports/tennis-latest-matches-diamond',
    '/api/v1/casinos/odds'
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        timeout: 10000 // 10 second timeout
      });
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      results.push({
        endpoint,
        status: response.status,
        responseTime,
        success: true
      });

      console.log(`✅ ${endpoint}: ${responseTime}ms (Status: ${response.status})`);
    } catch (error) {
      results.push({
        endpoint,
        status: error.response?.status || 'ERROR',
        responseTime: null,
        success: false,
        error: error.message
      });

      console.log(`❌ ${endpoint}: Failed - ${error.message}`);
    }
  }

  console.log('\n📊 Results Summary:');
  console.log('==================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    const avgResponseTime = successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length;
    console.log(`📈 Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    
    const fastest = successful.reduce((min, r) => r.responseTime < min.responseTime ? r : min);
    const slowest = successful.reduce((max, r) => r.responseTime > max.responseTime ? r : max);
    
    console.log(`⚡ Fastest: ${fastest.endpoint} (${fastest.responseTime}ms)`);
    console.log(`🐌 Slowest: ${slowest.endpoint} (${slowest.responseTime}ms)`);
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed Endpoints:');
    failed.forEach(f => {
      console.log(`   - ${f.endpoint}: ${f.error}`);
    });
  }

  console.log('\n💡 Performance Analysis:');
  console.log('   - If responses are < 500ms: Excellent performance');
  console.log('   - If responses are 500ms-1s: Good performance');
  console.log('   - If responses are > 1s: May need optimization');
  console.log('   - API server is running independently (no cron interference)');
}

// Run the test
testApiCorrect().catch(console.error);
