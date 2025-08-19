// casinoService.ts
import axios from "axios";
import { getRedisClient } from "../../config/redisConfig";
import { getRedisPublisher } from "../../config/redisPubSub";

export const fetchAndUpdateCasinoOdds = async (casinoType: string) => {
  try {
    const redisPublisher = getRedisPublisher();
    const redisClient = getRedisClient();
    const cacheKey = `casino:${casinoType}`;
    
    // Fetch from API
    const response = await axios.get(`http://localhost:8085/api/new/casino`, {
      params: { casinoType },
    });
    const apiData = response.data;

    // Save/update in Redis (10 min TTL)
    await redisClient.set(cacheKey, JSON.stringify(apiData), "EX", 600);

    // 🚨 Publish to Pub/Sub so subscribers know odds changed
    await redisPublisher.publish("casino_odds_updates", JSON.stringify({
      casinoType,
      data: apiData,
    }));

    console.log(`[CRON] Updated & published odds for ${casinoType}`);
    return apiData;
  } catch (err: any) {
    console.error(`[CRON] Failed to fetch odds for ${casinoType}:`, err.message);
    return null;
  }
};
