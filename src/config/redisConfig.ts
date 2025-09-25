import Redis from "ioredis";
import { config } from "./env";

// Redis client instance
let redisClient: Redis | null = null;

// Enhanced Redis connection options
const redisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  // Connection settings
  connectTimeout: config.redis.connectTimeout,
  commandTimeout: config.redis.commandTimeout,
  retryDelayOnFailover: config.redis.retryDelayOnFailover,
  maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
  lazyConnect: config.redis.lazyConnect,
  enableOfflineQueue: config.redis.enableOfflineQueue,
  // Enhanced retry settings
  retryDelayOnClusterDown: 300,
  // Connection pool settings
  family: 4, // IPv4
  keepAlive: true,
  // Reconnection settings
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    return err.message.includes(targetError);
  },
  // Health check settings
  enableReadyCheck: true,
  // Performance settings
  enableAutoPipelining: true,
  maxLoadingTimeout: 10000,
};

// Initialize Redis connection with enhanced error handling
export const connectRedis = async (): Promise<Redis> => {
  try {
    if (redisClient && redisClient.status === "ready") {
      return redisClient;
    }

    console.log("🔴 Connecting to Redis...");
    redisClient = new Redis({
      ...redisOptions,
      keepAlive: 30000, // Convert boolean to number (milliseconds)
    });

    // Enhanced event handlers
    redisClient.on("connect", () => {
      console.log("✅ Redis client connected");
    });

    redisClient.on("end", () => {
      console.log("🔚 Redis client connection ended");
    });

    // Wait for connection to be ready
    await redisClient.connect();
    
    // Test connection with ping
    const pong = await redisClient.ping();
    console.log(`🏓 Redis ping response: ${pong}`);
    
    return redisClient;
  } catch (error) {
    console.error("❌ Failed to connect to Redis:", error);
    
    // Enhanced error reporting
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);
      console.error(`   Error stack: ${error.stack}`);
    }
    
    throw error;
  }
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error("Redis client not initialized. Call connectRedis() first.");
  }
  return redisClient;
};

// Close Redis connection
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      console.log("🔌 Redis connection closed");
    } catch (error) {
      console.error("❌ Error closing Redis connection:", error);
      throw error;
    }
  }
};

// Redis health check
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    if (!redisClient || redisClient.status !== "ready") {
      return false;
    }
    await redisClient.ping();
    return true;
  } catch (error) {
    console.error("❌ Redis health check failed:", error);
    return false;
  }
};

// Redis utility functions
export const redisUtils = {
  // Set with expiration
  setex: async (key: string, seconds: number, value: string): Promise<void> => {
    const client = getRedisClient();
    await client.setex(key, seconds, value);
  },

  // Get value
  get: async (key: string): Promise<string | null> => {
    const client = getRedisClient();
    return await client.get(key);
  },

  // Delete key
  del: async (key: string): Promise<number> => {
    const client = getRedisClient();
    return await client.del(key);
  },

  // Check if key exists
  exists: async (key: string): Promise<boolean> => {
    const client = getRedisClient();
    const result = await client.exists(key);
    return result === 1;
  },

  // Set hash field
  hset: async (key: string, field: string, value: string): Promise<void> => {
    const client = getRedisClient();
    await client.hset(key, field, value);
  },

  // Get hash field
  hget: async (key: string, field: string): Promise<string | null> => {
    const client = getRedisClient();
    return await client.hget(key, field);
  },

  // Get all hash fields
  hgetall: async (key: string): Promise<Record<string, string>> => {
    const client = getRedisClient();
    return await client.hgetall(key);
  },

  // Delete hash field
  hdel: async (key: string, field: string): Promise<number> => {
    const client = getRedisClient();
    return await client.hdel(key, field);
  }
};
