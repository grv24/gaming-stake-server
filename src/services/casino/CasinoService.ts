import axios from "axios";
import { getRedisClient } from "../../config/redisConfig";
import { getRedisPublisher } from "../../config/redisPubSub";
import { AppDataSource } from "../../server";
import { CasinoMatch } from "../../entities/casino/CasinoMatch";
import { CasinoBet } from "../../entities/casino/CasinoBet";

export const fetchAndUpdateCasinoOdds = async (casinoType: string) => {
  try {
    const redisPublisher = getRedisPublisher();
    const redisClient = getRedisClient();
    const matchRepo = AppDataSource.getRepository(CasinoMatch);
    const casinoBetRepo = AppDataSource.getRepository(CasinoBet);

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
        .catch((err) =>
          console.error(`Failed to upsert match ${currentMid}:`, err)
        );

      // Store current match separately in Redis
      await redisClient.set(
        `casino:${casinoType}:current`,
        JSON.stringify(apiData.data),
        "EX",
        600
      );
    } else {
      console.log(`[CRON] No live match for ${casinoType}`);
    }

    // 2) Handle last 10 results and update CasinoBet records
    if (apiData?.result?.res) {
      for (const r of apiData.result.res) {
        const resultMid = String(r.mid);

        // Update CasinoMatch with winner
        await matchRepo
          .upsert(
            {
              mid: resultMid,
              casinoType,
              winner: r.win,
            },
            ["mid"] // if mid already exists, update winner
          )
          .then(() =>
            console.log(`Upserted past result ${resultMid} with winner ${r.win}`)
          )
          .catch((err) =>
            console.error(`Failed to upsert past result ${resultMid}:`, err)
          );

        // Update CasinoBet records for this match
        await updateCasinoBetsWithResult(resultMid, r.win, casinoBetRepo);
      }

      // Store results separately in Redis
      await redisClient.set(
        `casino:${casinoType}:results`,
        JSON.stringify(apiData.result.res),
        "EX",
        600
      );
    }

    // 3) Publish update (send both keys)
    await redisPublisher.publish(
      `casino_odds_updates:${casinoType}`, // Channel specific to casinoType
      JSON.stringify({
        casinoType,
        current: apiData?.data || null,
        results: apiData?.result?.res || [],
      })
    );

    console.log(`[CRON] Updated & published odds for ${casinoType}`);

    return apiData;
  } catch (err: any) {
    console.error(`[CRON] Failed to fetch odds for ${casinoType}:`, err.message);
    return null;
  }
};

// Helper function to update CasinoBet records with results
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
      console.log(`No pending bets found for match ${mid}`);
      return;
    }

    for (const bet of pendingBets) {
      try {
        const betData = bet.data || {};
        const betSid = betData.sid || betData.betData?.sid;
        
        if (!betSid) {
          console.log(`Bet ${bet.id} has no SID, skipping result update`);
          continue;
        }

        // Determine if the bet won or lost based on the winner
        let newStatus: "won" | "lost" = "lost";
        let profitLoss = 0;

        if (winner === betSid) {
          // Bet won - calculate winnings
          newStatus = "won";
          const betAmount = bet.amount || 0;
          const betRate = betData.betRate || betData.matchOdd || 1;
          profitLoss = betAmount * (betRate - 1); // Profit calculation
        } else {
          // Bet lost - amount is lost
          newStatus = "lost";
          profitLoss = - (bet.amount || 0); // Negative amount for loss
        }

        // Update the bet with result
        await casinoBetRepo.update(bet.id, {
          status: newStatus,
          profitLoss: profitLoss,
          // You might want to store additional result information
          data: {
            ...betData,
            result: {
              winner: winner,
              settledAt: new Date(),
              profitLoss: profitLoss
            }
          }
        });

        console.log(`Updated bet ${bet.id} for match ${mid}: ${newStatus} with profit/loss: ${profitLoss}`);

      } catch (betError) {
        console.error(`Error updating bet ${bet.id}:`, betError);
      }
    }

    console.log(`Updated ${pendingBets.length} bets for match ${mid}`);

  } catch (error) {
    console.error(`Error updating bets for match ${mid}:`, error);
  }
};