import axios from "axios";
import { getRedisClient } from "../../config/redisConfig";
import { getRedisPublisher } from "../../config/redisPubSub";
import { AppDataSource } from "../../server";
import { CasinoMatch } from "../../entities/casino/CasinoMatch";

export const fetchAndUpdateCasinoOdds = async (casinoType: string) => {
  try {
    const redisPublisher = getRedisPublisher();
    const redisClient = getRedisClient();
    const cacheKey = `casino:${casinoType}`;
    const matchRepo = AppDataSource.getRepository(CasinoMatch);

    // Fetch from API
    const response = await axios.get(`http://localhost:8085/api/new/casino`, {
      params: { casinoType },
    });
    const apiData = response.data;


    // 1) Handle current match
    const currentMatch = {
      mid: String(apiData.data.mid),
      casinoType,
      winner: null, 
      data: apiData.data,
    };

    const exists = await matchRepo.findOne({ where: { mid: currentMatch.mid } });
    if (!exists) {
      await matchRepo.save(currentMatch);
      console.log(`Inserted new match ${currentMatch.mid}`);
    }

    // 2) Handle last 10 results
    if (apiData.result?.res) {
      for (const r of apiData.result.res) {
        const resultMatch = {
          mid: String(r.mid),
          casinoType,
          winner: r.win,
          data: r,
        };

        const existingResult = await matchRepo.findOne({
          where: { mid: resultMatch.mid },
        });

        if (!existingResult) {
          await matchRepo.save(resultMatch);
          console.log(`Stored past result ${resultMatch.mid} with winner ${r.win}`);
        }
      }
    }

    // 3) Update Redis + Pub/Sub
    await redisClient.set(cacheKey, JSON.stringify(apiData), "EX", 600);
    await redisPublisher.publish(
      "casino_odds_updates",
      JSON.stringify({ casinoType, data: apiData })
    );

    console.log(`[CRON] Updated & published odds for ${casinoType}`);
    return apiData;
  } catch (err: any) {
    console.error(`[CRON] Failed to fetch odds for ${casinoType}:`, err.message);
    return null;
  }
};
