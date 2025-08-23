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

    // 1) Handle current match (only if exists)
    if (apiData?.data?.mid) {
      const currentMid = String(apiData.data.mid);

      await matchRepo
        .upsert(
          {
            mid: currentMid,
            casinoType,
            winner: null, 
            data: apiData.data,
          },
          ["mid"] // unique column for conflict
        )
        .then(() => console.log(`Upserted current match ${currentMid}`))
        .catch((err) => console.error(`Failed to upsert match ${currentMid}:`, err));
    } else {
      console.log(`[CRON] No live match for ${casinoType}`);
    }

    // 2) Handle last 10 results
    if (apiData?.result?.res) {
      for (const r of apiData.result.res) {
        const resultMid = String(r.mid);

        await matchRepo
          .upsert(
            {
              mid: resultMid,
              casinoType,
              winner: r.win,
              // data: r,
            },
            ["mid"] // if mid already exists, update winner
          )
          .then(() =>
            console.log(`Upserted past result ${resultMid} with winner ${r.win}`)
          )
          .catch((err) =>
            console.error(`Failed to upsert past result ${resultMid}:`, err)
          );
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
