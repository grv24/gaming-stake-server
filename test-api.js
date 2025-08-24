const axios = require('axios');

const BASE_URL = 'http://localhost:4000';

async function testApiResponse() {
  const endpoints = [
    '/api/v1/sports/cricket',
    '/api/v1/sports/soccer', 
    '/api/v1/sports/tennis',
    '/api/v1/casinos/default'
  ];

  console.log('Testing API response times...\n');

  for (const endpoint of endpoints) {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        timeout: 30000 // 30 second timeout
      });
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`✅ ${endpoint}: ${responseTime}ms (Status: ${response.status})`);
    } catch (error) {
      console.log(`❌ ${endpoint}: Failed - ${error.message}`);
    }
  }
}

// Run the test
testApiResponse().catch(console.error);
