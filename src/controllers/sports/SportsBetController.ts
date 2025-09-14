import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { USER_TABLES } from "../../Helpers/users/Roles";
import { SportBet } from "../../entities/sports/SportBet";
import { SportMatch } from "../../entities/sports/SportMatch";
import { CronDataSource } from "../../corn.server";
import axios from "axios";

export const createBet = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const userId = req.user.userId;

    const betData = {...req.body};



    console.log(betData);
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
    const sportMatchRepository = queryRunner.manager.getRepository(SportMatch);

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

    // 🔗 Send bet to external API
    console.log("🚀 Attempting to forward bet to external provider...");
    console.log("📊 Bet Data:", {
      userId,
      eventId: betData.eventId,
      eventName: betData.eventName,
      marketId: betData.marketId,
      marketName: betData.marketName,
      marketType: betData.marketType,
      stake: stakeAmount,
      oddType: betData.oddType,
      sid: betData.sid
    });

    let thirdPartyResponse = null;
    try {
      const baseUrl = `${process.env.THIRD_PARTY_URL}/api/new/placed_bets`;
      const url = `${baseUrl}?event_id=${encodeURIComponent(
        betData.eventId
      )}&event_name=${encodeURIComponent(
        betData.eventName
      )}&market_id=${encodeURIComponent(
        betData.marketId
      )}&market_name=${encodeURIComponent(
        betData.marketName
      )}&market_type=${encodeURIComponent(betData.marketType)}`;

      console.log("🌐 External API URL:", url);
      console.log("📤 Sending GET request to external provider...");

      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log("✅ SUCCESS: Bet forwarded to external provider");
      console.log("📈 Response Status:", response.status);
      console.log("📋 Response Data:", response.data);
      console.log("🔗 Provider URL:", url);

      thirdPartyResponse = response.data;

    } catch (err: any) {
      console.error("❌ FAILED: Could not forward bet to external provider");
      console.error("🚨 Error Details:", {
        message: err.message,
        code: err.code,
        status: err.response?.status,
        statusText: err.response?.statusText,
        responseData: err.response?.data,
        url: err.config?.url,
        method: err.config?.method
      });
      
      if (err.code === 'ECONNREFUSED') {
        console.error("🔌 Connection Error: External provider server is not reachable");
      } else if (err.code === 'ETIMEDOUT') {
        console.error("⏰ Timeout Error: External provider took too long to respond");
      } else if (err.response?.status >= 400) {
        console.error(`🚫 HTTP Error: External provider returned ${err.response.status}`);
      }
      
      // Rollback transaction and return third-party error
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        status: false,
        message: "Failed to place bet with external provider",
        error: {
          message: err.message,
          status: err.response?.status,
          statusText: err.response?.statusText,
          responseData: err.response?.data
        }
      });
    }

    // Only proceed with database operations if third-party API succeeded
    if (!thirdPartyResponse) {
      await queryRunner.rollbackTransaction();
      return res.status(500).json({
        status: false,
        message: "No response from external provider"
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

    // 🏆 Create or update SportMatch record for this event
    try {
      console.log("🏆 Creating/updating SportMatch record for event:", betData.eventId);
      
      // Check if SportMatch already exists for this event
      let sportMatch = await sportMatchRepository.findOne({
        where: { eventId: betData.eventId }
      });

      if (!sportMatch) {
        // Create new SportMatch record
        sportMatch = sportMatchRepository.create({
          eventId: betData.eventId,
          eventName: betData.eventName,
          sportType: betData.sportType,
          categories: [{
            marketName: betData.marketName,
            marketType: betData.marketType,
            marketId: betData.marketId,
            sid: betData.sid,
            resultData: null,
          }],
        });
        
        console.log("✅ Created new SportMatch record:", {
          eventId: sportMatch.eventId,
          eventName: sportMatch.eventName,
          sportType: sportMatch.sportType,
          categories: sportMatch.categories
        });
      } else {
        // Update existing SportMatch with new market info
        console.log("📝 SportMatch already exists for event:", betData.eventId);
        
        // Check if this market combination already exists
        const existingCategory = sportMatch.categories.find(cat => 
          cat.marketName === betData.marketName && 
          cat.marketType === betData.marketType &&
          cat.marketId === betData.marketId &&
          cat.sid === betData.sid
        );
        
        if (!existingCategory) {
          // Add new category if not already present
          sportMatch.categories.push({
            marketName: betData.marketName,
            marketType: betData.marketType,
            marketId: betData.marketId,
            sid: betData.sid,
            resultData: null
          });
          console.log("➕ Added new market category:", {
            marketName: betData.marketName,
            marketType: betData.marketType,
            marketId: betData.marketId,
            sid: betData.sid

          });
        } else {
          console.log("📋 Market category already exists:", {
            marketName: betData.marketName,
            marketType: betData.marketType,
            marketId: betData.marketId,
            sid: betData.sid
          });
        }
        
        console.log("🔄 Updated SportMatch categories:", sportMatch.categories);
      }

      await sportMatchRepository.save(sportMatch);
      console.log("💾 SportMatch record saved successfully");

    } catch (matchError: any) {
      console.error("⚠️ Error handling SportMatch record:", matchError.message);
      // Don't fail the entire bet if SportMatch creation fails
      // This is non-critical for bet placement
    }

    // Update user exposure
    user.exposure = userExposure + stakeAmount;
    await userRepo.save(user);

    await queryRunner.commitTransaction();

    return res.status(201).json({
      status: true,
      message: "Bet placed successfully",
      data: bet,
      thirdPartyResponse: thirdPartyResponse
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
    const { eventId, page = "1", limit = "10" } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "eventId parameter is required",
      });
    }

    const currentBetRepo = AppDataSource.getRepository(SportBet);

    // Convert pagination values
    const pageNum = Math.max(parseInt(page as string, 10), 1);
    const limitNum = Math.max(parseInt(limit as string, 10), 1);
    const skip = (pageNum - 1) * limitNum;

    // Query for paginated bets
    const [bets, total] = await currentBetRepo
      .createQueryBuilder("bet")
      .where("bet.userId = :userId", { userId })
      .andWhere("bet.betData ->> 'eventId' = :eventId", { eventId })
      .orderBy("bet.createdAt", "DESC")
      .skip(skip)
      .take(limitNum)
      .getManyAndCount();

    if (bets.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bets found for this user with the specified eventId",
      });
    }

    return res.status(200).json({
      success: true,
      data: bets,
      pagination: {
        totalItems: total,
        currentPage: pageNum,
        itemsPerPage: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    console.error("Error fetching bets:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};



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
    const thirdPartyApiUrl = `http://localhost:3000/api/v2/diamondResults?eventId=${eventId}`;
    
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