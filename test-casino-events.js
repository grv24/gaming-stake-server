const io = require('socket.io-client');
const Redis = require('ioredis');

// Test the complete casino events flow
async function testCasinoEvents() {
  console.log('🧪 Testing Complete Casino Events Flow...\n');

  // Connect to Socket.IO
  const socket = io('http://localhost:4000', {
    transports: ['websocket', 'polling']
  });

  // Connect to Redis
  const redisPublisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  try {
    // Socket connection events
    socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server');
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from Socket.IO server');
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Socket connection error:', error.message);
    });

    // Listen for casino odds updates
    socket.on('casinoOddsUpdate', (data) => {
      console.log('🎰 [SOCKET] Received casinoOddsUpdate event:');
      console.log('📄 Data:', JSON.stringify(data, null, 2));
      console.log('---');
    });

    // Wait for socket to connect
    await new Promise(resolve => {
      if (socket.connected) {
        resolve();
      } else {
        socket.on('connect', resolve);
      }
    });

    console.log('📤 Publishing test casino events...\n');

    // Test casino types
    const casinoTypes = ['dt6', 'teen', 'poker'];

    for (const casinoType of casinoTypes) {
      const testData = {
        casinoType,
        current: {
          mid: `test_${casinoType}_${Date.now()}`,
          status: 'live',
          data: { 
            test: true,
            timestamp: Date.now()
          }
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

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('✅ Test completed! Check if events were received above.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    socket.disconnect();
    redisPublisher.disconnect();
    console.log('🔌 Disconnected from services');
  }
}

// Run the test
testCasinoEvents().catch(console.error);
