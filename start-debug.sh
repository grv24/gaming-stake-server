#!/bin/bash

echo "🎰 Starting Casino Debug System..."

# Check if debug server is already running
if curl -s http://localhost:4001/health > /dev/null 2>&1; then
    echo "✅ Debug server is already running on port 4001"
else
    echo "🚀 Starting debug server..."
    npm run debug:server &
    sleep 3
fi

# Check if server is now running
if curl -s http://localhost:4001/health > /dev/null 2>&1; then
    echo "✅ Debug server is running successfully"
    echo "🌐 Opening debug UI in browser..."
    npm run debug:ui
else
    echo "❌ Failed to start debug server"
    echo "💡 Make sure Redis is running or the server will work without Redis"
    exit 1
fi

echo ""
echo "🎯 Debug System Ready!"
echo "📊 UI: http://localhost:4001/debug"
echo "🔌 Socket.IO: http://localhost:4001"
echo "📡 API: http://localhost:4001/api/casino-debug"
echo ""
echo "💡 To stop the debug server, press Ctrl+C in the terminal where it's running"
