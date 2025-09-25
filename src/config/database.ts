import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "./env";

// Import all entities
import { Developer } from "../entities/users/DeveloperUser";
import { Whitelist } from "../entities/whitelist/Whitelist";
import { TechAdmin } from "../entities/users/TechAdminUser";
import { SoccerSettings } from "../entities/users/utils/SoccerSetting";
import { TennisSettings } from "../entities/users/utils/TennisSetting";
import { CricketSettings } from "../entities/users/utils/CricketSetting";
import { CasinoSettings } from "../entities/users/utils/CasinoSetting";
import { InternationalCasinoSettings } from "../entities/users/utils/InternationalCasino";
import { MatkaSettings } from "../entities/users/utils/MatkaSetting";
import { SuperMaster } from "../entities/users/SuperMasterUser";
import { Master } from "../entities/users/MasterUser";
import { SuperAgent } from "../entities/users/SuperAgentUser";
import { Agent } from "../entities/users/AgentUser";
import { MiniAdmin } from "../entities/users/MiniAdminUser";
import { Admin } from "../entities/users/AdminUser";
import { Client } from "../entities/users/ClientUser";
import { AccountTrasaction } from "../entities/Transactions/AccountTransactions";
import { DefaultCasino } from "../entities/casino/DefaultCasino";
import { CasinoBet } from "../entities/casino/CasinoBet";
import { Buttons } from "../entities/games/Buttons";
import { SportBet } from "../entities/sports/SportBet";
import { CasinoMatchNew } from "../entities/casino/CasinoMatchNew";
import { WhitelistCasinoMapping } from "../entities/whitelist/WhitelistCasinoMapping";
import { UserActivity, BetActivity, SessionActivity, PerformanceMetric } from "../entities/activity/ActivityEntities";
import { SportMatch } from "../entities/sports/SportMatch";
import { CommissionTransaction } from "../entities/CommissionTransaction";
import { PaymentGateway } from "../entities/payment/PaymentGateway";
import { DepositRequest } from "../entities/payment/DepositRequest";
import { FileUpload } from "../entities/payment/FileUpload";
import { GatewayAssignment } from "../entities/payment/GatewayAssignment";

// All entities array - centralized definition
export const ALL_ENTITIES = [
  // User hierarchy
  Developer,
  TechAdmin,
  SuperMaster,
  Master,
  SuperAgent,
  Agent,
  MiniAdmin,
  Admin,
  Client,
  // System entities
  Whitelist,
  AccountTrasaction,
  // Casino entities
  DefaultCasino,
  CasinoBet,
  CasinoMatchNew,
  // Settings entities
  SoccerSettings,
  TennisSettings,
  CricketSettings,
  CasinoSettings,
  InternationalCasinoSettings,
  MatkaSettings,
  // Game entities
  Buttons,
  SportBet,
  SportMatch,
  // Whitelist mapping
  WhitelistCasinoMapping,
  // Activity entities
  UserActivity,
  BetActivity,
  SessionActivity,
  PerformanceMetric,
  // Commission
  CommissionTransaction,
  // Payment gateway
  PaymentGateway,
  DepositRequest,
  FileUpload,
  GatewayAssignment
];

// Main application database configuration
export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  entities: ALL_ENTITIES,
  synchronize: false, // Disable auto-sync for production safety
  logging: config.logging.enableDetailed && config.isDevelopment,
  connectTimeoutMS: config.database.acquireTimeout,
  // Enhanced connection pool settings
  extra: {
    // Connection pool settings
    max: config.database.maxConnections, // Maximum number of connections in the pool
    min: config.database.minConnections,  // Minimum number of connections in the pool
    acquire: config.database.acquireTimeout, // Maximum time to wait for a connection
    idle: config.database.idleTimeout, // Maximum time a connection can be idle
    // Additional PostgreSQL-specific settings
    statement_timeout: 30000, // 30 seconds
    query_timeout: 30000, // 30 seconds
    connectionTimeoutMillis: 10000, // 10 seconds
    idle_in_transaction_session_timeout: 300000, // 5 minutes
    // SSL settings - disable SSL since server doesn't support it
    ssl: false,
    // Connection validation
    validateConnection: true,
    // Retry settings
    retryAttempts: 3,
    retryDelay: 1000,
  },
  // Migration settings
  migrations: config.isDevelopment ? ['src/migrations/*.ts'] : ['dist/migrations/*.js'],
  migrationsRun: false,
  // Disable Redis cache for now to avoid connection issues
  // cache: {
  //   type: 'redis',
  //   options: {
  //     host: config.redis.host,
  //     port: config.redis.port,
  //     password: config.redis.password,
  //   },
  //   duration: 300000, // 5 minutes
  //   ignoreErrors: true,
  // },
});

// Cron service database configuration (subset of entities)
export const CronDataSource = new DataSource({
  type: "postgres",
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
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
    CasinoBet,
    // Settings entities - for configuration management
    SoccerSettings,
    TennisSettings,
    CricketSettings,
    CasinoSettings,
    InternationalCasinoSettings,
    MatkaSettings,
    CasinoMatchNew,
    WhitelistCasinoMapping,
    // Sport entities
    SportMatch
  ],
  synchronize: false, // Disable auto-sync for safety in production
  logging: false, // Disable TypeORM logging to reduce noise
  name: "cron-service", // Unique connection name to avoid conflicts
  connectTimeoutMS: config.database.acquireTimeout,
  extra: {
    max: Math.floor(config.database.maxConnections * 0.3), // Use 30% of main pool
    min: Math.floor(config.database.minConnections * 0.2), // Use 20% of main pool
    acquire: config.database.acquireTimeout,
    idle: config.database.idleTimeout,
    statement_timeout: 60000, // Longer timeout for cron jobs
    query_timeout: 60000,
    connectionTimeoutMillis: 15000,
    ssl: false,
    validateConnection: true,
    retryAttempts: 5, // More retries for cron jobs
    retryDelay: 2000,
  },
});

// Debug/utility database configuration (minimal entities)
export const DebugDataSource = new DataSource({
  type: "postgres",
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  entities: [
    TechAdmin,
    Admin,
    Client,
    AccountTrasaction
  ],
  synchronize: false,
  logging: false,
  name: "debug-service",
  connectTimeoutMS: config.database.acquireTimeout,
  extra: {
    max: 5, // Minimal connections for debug
    min: 1,
    acquire: config.database.acquireTimeout,
    idle: config.database.idleTimeout,
    statement_timeout: 15000, // Shorter timeout for debug
    query_timeout: 15000,
    connectionTimeoutMillis: 5000,
    ssl: false,
    validateConnection: true,
    retryAttempts: 2,
  },
});

// Enhanced database connection helper functions
export const initializeDatabase = async (dataSource: DataSource, name: string = "database") => {
  try {
    if (!dataSource.isInitialized) {
      console.log(`🔌 Initializing ${name} connection...`);
      
      // Type-safe access to connection options
      const options = dataSource.options as any;
      if (options.host && options.port) {
        console.log(`   Host: ${options.host}:${options.port}`);
      }
      if (options.database) {
        console.log(`   Database: ${options.database}`);
      }
      if (options.username) {
        console.log(`   Username: ${options.username}`);
      }
      
      const startTime = Date.now();
      
      // Add timeout wrapper
      const initPromise = dataSource.initialize();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database initialization timeout after 30 seconds')), 30000);
      });
      
      await Promise.race([initPromise, timeoutPromise]);
      
      const connectionTime = Date.now() - startTime;
      console.log(`✅ ${name} connected successfully (${connectionTime}ms)`);
      
      // Log connection pool info
      if (dataSource.options.extra) {
        console.log(`📊 ${name} pool settings: max=${dataSource.options.extra.max}, min=${dataSource.options.extra.min}`);
      }
      
      // Set up connection monitoring (only in development)
      if (config.debug.enablePerformanceMonitoring && config.isDevelopment) {
        setInterval(async () => {
          try {
            const pool = (dataSource.driver as any).master;
            if (pool && pool._allConnections) {
              const activeConnections = pool._allConnections.length;
              const idleConnections = pool._freeConnections.length;
              console.log(`📈 ${name} pool status: active=${activeConnections}, idle=${idleConnections}`);
            }
          } catch (error) {
            // Silently ignore monitoring errors
          }
        }, config.debug.metricsInterval);
      }
    }
    return dataSource;
  } catch (error) {
    console.error(`❌ Failed to initialize ${name}:`, error);
    
    // Enhanced error reporting
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);
      console.error(`   Error stack: ${error.stack}`);
      
      // Specific error handling
      if (error.message.includes('timeout')) {
        console.error(`   💡 Connection timeout - check network connectivity and database server status`);
      } else if (error.message.includes('ECONNREFUSED')) {
        console.error(`   💡 Connection refused - check if database server is running`);
      } else if (error.message.includes('authentication')) {
        console.error(`   💡 Authentication failed - check username/password`);
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        console.error(`   💡 Database does not exist - check database name`);
      }
    }
    
    // Retry logic for connection failures (only in production)
    if (name === "main database" && config.isProduction) {
      console.log(`🔄 Retrying ${name} connection in 5 seconds...`);
      setTimeout(() => {
        initializeDatabase(dataSource, name);
      }, 5000);
    }
    
    throw error;
  }
};

export const closeDatabase = async (dataSource: DataSource, name: string = "database") => {
  try {
    if (dataSource.isInitialized) {
      console.log(`🔌 Closing ${name} connection...`);
      const startTime = Date.now();
      
      await dataSource.destroy();
      
      const closeTime = Date.now() - startTime;
      console.log(`✅ ${name} connection closed (${closeTime}ms)`);
    }
  } catch (error) {
    console.error(`❌ Error closing ${name}:`, error);
    throw error;
  }
};

// Enhanced health check function with detailed metrics
export const checkDatabaseHealth = async (dataSource: DataSource): Promise<{
  healthy: boolean;
  responseTime: number;
  poolStatus?: any;
  error?: string;
}> => {
  const startTime = Date.now();
  
  try {
    if (!dataSource.isInitialized) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: 'Database not initialized'
      };
    }
    
    // Test basic connectivity
    await dataSource.query("SELECT 1");
    
    const responseTime = Date.now() - startTime;
    
    // Get pool status if available
    let poolStatus = null;
    try {
      const pool = (dataSource.driver as any).master;
      if (pool && pool._allConnections) {
        poolStatus = {
          totalConnections: pool._allConnections.length,
          freeConnections: pool._freeConnections.length,
          activeConnections: pool._allConnections.length - pool._freeConnections.length
        };
      }
    } catch (poolError) {
      // Pool status is optional
    }
    
    return {
      healthy: true,
      responseTime,
      poolStatus
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error("Database health check failed:", error);
    
    return {
      healthy: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Database performance monitoring
export const getDatabaseMetrics = async (dataSource: DataSource) => {
  try {
    if (!dataSource.isInitialized) {
      return null;
    }
    
    const pool = (dataSource.driver as any).master;
    if (!pool) {
      return null;
    }
    
    return {
      totalConnections: pool._allConnections?.length || 0,
      freeConnections: pool._freeConnections?.length || 0,
      activeConnections: (pool._allConnections?.length || 0) - (pool._freeConnections?.length || 0),
      waitingClients: pool._waitingClients?.length || 0,
      maxConnections: pool.options?.max || 'unknown',
      minConnections: pool.options?.min || 'unknown'
    };
  } catch (error) {
    console.error("Error getting database metrics:", error);
    return null;
  }
};
