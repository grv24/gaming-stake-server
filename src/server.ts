import "reflect-metadata";
import dotenv from "dotenv";
import http from "http";
import { setupSocket } from "./config/socketHandler";
import { connectRedis } from "./config/redisConfig";
import { AppDataSource } from "./config/database";
import app from "./app";
import { initRedisPubSub } from "./config/redisPubSub";

dotenv.config();

const startServer = async () => {
  try {
    console.log("Starting server initialization...");
    
    console.log("Initializing database connection...");
    await AppDataSource.initialize();
    console.log("Database connected");

    console.log("Connecting to Redis...");
    await connectRedis();
    console.log("Redis connected");
    
    console.log("Initializing Redis PubSub...");
    initRedisPubSub();
    console.log("Redis PubSub initialized");

    const PORT = process.env.PORT || 4000;
    
    // Set trust proxy BEFORE creating server
    app.set("trust proxy", true);
    
    const server = http.createServer(app);

    // Setup Socket.IO
    const io = setupSocket(server, AppDataSource);

    // Make io accessible in routes
    app.set("socketio", io);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log("Shutting down gracefully...");
      server.close(() => {
        console.log("HTTP server closed");
        AppDataSource.destroy().then(() => {
          console.log("Database connection closed");
          process.exit(0);
        });
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
export { AppDataSource };

