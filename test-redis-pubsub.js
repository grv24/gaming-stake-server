const Redis = require('ioredis');

// Test Redis Pub/Sub for casino odds updates
async function testRedisPubSub() {
  console.log('🧪 Testing Redis Pub/Sub for casino odds updates...\n');

  const redisPublisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const redisSubscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  // Test casino types
  const casinoTypes = ['dt6', 'teen', 'poker'];

  try {
    // Subscribe to casino odds updates
    await redisSubscriber.psubscribe('casino_odds_updates:*');
    console.log('✅ Subscribed to casino_odds_updates:* pattern');

    // Listen for messages
    redisSubscriber.on('pmessage', (pattern, channel, message) => {
      console.log(`📨 Received message on channel: ${channel}`);
      console.log(`📄 Message: ${message}`);
      
      try {
        const data = JSON.parse(message);
        console.log(`✅ Parsed data:`, JSON.stringify(data, null, 2));
      } catch (error) {
        console.log(`❌ Failed to parse message: ${error.message}`);
      }
      console.log('---');
    });

    // Publish test messages
    console.log('📤 Publishing test messages...\n');

    for (const casinoType of casinoTypes) {
      const testData = {
        casinoType,
        current: {
          mid: `test_${casinoType}_${Date.now()}`,
          status: 'live',
          data: { test: true }
        },
        results: [
          {
            mid: `result_${casinoType}_1`,
            win: 'A',
            timestamp: Date.now()
          }
        ]
      };

      const channel = `casino_odds_updates:${casinoType}`;
      const message = JSON.stringify(testData);

      console.log(`📤 Publishing to ${channel}:`);
      console.log(`📄 Message: ${message}`);

      await redisPublisher.publish(channel, message);
      console.log(`✅ Published to ${channel}\n`);

      // Wait a bit between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ Test completed! Check if messages were received above.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    await redisSubscriber.punsubscribe('casino_odds_updates:*');
    redisPublisher.disconnect();
    redisSubscriber.disconnect();
    console.log('🔌 Disconnected from Redis');
  }
}

// Run the test
testRedisPubSub().catch(console.error);
