import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { USER_TABLES } from "../../Helpers/users/Roles";
import { SportBet } from "../../entities/sports/SportBet";
import { CronDataSource } from "../../corn.server";
import axios from "axios";

export const createBet = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const userId = req.user.userId;

    const betData = {...req.body};

    // Validate required fields
    if (!userId || !betData?.stake || !betData?.eventId || !betData?.oddType || !betData?.sid) {
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
    const { eventId } = req.query;


    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "eventId parameter is required"
      });
    }

    const currentBetRepo = AppDataSource.getRepository(SportBet);

    const latestBet = await currentBetRepo
      .createQueryBuilder("bet")
      .where("bet.userId = :userId", { userId })
      .andWhere("bet.betData ->> 'eventId' = :eventId", { eventId })
      .orderBy("bet.createdAt", "DESC");


    if (!latestBet) {
      return res.status(404).json({
        success: false,
        message: "No bets found for this user with the specified eventId"
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


export const settleUserSportBets = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.body; 
    const userId = req.user?.userId;
    
    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "eventId (gmId) is required in the request body"
      });
    }
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const sportBetRepo = CronDataSource.getRepository(SportBet);
    
    const results = await fetchThirdPartyResults(eventId);
    
    if (!results || results.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No results found for event ID (gmId): ${eventId}`
      });
    }

    const pendingBets = await sportBetRepo.find({
      where: { 
        eventId: eventId,
        userId: userId,
        status: "pending" 
      }
    });

    if (pendingBets.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No pending bets found for this user and event",
        settledCount: 0,
        eventId: eventId
      });
    }

    let settledCount = 0;
    let errors = [];

    for (const bet of pendingBets) {
      try {
        if (bet.betData?.result?.settled === true || bet.status !== "pending") {
          continue;
        }

        const betData = bet.betData || {};
        const betSelection = betData.name || betData.betName;
        const betOddType = betData.oddType; 
        const betSid = betData.sid;

        if (!betSelection) {
          errors.push({ betId: bet.id, error: "Missing selection name" });
          continue;
        }

        // Find the correct result based on the bet type and selection
        const result = findMatchingResult(results, betData, betSelection, betOddType);
        
        if (!result) {
          errors.push({ 
            betId: bet.id, 
            error: `No matching result found for bet: ${betSelection} (Type: ${betOddType})` 
          });
          continue;
        }

        // Check if result is declared and not rolled back
        if (!result.is_declared || result.is_roleback) {
          errors.push({ 
            betId: bet.id, 
            error: `Market ${result.market_id} not declared or rolled back` 
          });
          continue;
        }

        const finalResult = result.final_result?.trim();
        const marketType = result.market_type;
        const marketName = result.market_name;
        
        if (!finalResult) {
          errors.push({ 
            betId: bet.id, 
            error: `No final result for market ${result.market_id}` 
          });
          continue;
        }

        // Use transaction for each bet
        await CronDataSource.transaction(async (transactionalEntityManager) => {
          // Lock bet and user to prevent race conditions
          const currentBet = await transactionalEntityManager.findOne(SportBet, {
            where: { id: bet.id, status: "pending", userId: userId },
            lock: { mode: "pessimistic_write" }
          });

          if (!currentBet) return;

          const user: any = await transactionalEntityManager.findOne(USER_TABLES.sports, {
            where: { id: userId },
            lock: { mode: "pessimistic_write" }
          });

          if (!user) {
            errors.push({ betId: bet.id, error: "User not found" });
            return;
          }

          const stakeAmount = Number(betData.stake) || 0;
          let newStatus: "won" | "lost" = "lost";
          let profitLoss = 0;

          // Determine if bet won based on market type and bet selection
          let isWinner = determineBetWinner(betSelection, finalResult, marketType, marketName, betOddType, betSid);

          if (isWinner) {
            newStatus = "won";
            profitLoss = Number(betData.profit) || 0;
            user.balance = Number(user.balance) + profitLoss;
          } else {
            newStatus = "lost";
            profitLoss = Number(betData.loss) || 0;
            user.balance = Number(user.balance) - profitLoss;
          }

          user.exposure = Number(user.exposure) - stakeAmount;

          // Update bet status
          await transactionalEntityManager.update(SportBet, { id: bet.id }, {
            status: newStatus,
            betData: {
              ...betData,
              result: {
                marketId: result.market_id,
                marketName: marketName,
                marketType: marketType,
                finalResult: finalResult,
                settledAt: new Date(),
                profitLoss: profitLoss,
                stake: stakeAmount,
                betRate: betData.betRate || betData.matchOdd || 1,
                status: newStatus,
                settled: true,
                isWinner: isWinner
              }
            }
          });
          
          // Update user balance
          await transactionalEntityManager.save(user);

          settledCount++;
        });
      } catch (error: any) {
        errors.push({ betId: bet.id, error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Settlement completed for event ${eventId}`,
      settledCount,
      errorCount: errors.length,
      eventId: eventId,
      totalBets: pendingBets.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Internal server error during settlement",
      error: error.message
    });
  }
};

// Helper function to find the matching result for a bet
function findMatchingResult(results: any[], betData: any, betSelection: string, betOddType: string) {
  const betSelectionLower = betSelection.toLowerCase();
  
  // For MATCH_ODDS and Bookmaker markets (team selection)
  if (betOddType === "MATCH_ODDS" || betOddType === "Bookmaker") {
    return results.find(r => 
      r.market_type === betOddType &&
      r.final_result && 
      r.final_result.trim() !== "" &&
      betSelectionLower.includes(r.final_result.toLowerCase())
    );
  }
  
  // For odd/even markets
  if (betSelectionLower.includes("odd") || betSelectionLower.includes("even")) {
    return results.find(r => 
      r.market_type === "oddeven" && 
      r.final_result && 
      r.final_result.trim() !== ""
    );
  }
  
  // For player performance markets (runs, boundaries)
  if (betSelectionLower.includes("run") || betSelectionLower.includes("boundary")) {
    // Try to find a result with matching player name
    return results.find(r => 
      r.market_name && 
      r.market_name.toLowerCase().includes(betSelectionLower) &&
      r.final_result && 
      r.final_result.trim() !== ""
    );
  }
  
  // For over/innings runs markets
  if (betSelectionLower.includes("over") || betSelectionLower.includes("inn")) {
    // Try to find matching market based on the bet selection context
    return results.find(r => 
      r.market_name && 
      r.market_name.toLowerCase().includes(betSelectionLower) &&
      r.final_result && 
      r.final_result.trim() !== ""
    );
  }
  
  // Default: return the first valid result that matches the context
  return results.find(r => r.final_result && r.final_result.trim() !== "");
}

// Helper function to determine if a bet wins
function determineBetWinner(
  betSelection: string, 
  finalResult: string, 
  marketType: string, 
  marketName: string,
  betOddType: string,
  betSid: string
): boolean {
  const betSelectionLower = betSelection.toLowerCase();
  const finalResultLower = finalResult.toLowerCase();
  const marketNameLower = marketName.toLowerCase();
  
  // Handle odd/even markets
  if (marketType === "oddeven") {
    const betIsOdd = betSelectionLower.includes("odd");
    const resultIsOdd = finalResultLower.includes("odd");
    return betIsOdd === resultIsOdd;
  }
  
  // Handle MATCH_ODDS and Bookmaker markets (team winner)
  if (marketType === "MATCH_ODDS" || marketType === "Bookmaker") {
    return betSelectionLower.includes(finalResultLower);
  }
  
  // Handle numeric result markets
  const numericResult = parseInt(finalResult);
  if (!isNaN(numericResult)) {
    
    // For number selection markets (like "3 Number")
    if (marketNameLower.includes("number")) {
      const selectedNumber = parseInt(betSelection.match(/\d+/)?.[0] || "-1");
      const resultLastDigit = numericResult % 10;
      return selectedNumber === resultLastDigit;
    }
    
    // For player run markets
    if (marketNameLower.includes("run") && !marketNameLower.includes("over")) {
      // This assumes the bet was placed on "Over X runs" or similar
      // You might need to adjust based on your actual bet placement logic
      const targetRun = parseInt(betSelection.match(/\d+/)?.[0] || "0");
      return numericResult >= targetRun;
    }
    
    // For over run markets
    if (marketNameLower.includes("over run")) {
      const targetRun = parseInt(betSelection.match(/\d+/)?.[0] || "0");
      return numericResult === targetRun;
    }
  }
  
  // For Yes/No markets (like TIED_MATCH)
  if (marketType === "TIED_MATCH") {
    if (betSelectionLower === "yes") {
      return finalResultLower !== "0";
    } else if (betSelectionLower === "no") {
      return finalResultLower === "0";
    }
  }
  
  return betSelectionLower === finalResultLower;
}

async function fetchThirdPartyResults(eventId: string): Promise<any[]> {
  try {
    const thirdPartyApiUrl = `${process.env.THIRD_PARTY_URL}/api/v2/diamondResults?eventId=${eventId}`;
    
    const response = await axios.get(thirdPartyApiUrl, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (Array.isArray(response.data)) {
      return response.data;
    }
    
    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    
    if (response.data && Array.isArray(response.data.results)) {
      return response.data.results;
    }

    console.error('Unexpected API response format:', response.data);
    return [];

  } catch (error: any) {
    console.error('Error fetching results from third-party API:', error.message);
    return [];
  }
}