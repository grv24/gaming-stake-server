import Redis from "ioredis";

let redisClient: Redis | null = null;

export const connectRedis = async () => {
  try {
    if (!process.env.REDIS_URL) {
      throw new Error("REDIS_URL is not defined in environment variables");
    }

    redisClient = new Redis(process.env.REDIS_URL);

    redisClient.on("connect", () => {
      console.log("Connected to Redis");
    });

    redisClient.on("error", (err) => {
      console.error("Redis error:", err);
    });

    return redisClient;
  } catch (err) {
    console.error("Redis connection failed:", err);
    throw err;
  }
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error("Redis client not initialized. Call connectRedis() first.");
  }
  return redisClient;
};
