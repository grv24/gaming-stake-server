import dotenv from "dotenv";
import path from "path";

// Load .env file depending on NODE_ENV
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Environment validation with detailed error messages
const requiredEnvVars = [
  'POSTGRES_HOST',
  'POSTGRES_PORT', 
  'POSTGRES_USERNAME',
  'POSTGRES_PASSWORD',
  'POSTGRES_DATABASE',
  'REDIS_URL'
];

const optionalEnvVars = [
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'CORS_ORIGIN',
  'LOG_LEVEL',
  'ENABLE_CONSOLE_LOG',
  'ENABLE_FILE_LOG',
  'BCRYPT_ROUNDS',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX',
  'SOCKET_PING_TIMEOUT',
  'SOCKET_PING_INTERVAL',
  'SOCKET_MAX_CONNECTIONS',
  'CASINO_SETTLEMENT_INTERVAL',
  'CASINO_CHANGE_DETECTION_INTERVAL',
  'CASINO_FALLBACK_BROADCAST_INTERVAL',
  'SPORTS_SETTLEMENT_INTERVAL',
  'SPORTS_ODDS_UPDATE_INTERVAL',
  'ACTIVITY_TRACKING_ENABLED',
  'ACTIVITY_RETENTION_DAYS',
  'PERFORMANCE_METRICS_ENABLED',
  'PAYMENT_GATEWAY_TIMEOUT',
  'PAYMENT_GATEWAY_RETRY_ATTEMPTS',
  'COMMISSION_CALCULATION_INTERVAL',
  'COMMISSION_SETTLEMENT_INTERVAL',
  'MAX_FILE_SIZE',
  'ALLOWED_FILE_TYPES',
  'DEBUG_MODE',
  'ENABLE_DETAILED_LOGGING',
  'ENABLE_PERFORMANCE_MONITORING'
];

// Validate required environment variables
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error(`📁 Please check your ${envFile} file`);
  console.error(`💡 Make sure to create ${envFile} with the required variables`);
  process.exit(1);
}

// Log configuration loading
console.log(`🔧 Loading configuration from: ${envFile}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  isDevelopment: (process.env.NODE_ENV || "development") === "development",
  isProduction: process.env.NODE_ENV === "production",
  
  // Database configuration
  database: {
    host: process.env.POSTGRES_HOST!,
    port: Number(process.env.POSTGRES_PORT),
    username: process.env.POSTGRES_USERNAME!,
    password: process.env.POSTGRES_PASSWORD!,
    database: process.env.POSTGRES_DATABASE!,
    // Connection pool settings
    maxConnections: Number(process.env.DB_MAX_CONNECTIONS) || 20,
    minConnections: Number(process.env.DB_MIN_CONNECTIONS) || 5,
    acquireTimeout: Number(process.env.DB_ACQUIRE_TIMEOUT) || 30000,
    idleTimeout: Number(process.env.DB_IDLE_TIMEOUT) || 10000,
  },
  
  // Redis configuration
  redis: {
    url: process.env.REDIS_URL!,
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    // Connection settings
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
    commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT) || 5000,
    retryDelayOnFailover: Number(process.env.REDIS_RETRY_DELAY) || 100,
    maxRetriesPerRequest: Number(process.env.REDIS_MAX_RETRIES) || 3,
    lazyConnect: process.env.REDIS_LAZY_CONNECT !== 'false',
    enableOfflineQueue: process.env.REDIS_OFFLINE_QUEUE === 'true',
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  // Socket.IO configuration
  socket: {
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
    },
    pingTimeout: Number(process.env.SOCKET_PING_TIMEOUT) || 60000,
    pingInterval: Number(process.env.SOCKET_PING_INTERVAL) || 25000,
    maxConnections: Number(process.env.SOCKET_MAX_CONNECTIONS) || 1000,
    upgradeTimeout: Number(process.env.SOCKET_UPGRADE_TIMEOUT) || 10000,
    maxHttpBufferSize: Number(process.env.SOCKET_MAX_BUFFER_SIZE) || 1e8,
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.ENABLE_CONSOLE_LOG !== 'false',
    enableFile: process.env.ENABLE_FILE_LOG === 'true',
    enableDetailed: process.env.ENABLE_DETAILED_LOGGING === 'true',
    logDirectory: process.env.LOG_DIRECTORY || 'logs',
  },
  
  // Security configuration
  security: {
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
    rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 100,
    sessionSecret: process.env.SESSION_SECRET || 'session-secret-key',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',
  },
  
  // Casino configuration
  casino: {
    settlementInterval: Number(process.env.CASINO_SETTLEMENT_INTERVAL) || 60000,
    changeDetectionInterval: Number(process.env.CASINO_CHANGE_DETECTION_INTERVAL) || 10000,
    fallbackBroadcastInterval: Number(process.env.CASINO_FALLBACK_BROADCAST_INTERVAL) || 30000,
    autoSettlementEnabled: process.env.CASINO_AUTO_SETTLEMENT !== 'false',
    maxConcurrentSettlements: Number(process.env.CASINO_MAX_CONCURRENT_SETTLEMENTS) || 5,
  },
  
  // Sports configuration
  sports: {
    settlementInterval: Number(process.env.SPORTS_SETTLEMENT_INTERVAL) || 60000,
    oddsUpdateInterval: Number(process.env.SPORTS_ODDS_UPDATE_INTERVAL) || 5000,
    autoSettlementEnabled: process.env.SPORTS_AUTO_SETTLEMENT !== 'false',
    maxConcurrentSettlements: Number(process.env.SPORTS_MAX_CONCURRENT_SETTLEMENTS) || 3,
  },
  
  // Activity tracking configuration
  activity: {
    enabled: process.env.ACTIVITY_TRACKING_ENABLED !== 'false',
    retentionDays: Number(process.env.ACTIVITY_RETENTION_DAYS) || 30,
    performanceMetricsEnabled: process.env.PERFORMANCE_METRICS_ENABLED !== 'false',
    batchSize: Number(process.env.ACTIVITY_BATCH_SIZE) || 100,
    flushInterval: Number(process.env.ACTIVITY_FLUSH_INTERVAL) || 30000,
  },
  
  // Payment gateway configuration
  payment: {
    gatewayTimeout: Number(process.env.PAYMENT_GATEWAY_TIMEOUT) || 30000,
    retryAttempts: Number(process.env.PAYMENT_GATEWAY_RETRY_ATTEMPTS) || 3,
    retryDelay: Number(process.env.PAYMENT_GATEWAY_RETRY_DELAY) || 1000,
    webhookTimeout: Number(process.env.PAYMENT_WEBHOOK_TIMEOUT) || 10000,
  },
  
  // Commission configuration
  commission: {
    calculationInterval: Number(process.env.COMMISSION_CALCULATION_INTERVAL) || 300000, // 5 minutes
    settlementInterval: Number(process.env.COMMISSION_SETTLEMENT_INTERVAL) || 3600000, // 1 hour
    autoCalculationEnabled: process.env.COMMISSION_AUTO_CALCULATION !== 'false',
    batchSize: Number(process.env.COMMISSION_BATCH_SIZE) || 50,
  },
  
  // File upload configuration
  upload: {
    maxFileSize: Number(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES ? 
      process.env.ALLOWED_FILE_TYPES.split(',') : 
      ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    uploadDirectory: process.env.UPLOAD_DIRECTORY || 'uploads',
    tempDirectory: process.env.TEMP_DIRECTORY || 'temp',
  },
  
  // Debug and monitoring configuration
  debug: {
    enabled: process.env.DEBUG_MODE === 'true',
    enablePerformanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING !== 'false',
    enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',
    healthCheckInterval: Number(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    metricsInterval: Number(process.env.METRICS_INTERVAL) || 60000,
  },
  
  // External API configuration
  apis: {
    fancyApiUrl: process.env.FANCY_API_URL || '',
    fancyApiKey: process.env.FANCY_API_KEY || '',
    diamondApiUrl: process.env.DIAMOND_API_URL || '',
    diamondApiKey: process.env.DIAMOND_API_KEY || '',
    timeout: Number(process.env.API_TIMEOUT) || 30000,
    retryAttempts: Number(process.env.API_RETRY_ATTEMPTS) || 3,
  }
};

// Enhanced configuration validation
const validateConfiguration = () => {
  const errors: string[] = [];
  
  // Database validation
  if (config.database.port <= 0 || config.database.port > 65535) {
    errors.push('Invalid POSTGRES_PORT. Must be between 1 and 65535');
  }
  
  // Redis validation
  if (config.redis.port <= 0 || config.redis.port > 65535) {
    errors.push('Invalid REDIS_PORT. Must be between 1 and 65535');
  }
  
  // Security validation
  if (config.security.bcryptRounds < 10 || config.security.bcryptRounds > 15) {
    errors.push('BCRYPT_ROUNDS should be between 10 and 15 for optimal security');
  }
  
  if (config.jwt.secret === 'your-secret-key' && config.isProduction) {
    errors.push('JWT_SECRET must be changed from default value in production');
  }
  
  // File upload validation
  if (config.upload.maxFileSize > 50 * 1024 * 1024) { // 50MB
    errors.push('MAX_FILE_SIZE should not exceed 50MB');
  }
  
  // Interval validation
  if (config.casino.settlementInterval < 10000) {
    errors.push('CASINO_SETTLEMENT_INTERVAL should be at least 10 seconds');
  }
  
  if (config.sports.settlementInterval < 10000) {
    errors.push('SPORTS_SETTLEMENT_INTERVAL should be at least 10 seconds');
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach(error => console.error(`   - ${error}`));
    process.exit(1);
  }
};

// Run validation
validateConfiguration();

// Configuration summary
const logConfigurationSummary = () => {
  console.log('\n📋 Configuration Summary:');
  console.log(`   Environment: ${config.env}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Database: ${config.database.host}:${config.database.port}/${config.database.database}`);
  console.log(`   Redis: ${config.redis.host}:${config.redis.port}`);
  console.log(`   Logging Level: ${config.logging.level}`);
  console.log(`   Debug Mode: ${config.debug.enabled}`);
  console.log(`   Activity Tracking: ${config.activity.enabled}`);
  console.log(`   Performance Monitoring: ${config.debug.enablePerformanceMonitoring}`);
  console.log(`   Casino Auto Settlement: ${config.casino.autoSettlementEnabled}`);
  console.log(`   Sports Auto Settlement: ${config.sports.autoSettlementEnabled}`);
  console.log(`   Commission Auto Calculation: ${config.commission.autoCalculationEnabled}`);
  console.log('');
};

// Log configuration summary
logConfigurationSummary();
