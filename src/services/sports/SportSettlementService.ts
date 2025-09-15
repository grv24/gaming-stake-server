import { DataSource, In } from "typeorm";
import { SportBet } from "../../entities/sports/SportBet";
import { SportMatch } from "../../entities/sports/SportMatch";
import { USER_TABLES } from "../../Helpers/users/Roles";
import axios from "axios";

/**
 * SPORT SETTLEMENT SERVICE
 * 
 * Purpose: Automatically settle sport bets using third-party API results
 * 
 * Features:
 * - Fetches results from fancy and diamond APIs
 * - Updates SportMatch result data when null
 * - Settles pending sport bets based on results
 * - Optimized batch processing to minimize DB calls
 * - Comprehensive error handling and logging
 * - Proper handling of third-party API failures
 * 
 * Settlement Flow:
 * 1. Check for pending bets in SportBet table
 * 2. For each eventId with pending bets, find corresponding SportMatch
 * 3. Update SportMatch result data based on market type
 * 4. Settle pending bets with proper profit/loss calculation
 * 
 * API Endpoints Used:
 * - MATCH_ODDS/BOOKMAKER: Diamond API first, Fancy API fallback
 * - Other market types: Fancy API first, Diamond API fallback
 * - /api/v2/diamondResults?eventId=${eventId}
 * - /api/new/fancyResultData?eventId=${eventId}
 */

export class SportSettlementService {
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  /**
   * BATCH SETTLE SPORT MATCHES
   * 
   * Purpose: Process multiple sport matches for settlement
   * Flow: Check pending bets first, then update SportMatch, then settle bets
   * Optimization: Single batch query for all pending bets
   */
  async batchSettleMatches(eventIds: string[]): Promise<{
    settledCount: number;
    errorCount: number;
    errors: any[];
  }> {
    console.log(`[SPORT-SETTLE] Starting batch settlement for ${eventIds.length} events`);
    
    let settledCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    try {
      // Check database connection
      if (!this.dataSource.isInitialized) {
        console.error("[SPORT-SETTLE] Database not initialized");
        return { settledCount: 0, errorCount: 1, errors: [{ error: "Database not initialized" }] };
      }

      // STEP 1: Get all pending bets for all events
      const pendingBets = await this.dataSource.getRepository(SportBet).find({
        where: {
          eventId: In(eventIds),
          status: "pending"
        },
        order: { createdAt: "ASC" }
      });

      console.log(`[SPORT-SETTLE] Found ${pendingBets.length} pending bets across ${eventIds.length} events`);

      if (pendingBets.length === 0) {
        console.log(`[SPORT-SETTLE] No pending bets found for any of the ${eventIds.length} events`);
        return { settledCount: 0, errorCount: 0, errors: [] };
      }

      // Group bets by eventId for efficient processing
      const betsByEvent = new Map<string, any[]>();
      pendingBets.forEach(bet => {
        const eventId = bet.eventId;
        if (!betsByEvent.has(eventId)) {
          betsByEvent.set(eventId, []);
        }
        betsByEvent.get(eventId)!.push(bet);
      });

      // STEP 2: Process each event with pending bets
      for (const [eventId, bets] of betsByEvent) {
        try {
          console.log(`[SPORT-SETTLE] Processing event ${eventId} with ${bets.length} pending bets`);
          const result = await this.settleSportMatch(eventId, bets);
          settledCount += result.settledCount;
          errorCount += result.errorCount;
          errors.push(...result.errors);
        } catch (error: any) {
          console.error(`[SPORT-SETTLE] Error settling event ${eventId}:`, error);
          errorCount++;
          errors.push({ eventId, error: error.message });
        }
      }

      console.log(`[SPORT-SETTLE] Batch settlement completed: ${settledCount} settled, ${errorCount} errors`);
      
      return { settledCount, errorCount, errors };

    } catch (error: any) {
      console.error("[SPORT-SETTLE] Batch settlement error:", error);
      return { settledCount: 0, errorCount: 1, errors: [{ error: error.message }] };
    }
  }

  /**
   * SETTLE SINGLE SPORT MATCH
   * 
   * Purpose: Settle all pending bets for a specific sport event
   * Flow: 
   * 1. Check pending bets exist (already done in batchSettleMatches)
   * 2. Find corresponding SportMatch for the eventId
   * 3. Update SportMatch result data based on market type
   * 4. Settle pending bets with proper profit/loss calculation
   */
  async settleSportMatch(eventId: string, pendingBets: any[]): Promise<{
    settledCount: number;
    errorCount: number;
    errors: any[];
  }> {
    try {
      console.log(`[SPORT-SETTLE] Processing event ${eventId} with ${pendingBets.length} pending bets`);

      // STEP 1: Get SportMatch for this eventId
      const sportMatchRepo = this.dataSource.getRepository(SportMatch);
      const sportMatch = await sportMatchRepo.findOne({
        where: { eventId }
      });

      if (!sportMatch) {
        console.log(`[SPORT-SETTLE] No SportMatch found for event ${eventId} - skipping settlement`);
        return { settledCount: 0, errorCount: 1, errors: [{ eventId, error: "No SportMatch found" }] };
      }

      console.log(`[SPORT-SETTLE] Found SportMatch for event ${eventId}:`, {
        id: sportMatch.id,
        eventId: sportMatch.eventId,
        eventName: sportMatch.eventName,
        categoriesCount: sportMatch.categories.length
      });

      // STEP 2: Update SportMatch result data for each market type
      const updatedResults = [];
      let hasUpdatedResults = false;

      for (const category of sportMatch.categories) {
        const marketType = category.marketType;
        
        // Check if this category has null result data
        if (category.resultData === null) {
          console.log(`[SPORT-SETTLE] Category ${category.marketName} (${marketType}) has null result data - fetching results`);

          // Fetch result data from appropriate API based on market type
          const resultData = await this.fetchResultFromAPI(eventId, marketType);
          
          if (resultData && resultData.data) {
            // Update this specific category with result data
            await this.updateSportMatchCategoryResult(eventId, category, resultData);
            updatedResults.push({ marketType, resultData: resultData.data, category });
            hasUpdatedResults = true;
            console.log(`[SPORT-SETTLE] Successfully updated category ${category.marketName} with ${resultData.apiUsed} API data`);
          } else {
            console.log(`[SPORT-SETTLE] No result data available for event ${eventId}, market type ${marketType} - third party API has no data`);
            // Continue with existing result data if available
            if (category.resultData) {
              updatedResults.push({ marketType, resultData: category.resultData, category });
            }
          }
        } else {
          console.log(`[SPORT-SETTLE] Category ${category.marketName} already has result data`);
          updatedResults.push({ marketType, resultData: category.resultData, category });
        }
      }

      // STEP 3: Settle pending bets using available result data
      if (pendingBets.length > 0 && updatedResults.length > 0) {
        console.log(`[SPORT-SETTLE] Settling ${pendingBets.length} pending bets for event ${eventId}`);
        
        // Use the first available result data for settlement
        const firstResult = updatedResults[0];
        return await this.settleUserBets(pendingBets, firstResult.resultData);
      } else if (pendingBets.length > 0 && updatedResults.length === 0) {
        console.error(`[SPORT-SETTLE] No result data available for event ${eventId} - cannot settle ${pendingBets.length} pending bets (both APIs failed)`);
        return { settledCount: 0, errorCount: 1, errors: [{ eventId, error: "No result data available for settlement - both APIs failed" }] };
      } else {
        console.log(`[SPORT-SETTLE] Updated SportMatch result data for event ${eventId} (no pending bets)`);
        return { settledCount: 0, errorCount: 0, errors: [] };
      }

    } catch (error: any) {
      console.error(`[SPORT-SETTLE] Error settling event ${eventId}:`, error);
      return { settledCount: 0, errorCount: 1, errors: [{ eventId, error: error.message }] };
    }
  }

  /**
   * FETCH RESULT FROM API WITH FALLBACK
   * 
   * Purpose: Get sport result data from third-party APIs with proper fallback mechanism
   * Strategy: 
   * - MATCH_ODDS and BOOKMAKER → Try Diamond API first, then Fancy API as fallback
   * - All other market types → Try Fancy API first, then Diamond API as fallback
   * - Handle connection errors gracefully with proper fallback
   * - Proper error handling for third-party API failures
   */
  private async fetchResultFromAPI(eventId: string, marketType?: string): Promise<any> {
    try {
      // Determine which API to try first based on market type
      const isMatchOdds = marketType === "MATCH_ODDS" || marketType === "BOOKMAKER";
      
      // Try primary API first
      let result = await this.tryAPI(eventId, isMatchOdds ? "diamond" : "fancy", marketType);
      
      if (result) {
        return result;
      }
      
      // If primary API failed, try fallback API
      console.log(`[SPORT-SETTLE] Primary API failed for event ${eventId}, trying fallback API`);
      result = await this.tryAPI(eventId, isMatchOdds ? "fancy" : "diamond", marketType);
      
      if (result) {
        console.log(`[SPORT-SETTLE] Fallback API succeeded for event ${eventId}`);
        return result;
      }
      
      // Both APIs failed
      console.error(`[SPORT-SETTLE] Both APIs failed for event ${eventId}, market type ${marketType} - bet will remain pending`);
      return null;

    } catch (error: any) {
      console.error(`[SPORT-SETTLE] Unexpected API fetch error for event ${eventId}:`, error);
      return null;
    }
  }

  /**
   * TRY SPECIFIC API
   * 
   * Purpose: Attempt to fetch data from a specific API endpoint
   * Returns: Result object with data and apiUsed, or null if failed
   */
  private async tryAPI(eventId: string, apiType: "diamond" | "fancy", marketType?: string): Promise<any> {
    try {
      let response;
      let apiUsed = apiType;
      
      if (apiType === "diamond") {
        console.log(`[SPORT-SETTLE] Trying Diamond API for event ${eventId}, market type: ${marketType}`);
        const diamondUrl = `${process.env.THIRD_PARTY_URL}/api/v2/diamondResults?eventId=${eventId}`;
        console.log(`[SPORT-SETTLE] Diamond API URL: ${diamondUrl}`);
        
        try {
          response = await axios.get(diamondUrl, { 
            timeout: 10000,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'GameStake-Server/1.0'
            }
          });
          console.log(`[SPORT-SETTLE] Diamond API response status: ${response.status}, data:`, response.data);
        } catch (err: any) {
          console.error(`[SPORT-SETTLE] Diamond API failed for event ${eventId}:`, {
            message: err.message,
            code: err.code,
            status: err.response?.status,
            statusText: err.response?.statusText
          });
          return null;
        }
      } else {
        console.log(`[SPORT-SETTLE] Trying Fancy API for event ${eventId}, market type: ${marketType}`);
        const fancyUrl = `${process.env.THIRD_PARTY_URL}/api/new/fancyResultData?eventId=${eventId}`;
        console.log(`[SPORT-SETTLE] Fancy API URL: ${fancyUrl}`);
        
        try {
          response = await axios.get(fancyUrl, { 
            timeout: 10000,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'GameStake-Server/1.0'
            }
          });
          console.log(`[SPORT-SETTLE] Fancy API response status: ${response.status}, data:`, response.data);
        } catch (err: any) {
          console.error(`[SPORT-SETTLE] Fancy API failed for event ${eventId}:`, {
            message: err.message,
            code: err.code,
            status: err.response?.status,
            statusText: err.response?.statusText
          });
          return null;
        }
      }

      console.log(`[SPORT-SETTLE] ${apiUsed.toUpperCase()} API response for event ${eventId}:`, response.data);

      // Process response data with better validation
      if (response.data) {
        // Check if response indicates success
        if (response.data.success === false) {
          console.log(`[SPORT-SETTLE] ${apiUsed.toUpperCase()} API returned success: false for event ${eventId}`);
          return null;
        }
        
        // Check if response has actual data
        const responseData = response.data.data || response.data;
        if (!responseData || (Array.isArray(responseData) && responseData.length === 0)) {
          console.log(`[SPORT-SETTLE] ${apiUsed.toUpperCase()} API returned empty data for event ${eventId}`);
          return null;
        }
        
        return {
          data: responseData,
          apiUsed: apiUsed,
          marketType: marketType
        };
      }

      console.log(`[SPORT-SETTLE] ${apiUsed.toUpperCase()} API returned null/undefined data for event ${eventId}`);
      return null;

    } catch (error: any) {
      console.error(`[SPORT-SETTLE] Unexpected API fetch error for event ${eventId}:`, error);
      return null;
    }
  }

  /**
   * UPDATE SPORT MATCH CATEGORY RESULT
   * 
   * Purpose: Update specific category result data in SportMatch
   * Optimization: Only update the specific category that needs updating
   */
  private async updateSportMatchCategoryResult(eventId: string, category: any, resultData: any): Promise<void> {
    try {
      const sportMatchRepo = this.dataSource.getRepository(SportMatch);
      
      console.log(`[SPORT-SETTLE] Updating category ${category.marketName} (${category.marketType}) with result data`);

      // Get the current SportMatch
      const sportMatch = await sportMatchRepo.findOne({
        where: { eventId }
      });

      if (!sportMatch) {
        console.log(`[SPORT-SETTLE] No SportMatch found for event ${eventId}`);
        return;
      }

      // Update only the specific category
      const updatedCategories = sportMatch.categories.map((cat: any) => {
        if (cat.marketId === category.marketId && cat.marketType === category.marketType) {
          console.log(`[SPORT-SETTLE] Updating category ${cat.marketName} with ${resultData.apiUsed} API data`);
          return {
            ...cat,
            resultData: resultData.data
          };
        }
        return cat;
      });

      await sportMatchRepo.update(
        { eventId },
        { categories: updatedCategories }
      );

      console.log(`[SPORT-SETTLE] Successfully updated category ${category.marketName} with ${resultData.apiUsed} API data`);

    } catch (error: any) {
      console.error(`[SPORT-SETTLE] Error updating category ${category.marketName}:`, error);
    }
  }

  /**
   * UPDATE SPORT MATCH RESULT (DEPRECATED - kept for backward compatibility)
   * 
   * Purpose: Update SportMatch result data when null
   * Optimization: Only update if resultData is null
   */
  private async updateSportMatchResult(eventId: string, resultData: any): Promise<void> {
    try {
      const sportMatchRepo = this.dataSource.getRepository(SportMatch);
      
      console.log(`[SPORT-SETTLE] Looking for SportMatch with eventId: ${eventId}`);
      const sportMatch = await sportMatchRepo.findOne({
        where: { eventId }
      });

      if (!sportMatch) {
        console.log(`[SPORT-SETTLE] No SportMatch found for event ${eventId}`);
        return;
      }

      console.log(`[SPORT-SETTLE] Found SportMatch for event ${eventId}:`, {
        id: sportMatch.id,
        eventId: sportMatch.eventId,
        eventName: sportMatch.eventName,
        categories: sportMatch.categories
      });

      // Check if any category has null resultData
      const hasNullResults = sportMatch.categories.some((cat: any) => cat.resultData === null);
      
      if (!hasNullResults) {
        console.log(`[SPORT-SETTLE] SportMatch already has result data for event ${eventId}`);
        return;
      }

      console.log(`[SPORT-SETTLE] Updating SportMatch result data for event ${eventId}`);

      // Update categories with result data
      const updatedCategories = sportMatch.categories.map((cat: any) => {
        if (cat.resultData === null) {
          console.log(`[SPORT-SETTLE] Updating category ${cat.marketName} with result data`);
          return {
            ...cat,
            resultData: resultData
          };
        }
        return cat;
      });

      await sportMatchRepo.update(
        { eventId },
        { categories: updatedCategories }
      );

      console.log(`[SPORT-SETTLE] Successfully updated SportMatch result data for event ${eventId}`);

    } catch (error: any) {
      console.error(`[SPORT-SETTLE] Error updating SportMatch for event ${eventId}:`, error);
    }
  }

  /**
   * SETTLE USER BETS
   * 
   * Purpose: Settle all pending bets for users based on result data
   * Optimization: Batch database operations
   */
  private async settleUserBets(pendingBets: any[], resultData: any): Promise<{
    settledCount: number;
    errorCount: number;
    errors: any[];
  }> {
    let settledCount = 0;
    const errors: any[] = [];

    try {
      // Group bets by user for efficient processing
      const betsByUser = new Map<string, any[]>();
      pendingBets.forEach(bet => {
        const userId = bet.userId;
        if (!betsByUser.has(userId)) {
          betsByUser.set(userId, []);
        }
        betsByUser.get(userId)!.push(bet);
      });

      // Process each user's bets
      for (const [userId, userBets] of betsByUser) {
        try {
          const userSettledCount = await this.settleUserBetsForUser(userId, userBets, resultData);
          settledCount += userSettledCount;
        } catch (error: any) {
          console.error(`[SPORT-SETTLE] Error settling bets for user ${userId}:`, error);
          errors.push({ userId, error: error.message });
        }
      }

      return { settledCount, errorCount: errors.length, errors };

    } catch (error: any) {
      console.error("[SPORT-SETTLE] Error settling user bets:", error);
      return { settledCount: 0, errorCount: 1, errors: [{ error: error.message }] };
    }
  }

  /**
   * SETTLE USER BETS FOR SPECIFIC USER
   * 
   * Purpose: Settle all pending bets for a specific user
   * Optimization: Single transaction per user
   */
  private async settleUserBetsForUser(userId: string, userBets: any[], resultData: any): Promise<number> {
    let settledCount = 0;

    try {
      await this.dataSource.transaction(async (transactionalEntityManager) => {
        // Get user type from first bet
        const userType = userBets[0]?.userType;
        if (!userType) {
          console.error(`[SPORT-SETTLE] No user type found for user ${userId}`);
          return;
        }

        // Get user with lock
        const user = await transactionalEntityManager.findOne(
          USER_TABLES[userType as any],
          {
            where: { id: userId },
            lock: { mode: "pessimistic_write" }
          }
        );

        if (!user) {
          console.error(`[SPORT-SETTLE] User ${userId} not found`);
          return;
        }

        // Process each bet
        for (const bet of userBets) {
          try {
            const betData = bet.betData || {};
            const betSid = betData.sid;
            const marketId = betData.marketId;
            const marketType = betData.marketType;

            if (!betSid || !marketId) {
              console.error(`[SPORT-SETTLE] Missing bet data for bet ${bet.id}`);
              continue;
            }

            // Determine if bet won
            const isWinner = this.determineBetWinner(betData, resultData);

            // Calculate profit/loss
            const stakeAmount = Number(betData.stake) || 0;
            const betRate = Number(betData.betRate) || Number(betData.matchOdd) || 1;
            let profitLoss = 0;
            let finalStatus: "won" | "lost" = "lost";

            if (isWinner) {
              finalStatus = "won";
              // Calculate profit: (stake * rate) - stake = stake * (rate - 1)
              profitLoss = stakeAmount * (betRate - 1);
              (user as any).balance = Number((user as any).balance) + profitLoss;
              console.log(`[SPORT-SETTLE] Bet ${bet.id} WON: Stake=${stakeAmount}, Rate=${betRate}, Profit=${profitLoss}`);
            } else {
              finalStatus = "lost";
              // Loss is the stake amount
              profitLoss = -stakeAmount;
              (user as any).balance = Number((user as any).balance) + profitLoss; // Add negative = subtract
              console.log(`[SPORT-SETTLE] Bet ${bet.id} LOST: Stake=${stakeAmount}, Loss=${profitLoss}`);
            }

            // Update exposure: reduce by stake amount (regardless of win/loss)
            (user as any).exposure = Number((user as any).exposure) - stakeAmount;

            // Update bet status
            await transactionalEntityManager.update(
              SportBet,
              { id: bet.id },
              {
                status: finalStatus,
                betData: {
                  ...betData,
                  result: {
                    marketId: marketId,
                    marketName: betData.marketName || "",
                    marketType: marketType,
                    finalResult: resultData,
                    settledAt: new Date(),
                    profitLoss: profitLoss,
                    stake: stakeAmount,
                    betRate: betRate,
                    status: finalStatus,
                    settled: true,
                    isWinner: isWinner,
                    originalStake: stakeAmount,
                    calculatedProfit: isWinner ? profitLoss : 0,
                    calculatedLoss: !isWinner ? Math.abs(profitLoss) : 0
                  }
                }
              }
            );

            settledCount++;

          } catch (error: any) {
            console.error(`[SPORT-SETTLE] Error processing bet ${bet.id}:`, error);
          }
        }

        // Save user
        await transactionalEntityManager.save(user);

      });

      return settledCount;

    } catch (error: any) {
      console.error(`[SPORT-SETTLE] Transaction error for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * DETERMINE BET WINNER
   * 
   * Purpose: Determine if a bet won based on result data
   * Logic: Compare bet selection (SID) with actual result
   * Strategy: Match SID from bet with winner SID from result data
   * Improved: Better error handling and logging
   */
  private determineBetWinner(betData: any, resultData: any): boolean {
    try {
      const betSid = betData.sid;
      const marketId = betData.marketId;
      const marketType = betData.marketType;

      console.log(`[SPORT-SETTLE] Determining winner for bet SID: ${betSid}, Market ID: ${marketId}, Market Type: ${marketType}`);

      // Validate required bet data
      if (!betSid || !marketId) {
        console.error(`[SPORT-SETTLE] Missing required bet data: SID=${betSid}, MarketID=${marketId}`);
        return false;
      }

      // Find matching result in resultData
      const matchingResult = this.findMatchingResult(resultData, betData);

      if (!matchingResult) {
        console.log(`[SPORT-SETTLE] No matching result found for bet SID: ${betSid}, Market ID: ${marketId}`);
        return false;
      }

      console.log(`[SPORT-SETTLE] Found matching result:`, {
        winner: matchingResult.winner,
        selection_id: matchingResult.selection_id,
        sid: matchingResult.sid,
        market_id: matchingResult.market_id
      });

      // Determine winner based on market type
      switch (marketType) {
        case "MATCH_ODDS":
        case "BOOKMAKER":
          // For match odds, check if bet SID matches the winner SID
          const winnerSid = matchingResult.winner || matchingResult.selection_id || matchingResult.sid;
          const isWinner = String(winnerSid) === String(betSid);
          console.log(`[SPORT-SETTLE] MATCH_ODDS/BOOKMAKER: Winner SID: ${winnerSid}, Bet SID: ${betSid}, Is Winner: ${isWinner}`);
          return isWinner;
        
        case "OVER_UNDER":
          return this.checkOverUnderResult(betData, matchingResult);
        
        case "HANDICAP":
          return this.checkHandicapResult(betData, matchingResult);
        
        default:
          // Default logic: check if bet sid matches winner
          const defaultWinnerSid = matchingResult.winner || matchingResult.selection_id || matchingResult.sid;
          const defaultIsWinner = String(defaultWinnerSid) === String(betSid);
          console.log(`[SPORT-SETTLE] DEFAULT: Winner SID: ${defaultWinnerSid}, Bet SID: ${betSid}, Is Winner: ${defaultIsWinner}`);
          return defaultIsWinner;
      }

    } catch (error: any) {
      console.error("[SPORT-SETTLE] Error determining bet winner:", error);
      return false;
    }
  }

  /**
   * FIND MATCHING RESULT
   * 
   * Purpose: Find the result data that matches the bet
   * Strategy: Match by market_id, sid, or selection_id
   */
  private findMatchingResult(resultData: any, betData: any): any {
    try {
      const betSid = betData.sid;
      const betMarketId = betData.marketId;

      console.log(`[SPORT-SETTLE] Finding matching result for bet SID: ${betSid}, Market ID: ${betMarketId}`);
      console.log(`[SPORT-SETTLE] Result data structure:`, typeof resultData, Array.isArray(resultData) ? `Array[${resultData.length}]` : 'Object');

      // If resultData is an array, find matching item
      if (Array.isArray(resultData)) {
        console.log(`[SPORT-SETTLE] Searching in array of ${resultData.length} results`);
        
        for (let i = 0; i < resultData.length; i++) {
          const item = resultData[i];
          console.log(`[SPORT-SETTLE] Checking item ${i}:`, {
            market_id: item.market_id,
            sid: item.sid,
            selection_id: item.selection_id,
            winner: item.winner
          });

          // Match by market_id first, then by sid
          if (item.market_id === betMarketId || 
              item.sid === betSid || 
              item.selection_id === betSid ||
              String(item.market_id) === String(betMarketId) ||
              String(item.sid) === String(betSid) ||
              String(item.selection_id) === String(betSid)) {
            console.log(`[SPORT-SETTLE] Found matching result in array at index ${i}`);
            return item;
          }
        }
        
        console.log(`[SPORT-SETTLE] No matching result found in array`);
        return null;
      }

      // If resultData is an object, check if it matches
      if (resultData && typeof resultData === 'object') {
        console.log(`[SPORT-SETTLE] Checking single result object:`, {
          market_id: resultData.market_id,
          sid: resultData.sid,
          selection_id: resultData.selection_id,
          winner: resultData.winner
        });

        if (resultData.market_id === betMarketId || 
            resultData.sid === betSid || 
            resultData.selection_id === betSid ||
            String(resultData.market_id) === String(betMarketId) ||
            String(resultData.sid) === String(betSid) ||
            String(resultData.selection_id) === String(betSid)) {
          console.log(`[SPORT-SETTLE] Found matching single result object`);
          return resultData;
        }
      }

      console.log(`[SPORT-SETTLE] No matching result found`);
      return null;

    } catch (error: any) {
      console.error("[SPORT-SETTLE] Error finding matching result:", error);
      return null;
    }
  }

  /**
   * CHECK OVER/UNDER RESULT
   * 
   * Purpose: Determine winner for over/under bets
   */
  private checkOverUnderResult(betData: any, result: any): boolean {
    try {
      const betValue = Number(betData.betValue) || 0;
      const actualValue = Number(result.value) || 0;
      const betType = betData.betType; // "over" or "under"

      if (betType === "over") {
        return actualValue > betValue;
      } else if (betType === "under") {
        return actualValue < betValue;
      }

      return false;

    } catch (error: any) {
      console.error("[SPORT-SETTLE] Error checking over/under result:", error);
      return false;
    }
  }

  /**
   * CHECK HANDICAP RESULT
   * 
   * Purpose: Determine winner for handicap bets
   */
  private checkHandicapResult(betData: any, result: any): boolean {
    try {
      const handicapValue = Number(betData.handicapValue) || 0;
      const actualValue = Number(result.value) || 0;
      const betSid = betData.sid;

      // Handicap logic: adjust actual value by handicap and check winner
      const adjustedValue = actualValue + handicapValue;
      
      // This is simplified - actual handicap logic may be more complex
      return result.winner === betSid;

    } catch (error: any) {
      console.error("[SPORT-SETTLE] Error checking handicap result:", error);
      return false;
    }
  }
}
