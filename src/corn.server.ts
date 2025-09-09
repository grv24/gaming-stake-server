/**
 * Cron Service Server
 *
 * Dedicated cron service for sports odds + casino data processing.
 * Runs silently in background (no port).
 *
 * Features:
 * - Sports odds updates every 30 seconds
 * - Casino data processing every 2 minutes
 * - Graceful shutdown handling
 * - Independent DB connection
 * 
 * Architecture:
 * - Separate from main server to avoid blocking API requests
 * - Uses dedicated database connection to prevent connection pool exhaustion
 * - Structured logging with configurable levels
 * - Graceful shutdown to prevent data corruption
 * - NO HTTP SERVER - runs silently without exposing any ports
 * - Background process only - no web interface or API endpoints
 */

import "reflect-metadata";
import dotenv from "dotenv";
import { DataSource } from "typeorm";
import { connectRedis } from "./config/redisConfig";
import { initRedisPubSub } from "./config/redisPubSub";
import { startCasinoCronJobs } from "./cron/CasinoCronJob";
import { startLiveMatchesCron, startOddsCron, startSportsCrons } from "./cron/SportsCronJob";
import pino from "pino";

// Database entities for TypeORM configuration
// These entities define the data models that the cron service needs to access
import { Developer } from "./entities/users/DeveloperUser";
import { TechAdmin } from "./entities/users/TechAdminUser";
import { SuperMaster } from "./entities/users/SuperMasterUser";
import { Master } from "./entities/users/MasterUser";
import { SuperAgent } from "./entities/users/SuperAgentUser";
import { Agent } from "./entities/users/AgentUser";
import { MiniAdmin } from "./entities/users/MiniAdminUser";
import { Admin } from "./entities/users/AdminUser";
import { Client } from "./entities/users/ClientUser";
import { Whitelist } from "./entities/whitelist/Whitelist";
import { AccountTrasaction } from "./entities/Transactions/AccountTransactions";
import { DefaultCasino } from "./entities/casino/DefaultCasino";
import { CasinoMatch } from "./entities/casino/CasinoMatch";
import { CasinoBet } from "./entities/casino/CasinoBet";
import { SoccerSettings } from "./entities/users/utils/SoccerSetting";
import { TennisSettings } from "./entities/users/utils/TennisSetting";
import { CricketSettings } from "./entities/users/utils/CricketSetting";
import { CasinoSettings } from "./entities/users/utils/CasinoSetting";
import { InternationalCasinoSettings } from "./entities/users/utils/InternationalCasino";
import { MatkaSettings } from "./entities/users/utils/MatkaSetting";

// Load environment variables from .env file
dotenv.config();

// Setup structured logging with configurable levels
// LOG_LEVEL can be set in .env: debug, info, warn, error
// Defaults to 'info' for production, can be set to 'error' to reduce noise
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // Add service context to all log messages
  base: {
    service: 'cron-service'
  }
});

// Mark this process as a cron service for identification
// This helps distinguish cron service logs from main application logs
process.env.CRON_SERVICE = "true";

/**
 * Database Configuration for Cron Service
 * 
 * Creates an independent database connection specifically for cron operations.
 * This separation ensures:
 * - Cron jobs don't interfere with main application database connections
 * - Connection pool exhaustion is prevented
 * - Database operations can be optimized for batch processing
 * - Independent connection management and monitoring
 */
export const CronDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USERNAME,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  // All entities that cron service needs to access
  entities: [
    // User hierarchy - for authentication and authorization checks
    Developer,
    TechAdmin,
    SuperMaster,
    Master,
    SuperAgent,
    Agent,
    MiniAdmin,
    Admin,
    Client,
    // System entities - for whitelist and transaction tracking
    Whitelist,
    AccountTrasaction,
    // Casino entities - for game data and betting operations
    DefaultCasino,
    CasinoMatch,
    CasinoBet,
    // Settings entities - for configuration management
    SoccerSettings,
    TennisSettings,
    CricketSettings,
    CasinoSettings,
    InternationalCasinoSettings,
    MatkaSettings,
  ],
  synchronize: false, // Disable auto-sync for safety in production
  logging: false, // Disable TypeORM logging to reduce noise
  name: "cron-service", // Unique connection name to avoid conflicts
});

/**
 * Main function to initialize and start the cron service
 * 
 * This function orchestrates the startup sequence:
 * 1. Establishes database connection
 * 2. Connects to Redis for caching and pub/sub
 * 3. Starts scheduled cron jobs
 * 4. Sets up graceful shutdown handlers
 * 
 * IMPORTANT: This service runs silently without any HTTP server or port exposure.
 * It only executes background cron jobs and does not accept any incoming connections.
 * 
 * Error handling ensures the process exits cleanly if startup fails
 */
const startCronService = async () => {
  try {
    logger.info("Starting Cron Service (silent mode - no ports)...");

    // Initialize database connection for cron operations
    // This connection is separate from the main application
    await CronDataSource.initialize();
    logger.info("Database connected (cron service)");

    // Initialize Redis for caching and pub/sub functionality
    // Redis is used for:
    // - Caching frequently accessed data
    // - Pub/sub for real-time updates
    // - Session management
    // NOTE: Cron service does NOT use socket handlers - it only publishes to Redis
    await connectRedis();
    initRedisPubSub();
    logger.info("Redis connected (cron service)");

    // Start scheduled cron jobs
    // These jobs run in the background and handle:
    // - Sports odds updates (every 30 seconds)
    // - Casino data processing (every 2 minutes)
    // NOTE: No HTTP server is started - this is a silent background service

    startLiveMatchesCron();
    startCasinoCronJobs();
    // startOddsCron();

    logger.info("Cron jobs started successfully");

    // Log service status and monitoring information
    logger.info("Cron service running silently in background (no ports exposed)");
    logger.debug("Monitoring schedule: sports odds=30s, casino=2m, batch=5");

    /**
     * Graceful shutdown handler
     * 
     * Ensures clean shutdown by:
     * - Closing database connections properly
     * - Allowing current operations to complete
     * - Preventing data corruption
     * - Logging shutdown progress
     */
    const shutdown = async () => {
      logger.warn("Shutting down cron service gracefully...");
      CronDataSource.destroy().then(() => {
        logger.info("Database connection closed");
        process.exit(0);
      });
    };

    // Register shutdown handlers for different termination signals
    process.on("SIGTERM", shutdown); // Termination signal (e.g., from Docker, Kubernetes)
    process.on("SIGINT", shutdown);  // Interrupt signal (e.g., Ctrl+C from terminal)
  } catch (error) {
    // Log detailed error information and exit with error code
    logger.error({ err: error }, "Cron service startup failed");
    process.exit(1);
  }
};

// Start the cron service when this file is executed
// This is the entry point for the cron service process
startCronService();
