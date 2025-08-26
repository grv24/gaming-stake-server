import axios from "axios";
import { getRedisClient } from "../../config/redisConfig";
import { getRedisPublisher } from "../../config/redisPubSub";
import { CronDataSource } from "../../corn.server";
import { CasinoMatch } from "../../entities/casino/CasinoMatch";
import { CasinoBet } from "../../entities/casino/CasinoBet";
import { USER_TABLES } from "../../Helpers/users/Roles";
import { AppDataSource } from "../../server";
import { DIFF_STRUCT_CASINO_TYPES, ALTERNATIVE_API_CASINO_TYPES } from "../../Helpers/Request/Validation";

export const fetchAndUpdateCasinoOdds = async (casinoType: string) => {
  try {
    const redisPublisher = getRedisPublisher();
    const redisClient = getRedisClient();
    const matchRepo = CronDataSource.getRepository(CasinoMatch);
    const casinoBetRepo = CronDataSource.getRepository(CasinoBet);

    // Determine which API endpoint to use
    let apiUrl: string;
    let params: any;
    
    if (ALTERNATIVE_API_CASINO_TYPES.includes(casinoType)) {
      // Use alternative API endpoint
      apiUrl = `${process.env.THIRD_PARTY_URL}/exchange/casino/CasinoData`;
      params = { type: casinoType };
    } else {
      // Use default API endpoint
      apiUrl = `${process.env.THIRD_PARTY_URL}/api/new/casino`;
      params = { casinoType };
    }

    // Fetch from API with timeout and retry
    const response = await axios.get(apiUrl, {
      params,
      timeout: 10000, // 10 second timeout
    });
    const apiData = response.data;

    // Handle current match data - check for different structures
    let currentMid: string | null = null;
    let currentData: any = null;

    if (ALTERNATIVE_API_CASINO_TYPES.includes(casinoType)) {
      // Alternative API structure (like lucky5) - data is direct, not wrapped
      if (apiData?.mid) {
        currentMid = String(apiData.mid);
        currentData = apiData;
      }
    } else {
      // Default API structure - data is wrapped in data object
      if (apiData?.data?.mid || apiData?.data?.t1?.[0]?.mid || apiData?.data?.t2?.[0]?.mid) {
        currentMid = String(apiData.data.mid || apiData?.data?.t1?.[0]?.mid || apiData?.data?.t2?.[0]?.mid);
        currentData = apiData.data || apiData?.data?.t1?.[0] || apiData?.data?.t2?.[0];
      }
    }

    if (currentMid && currentData) {
      await matchRepo
        .upsert(
          {
            mid: currentMid,
            casinoType,
            winner: null,
            data: currentData,
          },
          ["mid"] // unique column for conflict
        );

      // Store current match separately in Redis
      await redisClient.set(
        `casino:${casinoType}:current`,
        JSON.stringify(currentData),
        "EX",
        600
      );
    } else {
      console.log(`[CRON] No live match for ${casinoType}`);
    }

    // Handle results - only for default API structure (alternative API doesn't include results)
    let results = [];
    
    if (!ALTERNATIVE_API_CASINO_TYPES.includes(casinoType)) {
      // Structure 1: apiData.result.res (original structure for teenmuf, etc.)
      if (apiData?.result?.res && Array.isArray(apiData.result.res)) {
        results = apiData.result.res;
      }
      // Structure 2: apiData.result (new structure for dt6, aaa, etc.)
      else if (apiData?.result && Array.isArray(apiData.result)) {
        results = apiData.result;
      }

      if (results.length > 0) {
        for (const r of results) {
          const resultMid = String(r.mid || r.matchId);
          // Handle both 'win' and 'result' fields, prefer 'win' if both exist
          // For dt202, only 'result' field exists, so use it as winner
          // For teenmuf, only 'win' field exists in result.res structure
          const winner = r.win || r.result || r.winner;

          if (!resultMid) {
            console.log(`[CRON] Skipping invalid result for ${casinoType}:`, r);
            continue;
          }

          // Update CasinoMatch with winner
          await matchRepo
            .upsert(
              {
                mid: resultMid,
                casinoType,
                winner: String(winner),
              },
              ["mid"] // if mid already exists, update winner
            );

          // Update CasinoBet records for this match
          await updateCasinoBetsWithResult(resultMid, String(winner), casinoBetRepo);
        }

        // Store results separately in Redis
        await redisClient.set(
          `casino:${casinoType}:results`,
          JSON.stringify(results),
          "EX",
          600
        );
      }
    }

    // Publish update notification (only send Redis keys, not complete data)
    await redisPublisher.publish(
      `casino_odds_updates:${casinoType}`, // Channel specific to casinoType
      JSON.stringify({
        casinoType,
        hasCurrent: !!currentData,
        hasResults: results.length > 0,
        timestamp: Date.now()
      })
    );

    console.log(`[CRON] Updated Redis & published notification for ${casinoType}`);

    return apiData;

  } catch (err: any) {
    // Handle specific network errors
    if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.message.includes('socket hang up')) {
      console.log(`[CRON] Network error for ${casinoType}, will retry on next cycle:`, err.message);
    } else {
      console.error(`[CRON] Failed to fetch odds for ${casinoType}:`, err.message);
    }
    return null;
  }
};

const updateCasinoBetsWithResult = async (mid: string, winner: string, casinoBetRepo: any) => {
  try {
    // Find all pending bets for this match ID
    const pendingBets = await casinoBetRepo.find({
      where: {
        matchId: mid,
        status: "pending"
      }
    });

    if (pendingBets.length === 0) {
      return; // No pending bets, exit silently
    }

    for (const bet of pendingBets) {
      const betData = bet.betData || {};
      const betSid: String = betData.sid;

      if (!betSid) {
        console.log(`[CRON] Bet ${bet.id} has no SID, skipping result update`);
        continue;
      }

      // Get user repository
      const userRepo = CronDataSource.getRepository(USER_TABLES[bet.userType]);

      // Use a simple transaction for each bet
      await CronDataSource.transaction(async (transactionalEntityManager) => {
        // Find user with lock
        const user: any = await transactionalEntityManager.findOne(USER_TABLES[bet.userType], {
          where: { id: bet.userId },
          lock: { mode: "pessimistic_write" }
        });

        if (!user) {
          console.log(`[CRON] User ${bet.userId} not found for bet ${bet.id}`);
          return;
        }

        const stakeAmount = Number(betData.stake) || 0;
        let newStatus: "won" | "lost" = "lost";
        let profitLoss = 0;

        if (winner === betSid) {
          newStatus = "won";
          profitLoss = Number(betData.profit) || 0;
          user.balance = Number(user.balance) + profitLoss;
        } else {
          newStatus = "lost";
          profitLoss = parseFloat(betData.loss) || 0;
          user.balance = Number(user.balance) - profitLoss;
        }

        user.exposure = Number(user.exposure) - stakeAmount;

        // Update user and bet
        await transactionalEntityManager.save(user);
        await transactionalEntityManager.update(CasinoBet, bet.id, {
          status: newStatus,
          betData: {
            ...betData,
            result: {
              winner: winner,
              settledAt: new Date(),
              profitLoss: profitLoss,
              stake: stakeAmount,
              betRate: betData.betRate || betData.matchOdd || 1,
              status: newStatus,
              settled: true
            }
          }
        });

        console.log(`[CRON] Updated bet ${bet.id}: ${newStatus} with profit/loss: ${profitLoss}`);
      });
    }

  } catch (error) {
    console.error(`[CRON] Error updating bets for match ${mid}:`, error);
  }
};