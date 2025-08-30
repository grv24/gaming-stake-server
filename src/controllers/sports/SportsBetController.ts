import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { USER_TABLES } from "../../Helpers/users/Roles";
import { SportBet } from "../../entities/sports/SportBet";
import { CronDataSource } from "../../corn.server";

export const createBet = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const userId = req.user.userId;
    const { betData, exposure, commission, partnership } = req.body;

    // Validate required fields
    if (!userId || !betData || !betData?.stake || !betData?.eventId || !betData?.oddType || !betData?.sid) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        status: false,
        message: "Missing required fields: userId, betData with stake, eventId, sid and oddType are required"
      });
    }

    const userRepo = queryRunner.manager.getRepository(USER_TABLES[req.__type!]);
    const sportsBetRepository = queryRunner.manager.getRepository(SportBet);

    // Get user with lock to prevent race conditions
    const user = await userRepo.findOne({
      where: { id: userId },
      lock: { mode: "pessimistic_write" }
    });

    if (!user) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        status: false,
        message: "User not found"
      });
    }

    // Check if user is allowed to bet
    if (user.userLocked || user.bettingLocked) {
      await queryRunner.rollbackTransaction();
      return res.status(403).json({
        status: false,
        message: "User account is locked from betting"
      });
    }

    const userBalance = Number(user.balance);
    const userExposure = Number(user.exposure);
    const userExposureLimit = Number(user.exposureLimit);
    const stakeAmount = Number(betData.stake);

    // Validate stake amount
    if (stakeAmount <= 0) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        status: false,
        message: "Stake amount must be greater than 0"
      });
    }

    // Check available balance (balance minus current exposure)
    const availableBalance = userBalance - userExposure;
    if (stakeAmount > availableBalance) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        status: false,
        message: "Not enough available balance"
      });
    }

    // Check exposure limit (current exposure + new stake)
    if (userExposure + stakeAmount > userExposureLimit) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        status: false,
        message: "Exceeds exposure limit"
      });
    }

    // Create and save bet
    const bet = sportsBetRepository.create({
      userId,
      userType: req.__type,
      exposure: exposure || 0,
      commission: commission || 0,
      partnership: partnership || 0,
      betData: {
        ...betData,
        stake: stakeAmount,
        placedAt: new Date().toISOString()
      },
      eventId: betData.eventId,
      sId: betData.sid,
      status: "pending",
    });

    await sportsBetRepository.save(bet);

    // Update user exposure
    user.exposure = userExposure + stakeAmount;
    await userRepo.save(user);

    await queryRunner.commitTransaction();

    return res.status(201).json({
      status: true,
      message: "Bet placed successfully",
      data: bet,
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error("Error placing bet:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await queryRunner.release();
  }
};

export const getCurrentBet = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { oddType } = req.query;


    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    if (!oddType) {
      return res.status(400).json({
        success: false,
        message: "oddType parameter is required"
      });
    }

    const currentBetRepo = AppDataSource.getRepository(SportBet);

    const latestBet = await currentBetRepo
      .createQueryBuilder("bet")
      .where("bet.userId = :userId", { userId })
      .andWhere("bet.betData ->> 'oddType' = :oddType", { oddType })
      .orderBy("bet.createdAt", "DESC");


    if (!latestBet) {
      return res.status(404).json({
        success: false,
        message: "No bets found for this user with the specified oddType"
      });
    }

    return res.status(200).json({
      success: true,
      data: latestBet
    });

  } catch (err: any) {
    console.error("Error fetching latest bet:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message
    });
  }
}


// export const settleUserSportBets = async (req: Request, res: Response) => {
//   try {
//     const { eventId, marketId } = req.body;
//     const userId = req.user?.userId;
    
//     // Validate input
//     if (!eventId || !marketId) {
//       return res.status(400).json({
//         success: false,
//         message: "eventId and marketId are required in the request body"
//       });
//     }
    
//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "User authentication required"
//       });
//     }

//     const sportBetRepo = CronDataSource.getRepository(SportBet);
    
//     // Fetch results from your third-party source (you might want to cache this)
//     const results = await fetchThirdPartyResults(eventId);
    
//     if (!results || results.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: `No results found for event ID: ${eventId}`
//       });
//     }

//     // Find the specific result for the requested marketId
//     const result = results.find((r: any) => {
//       const resultMarketId = String(r.market_id || r.marketId);
//       return resultMarketId === String(marketId);
//     });

//     if (!result) {
//       return res.status(404).json({
//         success: false,
//         message: `Market ID ${marketId} not found in results for event: ${eventId}`
//       });
//     }
      
//     // Extract final result and market type
//     const finalResult = result.final_result?.trim();
//     const marketType = result.market_type;
//     const marketName = result.market_name;
    
//     if (!finalResult) {
//       return res.status(404).json({
//         success: false,
//         message: `Result not determined for market ID ${marketId}`
//       });
//     }

//     // Find pending bets for this event ID and specific user
//     const pendingBets = await sportBetRepo.find({
//       where: { 
//         eventId: eventId,
//         userId: userId,
//         status: "pending" 
//       }
//     });

//     if (pendingBets.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "No pending bets found for this user and event",
//         settledCount: 0,
//         eventId: eventId,
//         marketId: marketId,
//         finalResult: finalResult,
//         marketType: marketType,
//         userId: userId
//       });
//     }

//     let settledCount = 0;
//     let errors = [];

//     for (const bet of pendingBets) {
//       try {
//         // Check if bet is already settled to prevent double processing
//         if (bet.betData?.result?.settled === true || bet.status !== "pending") {
//           console.log(`[PATCH] Bet ${bet.id} already settled (status: ${bet.status}), skipping`);
//           continue;
//         }

//         const betData = bet.betData || {};
//         const betSelection = betData.name || betData.betName;
//         const betMarketType = betData.marketType || marketType;
//         const betSid = betData.sid;

//         if (!betSelection) {
//           console.log(`[PATCH] Bet ${bet.id} has no selection name, skipping result update`);
//           errors.push({ betId: bet.id, error: "No selection name found" });
//           continue;
//         }

//         // Use a transaction for each bet
//         await CronDataSource.transaction(async (transactionalEntityManager) => {
//           // First, check if bet is still pending with a lock to prevent race conditions
//           const currentBet = await transactionalEntityManager.findOne(SportBet, {
//             where: { id: bet.id, status: "pending", userId: userId },
//             lock: { mode: "pessimistic_write" }
//           });

//           if (!currentBet) {
//             console.log(`[PATCH] Bet ${bet.id} no longer pending, skipping`);
//             return;
//           }

//           // Find user with lock
//           const user: any = await transactionalEntityManager.findOne(USER_TABLES.sports, {
//             where: { id: userId },
//             lock: { mode: "pessimistic_write" }
//           });

//           if (!user) {
//             console.log(`[PATCH] User ${userId} not found for bet ${bet.id}`);
//             errors.push({ betId: bet.id, error: "User not found" });
//             return;
//           }

//           const stakeAmount = Number(betData.stake) || 0;
//           let newStatus: "won" | "lost" = "lost";
//           let profitLoss = 0;

//           // Determine if bet won based on market type
//           let isWinner = determineBetWinner(
//             betSelection,
//             finalResult,
//             marketType,
//             marketName,
//             betData,
//             betSid
//           );

//           if (isWinner) {
//             newStatus = "won";
//             profitLoss = Number(betData.profit) || 0;
//             user.balance = Number(user.balance) + profitLoss;
//           } else {
//             newStatus = "lost";
//             profitLoss = Number(betData.loss) || 0;
//             user.balance = Number(user.balance) - profitLoss;
//           }

//           // Update exposure (subtract stake amount)
//           user.exposure = Number(user.exposure) - stakeAmount;

//           // Update bet status and result data
//           await transactionalEntityManager.update(SportBet, { id: bet.id }, {
//             status: newStatus,
//             betData: {
//               ...betData,
//               result: {
//                 marketId: marketId,
//                 marketName: marketName,
//                 marketType: marketType,
//                 finalResult: finalResult,
//                 settledAt: new Date(),
//                 profitLoss: profitLoss,
//                 stake: stakeAmount,
//                 betRate: betData.betRate || betData.matchOdd || 1,
//                 status: newStatus,
//                 settled: true,
//                 isWinner: isWinner
//               }
//             }
//           });
          
//           // Update user balance after bet is marked as settled
//           await transactionalEntityManager.save(user);

//           console.log(`[PATCH] Updated bet ${bet.id}: ${newStatus} with profit/loss: ${profitLoss}`);
//           settledCount++;
//         });
//       } catch (error: any) {
//         console.error(`[PATCH] Error processing bet ${bet.id}:`, error);
//         errors.push({ betId: bet.id, error: error.message });
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: `Settlement completed for user ${userId} on event ${eventId}, market ${marketId}`,
//       settledCount,
//       errorCount: errors.length,
//       eventId: eventId,
//       marketId: marketId,
//       finalResult: finalResult,
//       marketType: marketType,
//       userId: userId,
//       errors: errors.length > 0 ? errors : undefined
//     });

//   } catch (error: any) {
//     console.error(`[PATCH] Error in settleUserSportBets:`, error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error during settlement",
//       error: error.message
//     });
//   }
// };

// // Comprehensive function to determine winner for all market types
// function determineBetWinner(
//   betSelection: string,
//   finalResult: string,
//   marketType: string,
//   marketName: string,
//   betData: any,
//   betSid: string
// ): boolean {
//   const betSelectionLower = betSelection.toLowerCase();
//   const finalResultLower = finalResult.toLowerCase();
//   const marketNameLower = marketName.toLowerCase();

//   // Handle odd/even markets
//   if (marketType === "oddeven") {
//     const betIsOdd = betSelectionLower.includes("odd");
//     const resultIsOdd = finalResultLower.includes("odd");
//     return betIsOdd === resultIsOdd;
//   }

//   // Handle numeric result markets
//   const numericResult = parseInt(finalResult);
//   if (!isNaN(numericResult)) {
    
//     // Handle "Number" markets (0-9 number selection)
//     if (marketType.includes("INN") && marketNameLower.includes("number")) {
//       const selectedNumber = parseInt(betSelection.match(/\d+/)?.[0] || "-1");
//       const resultLastDigit = numericResult % 10;
//       return selectedNumber === resultLastDigit;
//     }

//     // Handle over runs markets (like "6 over runs LF")
//     if (marketNameLower.includes("over run") || marketNameLower.includes("over runs")) {
//       return determineOverRunWinner(betSelectionLower, numericResult, marketNameLower);
//     }

//     // Handle player performance markets
//     if (marketNameLower.includes("run") && 
//         (marketNameLower.includes("player") || marketNameLower.includes("batsman"))) {
//       return determinePlayerRunWinner(betSelectionLower, numericResult, betData);
//     }

//     // Handle boundaries markets
//     if (marketNameLower.includes("boundaries") || marketNameLower.includes("boundary")) {
//       return determineBoundariesWinner(betSelectionLower, numericResult, betData);
//     }

//     // Handle partnership/wicket markets
//     if (marketNameLower.includes("wkt") || marketNameLower.includes("partnership") || 
//         marketNameLower.includes("pship")) {
//       return determinePartnershipWinner(betSelectionLower, numericResult, betData);
//     }

//     // Handle fall of wicket markets
//     if (marketNameLower.includes("fall of") && marketNameLower.includes("wkt")) {
//       return determineFallOfWicketWinner(betSelectionLower, numericResult, betData);
//     }

//     // Default numeric comparison (exact match)
//     const betValue = parseInt(betSelection.match(/\d+/)?.[0] || "0");
//     return numericResult === betValue;
//   }

//   // Handle non-numeric results or other market types
//   return betSelectionLower === finalResultLower;
// }

// // Helper functions for specific market types
// function determineOverRunWinner(betSelection: string, numericResult: number, marketName: string): boolean {
//   // Extract over number from market name (e.g., "6 over runs LF" -> 6)
//   const overMatch = marketName.match(/(\d+)\s*over/);
//   if (overMatch) {
//     const overNumber = parseInt(overMatch[1]);
//     // For over/under markets, you might have different logic
//     // This assumes exact match for now
//     return numericResult === parseInt(betSelection.match(/\d+/)?.[0] || "0");
//   }
//   return false;
// }

// function determinePlayerRunWinner(betSelection: string, numericResult: number, betData: any): boolean {
//   // For player run markets, typically it's about reaching a certain threshold
//   // You might have over/under logic based on bet data
//   const targetRun = parseInt(betData.targetRun) || 0;
//   return numericResult >= targetRun;
// }

// function determineBoundariesWinner(betSelection: string, numericResult: number, betData: any): boolean {
//   // For boundaries markets
//   const boundariesTarget = parseInt(betData.targetBoundaries) || 0;
//   return numericResult >= boundariesTarget;
// }

// function determinePartnershipWinner(betSelection: string, numericResult: number, betData: any): boolean {
//   // For partnership runs markets
//   const partnershipTarget = parseInt(betData.targetPartnership) || 0;
//   return numericResult >= partnershipTarget;
// }

// function determineFallOfWicketWinner(betSelection: string, numericResult: number, betData: any): boolean {
//   // For fall of wicket markets (runs at which wicket fell)
//   const wicketFallTarget = parseInt(betData.targetWicketFall) || 0;
//   return numericResult >= wicketFallTarget;
// }

// // Function to fetch third-party results (implement based on your data source)
// async function fetchThirdPartyResults(eventId: string): Promise<any[]> {
//   // Implement your logic to fetch results from your third-party source
//   // This could be from an API, database, or Redis cache
//   // For now, return an empty array as placeholder
//   return [];
// }

// // Additional function to settle all markets for an event
// export const settleAllEventMarkets = async (req: Request, res: Response) => {
//   try {
//     const { eventId } = req.body;
//     const userId = req.user?.userId;
    
//     if (!eventId || !userId) {
//       return res.status(400).json({
//         success: false,
//         message: "eventId and userId are required"
//       });
//     }

//     const results = await fetchThirdPartyResults(eventId);
//     if (!results || results.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: `No results found for event ID: ${eventId}`
//       });
//     }

//     let totalSettled = 0;
//     const settlementResults = [];

//     for (const result of results) {
//       if (result.is_declared && !result.is_roleback) {
//         try {
//           // Mock request object for internal call
//           const mockReq = {
//             body: { eventId, marketId: result.market_id },
//             user: { userId }
//           } as any;
          
//           const mockRes = {
//             status: (code: number) => ({
//               json: (data: any) => {
//                 settlementResults.push({
//                   marketId: result.market_id,
//                   status: code,
//                   data
//                 });
//                 if (data.settledCount) totalSettled += data.settledCount;
//               }
//             })
//           } as any;

//           await settleUserSportBets(mockReq, mockRes);
//         } catch (error: any) {
//           settlementResults.push({
//             marketId: result.market_id,
//             error: error.message
//           });
//         }
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: `Bulk settlement completed for event ${eventId}`,
//       totalSettled,
//       totalMarkets: results.length,
//       results: settlementResults
//     });
//   } catch (error: any) {
//     console.error(`[PATCH] Error in settleAllEventMarkets:`, error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error during bulk settlement",
//       error: error.message
//     });
//   }
// };