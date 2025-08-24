#!/bin/bash

echo "🎯 Casino Server - Service Manager"
echo "=================================="

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Check if API port is available
if check_port 4000; then
    echo "❌ Port 4000 is already in use. Please stop the existing service first."
    exit 1
fi

echo "🚀 Starting services..."

# Start both services using npm
npm run start:all

echo "✅ Services started successfully!"
echo "📊 API Server: http://localhost:4000"
echo "⏰ Cron Service: Running in background"
echo ""
echo "Press Ctrl+C to stop all services"
