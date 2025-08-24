const io = require('socket.io-client');

// Simple Socket.IO test for casino events
async function testSocketIO() {
  console.log('🧪 Testing Socket.IO Casino Events...\n');

  // Connect to Socket.IO
  const socket = io('http://localhost:4000', {
    transports: ['websocket', 'polling']
  });

  try {
    // Socket connection events
    socket.on('connect', () => {
      console.log('✅ Connected to Socket.IO server');
      console.log('📡 Socket ID:', socket.id);
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

    console.log('⏳ Waiting for casino events...');
    console.log('💡 Trigger events manually with:');
    console.log('   curl -X POST http://localhost:4000/api/v1/casinos/trigger-event \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"casinoType": "dt6"}\'');
    console.log('');

    // Keep the connection alive for 30 seconds
    setTimeout(() => {
      console.log('⏰ Test completed after 30 seconds');
      socket.disconnect();
      process.exit(0);
    }, 30000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    socket.disconnect();
    process.exit(1);
  }
}

// Run the test
testSocketIO().catch(console.error);
