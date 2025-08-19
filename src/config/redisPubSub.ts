// redisPubSub.ts
import Redis from "ioredis";

let redisPublisher: Redis | null = null;
let redisSubscriber: Redis | null = null;

export const initRedisPubSub = () => {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not defined in environment variables");
  }

  redisPublisher = new Redis(process.env.REDIS_URL);
  redisSubscriber = new Redis(process.env.REDIS_URL);

  redisPublisher.on("connect", () => console.log("Publisher connected to Redis"));
  redisSubscriber.on("connect", () => console.log("Subscriber connected to Redis"));

  redisPublisher.on("error", (err) => console.error("Publisher Redis error:", err));
  redisSubscriber.on("error", (err) => console.error("Subscriber Redis error:", err));
};

export const getRedisPublisher = (): Redis => {
  if (!redisPublisher) throw new Error("Redis publisher not initialized. Call initRedisPubSub first.");
  return redisPublisher;
};

export const getRedisSubscriber = (): Redis => {
  if (!redisSubscriber) throw new Error("Redis subscriber not initialized. Call initRedisPubSub first.");
  return redisSubscriber;
};
