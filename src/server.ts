import "reflect-metadata";
import http from "http";
import { config } from "./config/env";
import { AppDataSource, initializeDatabase, closeDatabase, checkDatabaseHealth } from "./config/database";
import { connectRedis, closeRedis, checkRedisHealth } from "./config/redisConfig";
import { initRedisPubSub, closeRedisPubSub } from "./config/redisPubSub";

// Import app and socket setup
import app from "./app";
import { setupSocket } from "./config/socketHandler";

// Server instance
let server: http.Server | null = null;

// Initialize all services
const initializeServices = async (): Promise<void> => {
  try {
    console.log("🚀 Starting server initialization...");
    console.log(`📋 Environment: ${config.env}`);
    console.log(`🔧 Port: ${config.port}`);
    
    // Initialize database
    console.log("📊 Initializing database connection...");
    await initializeDatabase(AppDataSource, "main database");
    
    // Connect to Redis
    console.log("🔴 Connecting to Redis...");
    await connectRedis();
    
    // Initialize Redis PubSub
    console.log("📡 Initializing Redis PubSub...");
    await initRedisPubSub();
    
    console.log("✅ All services initialized successfully");
  } catch (error) {
    console.error("❌ Service initialization failed:", error);
    throw error;
  }
};

// Create and configure HTTP server
const createServer = (): http.Server => {
  try {
    // Set trust proxy BEFORE creating server
    app.set("trust proxy", true);
    
    // Create HTTP server
    server = http.createServer(app);
    
    // Setup Socket.IO
    const io = setupSocket(server, AppDataSource);
    
    // Make io accessible in routes
    app.set("socketio", io);
    
    console.log("🌐 HTTP server created with Socket.IO");
    return server;
  } catch (error) {
    console.error("❌ Failed to create server:", error);
    throw error;
  }
};

// Start the server
const startServer = async (): Promise<void> => {
  try {
    // Initialize all services
    await initializeServices();
    
    // Create server
    const httpServer = createServer();
    
    // Start listening
    httpServer.listen(config.port, () => {
      console.log(`🎉 Server running on port ${config.port}`);
      console.log(`🌍 Environment: ${config.env}`);
      console.log(`📅 Started at: ${new Date().toISOString()}`);
      
      // Log server info
      console.log("\n📊 Server Information:");
      console.log(`   - Port: ${config.port}`);
      console.log(`   - Environment: ${config.env}`);
      console.log(`   - Database: ${config.database.host}:${config.database.port}/${config.database.database}`);
      console.log(`   - Redis: ${config.redis.host}:${config.redis.port}`);
      console.log(`   - Logging: ${config.logging.level}`);
    });
    
    // Setup graceful shutdown
    setupGracefulShutdown(httpServer);
    
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

// Setup graceful shutdown
const setupGracefulShutdown = (httpServer: http.Server): void => {
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    
    try {
      // Stop accepting new connections
      httpServer.close(async () => {
        console.log("🔌 HTTP server closed");
        
        try {
          // Close all services
          await Promise.all([
            closeDatabase(AppDataSource, "main database"),
            closeRedis(),
            closeRedisPubSub()
          ]);
          
          console.log("✅ Graceful shutdown completed");
          process.exit(0);
        } catch (error) {
          console.error("❌ Error during shutdown:", error);
          process.exit(1);
        }
      });
      
      // Force close after 30 seconds
      setTimeout(() => {
        console.error("⏰ Forced shutdown after timeout");
        process.exit(1);
      }, 30000);
      
    } catch (error) {
      console.error("❌ Shutdown error:", error);
      process.exit(1);
    }
  };
  
  // Handle shutdown signals
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  
  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("💥 Uncaught Exception:", error);
    shutdown("uncaughtException");
  });
  
  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
    shutdown("unhandledRejection");
  });
};

// Health check endpoint
export const healthCheck = async (): Promise<{
  status: string;
  timestamp: string;
  services: {
    database: boolean;
    redis: boolean;
  };
}> => {
  const [databaseHealth, redisHealthy] = await Promise.all([
    checkDatabaseHealth(AppDataSource),
    checkRedisHealth()
  ]);
  
  const databaseHealthy = databaseHealth.healthy;
  const allHealthy = databaseHealthy && redisHealthy;
  
  return {
    status: allHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    services: {
      database: databaseHealthy,
      redis: redisHealthy
    }
  };
};

// Export server instance and start function
export { AppDataSource };
export default startServer;

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

