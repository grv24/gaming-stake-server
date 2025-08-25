import axios from "axios";
import { getRedisClient } from "../../config/redisConfig";
import { getRedisPublisher } from "../../config/redisPubSub";
import { CronDataSource } from "../../corn.server";
import { CasinoMatch } from "../../entities/casino/CasinoMatch";
import { CasinoBet } from "../../entities/casino/CasinoBet";
import { USER_TABLES } from "../../Helpers/users/Roles";

export const fetchAndUpdateCasinoOdds = async (casinoType: string) => {
  try {
    const redisPublisher = getRedisPublisher();
    const redisClient = getRedisClient();
    const matchRepo = CronDataSource.getRepository(CasinoMatch);
    const casinoBetRepo = CronDataSource.getRepository(CasinoBet);

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
        results: apiData?.result?.res || apiData?.result,
      })
    );

    console.log(`[CRON] Updated & published odds for ${casinoType}`);

    return apiData;
  } catch (err: any) {
    console.error(`[CRON] Failed to fetch odds for ${casinoType}:`, err.message);
    return null;
  }
};

const updateCasinoBetsWithResult = async (mid: string, winner: string, casinoBetRepo: any) => {
  const queryRunner = CronDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Find all pending bets for this match ID
    const pendingBets = await queryRunner.manager.find(CasinoBet, {
      where: {
        matchId: mid,
        status: "pending"
      }
    });

    if (pendingBets.length === 0) {
      console.log(`No pending bets found for match ${mid}`);
      await queryRunner.release();
      return;
    }

    console.log(`Found ${pendingBets.length} pending bets for match ${mid}`);

    for (const bet of pendingBets) {
      try {
        const betData = bet.betData || {};
        const betSid = betData.sid ? String(betData.sid) : null;

        if (!betSid) {
          console.log(`Bet ${bet.id} has no SID, skipping`);
          continue;
        }

        console.log(`Processing bet ${bet.id}: user bet on ${betSid}, winner is ${winner}`);

        // Get the correct user repository
        const userEntity = USER_TABLES[bet.userType as any];
        if (!userEntity) {
          console.log(`Unknown user type: ${bet.userType} for bet ${bet.id}`);
          continue;
        }

        const userRepo = queryRunner.manager.getRepository(userEntity);

        // Find user with lock
        const user = await userRepo.findOne({
          where: { id: bet.userId },
          lock: { mode: "pessimistic_write" }
        });

        if (!user) {
          console.log(`User ${bet.userId} not found for bet ${bet.id}`);
          continue;
        }

        const stakeAmount = parseFloat(betData.stake) || 0;
        const potentialProfit = parseFloat(betData.profit) || 0;
        const potentialLoss = parseFloat(betData.loss) || 0;

        let newStatus: "won" | "lost" = "lost";
        let profitLoss = 0;

        if (winner === betSid) {
          newStatus = "won";
          profitLoss = potentialProfit;
          user.balance = (Number(user.balance) + profitLoss).toFixed(2);
          console.log(`Bet ${bet.id} WON: Adding ${profitLoss} to balance`);
        } else {
          newStatus = "lost";
          profitLoss = -potentialLoss; // Negative value for loss
          user.balance = (Number(user.balance) - potentialLoss).toFixed(2);
          console.log(`Bet ${bet.id} LOST: Subtracting ${potentialLoss} from balance`);
        }

        // Reduce exposure by stake amount
        user.exposure = (Number(user.exposure) - stakeAmount).toFixed(2);

        // Update user
        await userRepo.save(user);

        // Update bet
        const updatedBetData = {
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
        };

        await queryRunner.manager.update(
          CasinoBet,
          { id: bet.id },
          {
            status: newStatus,
            betData: updatedBetData
          }
        );

        console.log(`Updated bet ${bet.id}: ${newStatus} with profit/loss: ${profitLoss}`);

      } catch (betError) {
        console.error(`Error processing bet ${bet.id}:`, betError);
        // Continue with other bets even if one fails
      }
    }

    await queryRunner.commitTransaction();
    console.log(`Successfully updated ${pendingBets.length} bets for match ${mid}`);

  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error(`Error updating bets for match ${mid}:`, error);
    throw error; // Re-throw to handle in calling function
  } finally {
    await queryRunner.release();
  }
};