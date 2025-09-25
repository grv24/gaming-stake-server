#!/bin/bash

# VPS PM2 Setup Script for Game Stake Server
# This script creates a simple PM2 configuration for production deployment
# Usage: Run this script on your VPS to set up PM2 with proper configuration

echo "🚀 Setting up PM2 configuration for Game Stake Server"
echo "====================================================="

# Navigate to the application directory
echo "📁 Navigating to app directory..."
cd /root/gaming-stake-server

# Create PM2 ecosystem configuration file
echo "📝 Creating ecosystem.config.js..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      // Application name - matches your current "main" process
      name: 'main',
      
      // Entry point script (compiled JavaScript)
      script: 'dist/server.js',
      
      // Process management settings
      instances: 1,                    // Single instance for stability
      exec_mode: 'fork',               // Fork mode (not cluster)
      watch: false,                    // Disable file watching in production
      max_memory_restart: '1G',        // Restart if memory exceeds 1GB
      
      // Production environment variables
      env_production: {
        NODE_ENV: 'production',        // Set production environment
        PORT: 7080                     // Server port
      },
      
      // Logging configuration
      log_file: './logs/pm2/main.log',        // Combined log file
      out_file: './logs/pm2/main-out.log',    // Standard output log
      error_file: './logs/pm2/main-error.log', // Error log file
      merge_logs: true,                        // Merge all logs
      
      // Node.js optimization
      node_args: '--max-old-space-size=1024'  // Increase memory limit to 1GB
    }
  ]
};
EOF

echo "✅ ecosystem.config.js created successfully!"
echo ""
echo "📋 Configuration Summary:"
echo "  - Process Name: main"
echo "  - Script: dist/server.js"
echo "  - Environment: production"
echo "  - Port: 7080"
echo "  - Memory Limit: 1GB"
echo "  - Logs: ./logs/pm2/"
echo ""
echo "🎯 Next steps:"
echo "  1. Create log directory: mkdir -p logs/pm2"
echo "  2. Start PM2: pm2 start ecosystem.config.js --env production"
echo "  3. Save PM2 config: pm2 save"
echo "  4. Setup auto-startup: pm2 startup"
echo ""
echo "🎉 PM2 configuration setup complete!"
