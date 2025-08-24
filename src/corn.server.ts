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
 * - Independent DB connection with limited pool
 * 
 * Architecture:
 * - Separate from main server to avoid blocking API requests
 * - Uses dedicated database connection with small pool size
 * - Structured logging with configurable levels
 * - Graceful shutdown to prevent data corruption
 * - NO HTTP SERVER - runs silently without exposing any ports
 * - Background process only - no web interface or API endpoints
 */

import "reflect-metadata";
import dotenv from "dotenv";
import { DataSource } from "typeorm";
import { connectRedis, getRedisClient } from "./config/redisConfig";
import { initRedisPubSub } from "./config/redisPubSub";
import { startCasinoCronJobs } from "./cron/CasinoCronJob";
import { startSportCronJobs } from "./cron/SportsCronJob";
import pino from "pino";

// Entities
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

// Load env
dotenv.config();

// Logger
const logger = pino({ 
  level: process.env.LOG_LEVEL || "info",
  base: { service: "cron-service" }
});

process.env.CRON_SERVICE = "true";

/**
 * Database Configuration for Cron Service
 */
export const CronDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USERNAME,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  entities: [
    Developer,
    TechAdmin,
    SuperMaster,
    Master,
    SuperAgent,
    Agent,
    MiniAdmin,
    Admin,
    Client,
    Whitelist,
    AccountTrasaction,
    DefaultCasino,
    CasinoMatch,
    CasinoBet,
    SoccerSettings,
    TennisSettings,
    CricketSettings,
    CasinoSettings,
    InternationalCasinoSettings,
    MatkaSettings,
  ],
  synchronize: false,
  logging: false,
  name: "cron-service",
  // 🔑 Optimized pool size for connection stability
  extra: {
    max: 8,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
    maxUses: 1000, // Recycle connections after 1000 uses
  },
});

/**
 * Main function to start cron service
 */
const startCronService = async () => {
  try {
    logger.info("Starting Cron Service (silent mode - no ports)...");

    // Database with retry mechanism
    let retries = 3;
    while (retries > 0) {
      try {
        await CronDataSource.initialize();
        logger.info("Database connected (cron service)");
        break;
      } catch (error: any) {
        retries--;
        if (error.message?.includes("too many clients") && retries > 0) {
          logger.warn(`Database connection failed (${retries} retries left), waiting 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          throw error;
        }
      }
    }

    // Redis
    await connectRedis();
    initRedisPubSub();
    logger.info("Redis connected (cron service)");

    // Start jobs
    startCasinoCronJobs();
    startSportCronJobs();
    logger.info("Cron jobs started successfully");

    logger.info("Cron service running silently in background (no ports exposed)");
    logger.debug("Monitoring schedule: sports odds=30s, casino=2m, batch=5");

    /**
     * Graceful shutdown
     */
    const shutdown = async () => {
      logger.warn("Shutting down cron service gracefully...");
      try {
        if (CronDataSource.isInitialized) {
          await CronDataSource.destroy();
          logger.info("Database connection pool closed");
        }
        const redisClient = getRedisClient();
        if (redisClient.status === 'ready') {
          await redisClient.quit();
          logger.info("Redis connection closed");
        }
      } catch (err) {
        logger.error({ err }, "Error during shutdown");
      } finally {
        process.exit(0);
      }
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

  } catch (error) {
    logger.error({ err: error }, "Cron service startup failed");
    process.exit(1);
  }
};

// Entry
startCronService();
