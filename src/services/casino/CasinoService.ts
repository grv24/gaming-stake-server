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
      timeout: 10000 // Add timeout to prevent hanging
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

    // 2) Handle results - handle both cases: results.res OR results array
    let resultsArray: any[] = [];
    
    if (apiData?.result?.res) {
      // Case 1: results are in result.res
      resultsArray = apiData.result.res;
      console.log(`Found ${resultsArray.length} results in result.res for ${casinoType}`);
    } else if (Array.isArray(apiData?.result)) {
      // Case 2: results are directly in result array
      resultsArray = apiData.result;
      console.log(`Found ${resultsArray.length} results in result array for ${casinoType}`);
    } else if (Array.isArray(apiData?.results)) {
      // Case 3: results are in results array (some APIs use this)
      resultsArray = apiData.results;
      console.log(`Found ${resultsArray.length} results in results array for ${casinoType}`);
    } else if (apiData?.results?.res) {
      // Case 4: results are in results.res
      resultsArray = apiData.results.res;
      console.log(`Found ${resultsArray.length} results in results.res for ${casinoType}`);
    }

    // Process results if we found any
    if (resultsArray.length > 0) {
      for (const r of resultsArray) {
        const resultMid = String(r.mid);
        const winner = String(r.win || r.winner); // Handle both win and winner fields

        // Update CasinoMatch with winner
        await matchRepo
          .upsert(
            {
              mid: resultMid,
              casinoType,
              winner: winner,
            },
            ["mid"] // if mid already exists, update winner
          )
          .then(() =>
            console.log(`Upserted past result ${resultMid} with winner ${winner}`)
          )
          .catch((err) =>
            console.error(`Failed to upsert past result ${resultMid}:`, err)
          );

        // Update CasinoBet records for this match
        await updateCasinoBetsWithResult(resultMid, winner, casinoBetRepo);
      }

      // Store results separately in Redis
      await redisClient.set(
        `casino:${casinoType}:results`,
        JSON.stringify(resultsArray),
        "EX",
        600
      );
    } else {
      console.log(`[CRON] No results found for ${casinoType}`);
    }

    // 3) Publish update (send both keys)
    await redisPublisher.publish(
      `casino_odds_updates:${casinoType}`, // Channel specific to casinoType
      JSON.stringify({
        casinoType,
        current: apiData?.data || null,
        results: resultsArray, // Use the processed results array
        timestamp: Date.now() // Add timestamp for tracking
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
        const userEntity = USER_TABLES[bet.userType as keyof typeof USER_TABLES];
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
        user.exposure = Math.max(0, (Number(user.exposure) - stakeAmount)).toFixed(2);

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
            betData: updatedBetData,
            // settledAt: new Date()
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

// Helper function to debug API response structure
export const debugCasinoApiResponse = async (casinoType: string) => {
  try {
    const response = await axios.get(`http://localhost:8085/api/new/casino`, {
      params: { casinoType },
      timeout: 10000
    });
    
    console.log(`=== DEBUG API Response for ${casinoType} ===`);
    console.log('Full response:', JSON.stringify(response.data, null, 2));
    console.log('Has data:', !!response.data?.data);
    console.log('Has result:', !!response.data?.result);
    console.log('Has results:', !!response.data?.results);
    console.log('Result type:', typeof response.data?.result);
    console.log('Results type:', typeof response.data?.results);
    
    if (response.data?.result) {
      console.log('Result is array:', Array.isArray(response.data.result));
      if (response.data.result.res) {
        console.log('Result.res is array:', Array.isArray(response.data.result.res));
      }
    }
    
    if (response.data?.results) {
      console.log('Results is array:', Array.isArray(response.data.results));
      if (response.data.results.res) {
        console.log('Results.res is array:', Array.isArray(response.data.results.res));
      }
    }
    
    console.log('==========================================');
    
    return response.data;
  } catch (error) {
    console.error(`Debug failed for ${casinoType}:`, error);
    return null;
  }
};

// import axios from "axios";
// import { getRedisClient } from "../../config/redisConfig";
// import { getRedisPublisher } from "../../config/redisPubSub";
// import { CronDataSource } from "../../corn.server";
// import { CasinoMatch } from "../../entities/casino/CasinoMatch";
// import { CasinoBet } from "../../entities/casino/CasinoBet";
// import { USER_TABLES } from "../../Helpers/users/Roles";

// export const fetchAndUpdateCasinoOdds = async (casinoType: string) => {
//   try {
//     const redisPublisher = getRedisPublisher();
//     const redisClient = getRedisClient();
//     const matchRepo = CronDataSource.getRepository(CasinoMatch);
//     const casinoBetRepo = CronDataSource.getRepository(CasinoBet);

//     // Fetch from API
//     const response = await axios.get(`http://localhost:8085/api/new/casino`, {
//       params: { casinoType },
//     });
//     const apiData = response.data;

//     // 1) Handle current match (only if exists)
//     if (apiData?.data?.mid) {
//       const currentMid = String(apiData.data.mid);

//       await matchRepo
//         .upsert(
//           {
//             mid: currentMid,
//             casinoType,
//             winner: null,
//             data: apiData.data,
//           },
//           ["mid"] // unique column for conflict
//         )
//         .then(() => console.log(`Upserted current match ${currentMid}`))
//         .catch((err) =>
//           console.error(`Failed to upsert match ${currentMid}:`, err)
//         );

//       // Store current match separately in Redis
//       await redisClient.set(
//         `casino:${casinoType}:current`,
//         JSON.stringify(apiData.data),
//         "EX",
//         600
//       );
//     } else {
//       console.log(`[CRON] No live match for ${casinoType}`);
//     }

//     // 2) Handle last 10 results and update CasinoBet records
//     if (apiData?.result?.res) {
//       for (const r of apiData.result.res) {
//         const resultMid = String(r.mid);

//         // Update CasinoMatch with winner
//         await matchRepo
//           .upsert(
//             {
//               mid: resultMid,
//               casinoType,
//               winner: r.win,
//             },
//             ["mid"] // if mid already exists, update winner
//           )
//           .then(() =>
//             console.log(`Upserted past result ${resultMid} with winner ${r.win}`)
//           )
//           .catch((err) =>
//             console.error(`Failed to upsert past result ${resultMid}:`, err)
//           );

//         // Update CasinoBet records for this match
//         await updateCasinoBetsWithResult(resultMid, r.win, casinoBetRepo);
//       }

//       // Store results separately in Redis
//       await redisClient.set(
//         `casino:${casinoType}:results`,
//         JSON.stringify(apiData.result.res),
//         "EX",
//         600
//       );
//     }

//     // 3) Publish update (send both keys)
//     await redisPublisher.publish(
//       `casino_odds_updates:${casinoType}`, // Channel specific to casinoType
//       JSON.stringify({
//         casinoType,
//         current: apiData?.data || null,
//         results: apiData?.result?.res || apiData?.result,
//       })
//     );

//     console.log(`[CRON] Updated & published odds for ${casinoType}`);

//     return apiData;
//   } catch (err: any) {
//     console.error(`[CRON] Failed to fetch odds for ${casinoType}:`, err.message);
//     return null;
//   }
// };

// const updateCasinoBetsWithResult = async (mid: string, winner: string, casinoBetRepo: any) => {
//   const queryRunner = CronDataSource.createQueryRunner();

//   try {
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     // Find all pending bets for this match ID
//     const pendingBets = await queryRunner.manager.find(CasinoBet, {
//       where: {
//         matchId: mid,
//         status: "pending"
//       }
//     });

//     if (pendingBets.length === 0) {
//       console.log(`No pending bets found for match ${mid}`);
//       await queryRunner.release();
//       return;
//     }

//     console.log(`Found ${pendingBets.length} pending bets for match ${mid}`);

//     for (const bet of pendingBets) {
//       try {
//         const betData = bet.betData || {};
//         const betSid = betData.sid ? String(betData.sid) : null;

//         if (!betSid) {
//           console.log(`Bet ${bet.id} has no SID, skipping`);
//           continue;
//         }

//         console.log(`Processing bet ${bet.id}: user bet on ${betSid}, winner is ${winner}`);

//         // Get the correct user repository
//         const userEntity = USER_TABLES[bet.userType as any];
//         if (!userEntity) {
//           console.log(`Unknown user type: ${bet.userType} for bet ${bet.id}`);
//           continue;
//         }

//         const userRepo = queryRunner.manager.getRepository(userEntity);

//         // Find user with lock
//         const user = await userRepo.findOne({
//           where: { id: bet.userId },
//           lock: { mode: "pessimistic_write" }
//         });

//         if (!user) {
//           console.log(`User ${bet.userId} not found for bet ${bet.id}`);
//           continue;
//         }

//         const stakeAmount = parseFloat(betData.stake) || 0;
//         const potentialProfit = parseFloat(betData.profit) || 0;
//         const potentialLoss = parseFloat(betData.loss) || 0;

//         let newStatus: "won" | "lost" = "lost";
//         let profitLoss = 0;

//         if (winner === betSid) {
//           newStatus = "won";
//           profitLoss = potentialProfit;
//           user.balance = (Number(user.balance) + profitLoss).toFixed(2);
//           console.log(`Bet ${bet.id} WON: Adding ${profitLoss} to balance`);
//         } else {
//           newStatus = "lost";
//           profitLoss = -potentialLoss; // Negative value for loss
//           user.balance = (Number(user.balance) - potentialLoss).toFixed(2);
//           console.log(`Bet ${bet.id} LOST: Subtracting ${potentialLoss} from balance`);
//         }

//         // Reduce exposure by stake amount
//         user.exposure = (Number(user.exposure) - stakeAmount).toFixed(2);

//         // Update user
//         await userRepo.save(user);

//         // Update bet
//         const updatedBetData = {
//           ...betData,
//           result: {
//             winner: winner,
//             settledAt: new Date(),
//             profitLoss: profitLoss,
//             stake: stakeAmount,
//             betRate: betData.betRate || betData.matchOdd || 1,
//             status: newStatus,
//             settled: true
//           }
//         };

//         await queryRunner.manager.update(
//           CasinoBet,
//           { id: bet.id },
//           {
//             status: newStatus,
//             betData: updatedBetData
//           }
//         );

//         console.log(`Updated bet ${bet.id}: ${newStatus} with profit/loss: ${profitLoss}`);

//       } catch (betError) {
//         console.error(`Error processing bet ${bet.id}:`, betError);
//         // Continue with other bets even if one fails
//       }
//     }

//     await queryRunner.commitTransaction();
//     console.log(`Successfully updated ${pendingBets.length} bets for match ${mid}`);

//   } catch (error) {
//     await queryRunner.rollbackTransaction();
//     console.error(`Error updating bets for match ${mid}:`, error);
//     throw error; // Re-throw to handle in calling function
//   } finally {
//     await queryRunner.release();
//   }
// };