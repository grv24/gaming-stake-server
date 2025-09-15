import { DataSource, In } from "typeorm";
import { SportBet } from "../../entities/sports/SportBet";
import { SportMatch } from "../../entities/sports/SportMatch";
import { USER_TABLES } from "../../Helpers/users/Roles";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

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
 * COMPLETE SETTLEMENT FLOW:
 * ========================
 * 
 * 1. BATCH SETTLEMENT ENTRY:
 *    - batchSettleMatches(["745429556"]) called
 *    - Finds all pending bets for event IDs
 *    - Groups bets by eventId for processing
 * 
 * 2. SINGLE EVENT PROCESSING:
 *    - settleSportMatch("745429556", pendingBets) called
 *    - Gets SportMatch record for eventId
 *    - Checks categories for null resultData
 * 
 * 3. API SELECTION LOGIC:
 *    - MATCH_ODDS/BOOKMAKER → Diamond API first, Fancy fallback
 *    - ALL OTHER MARKET TYPES → Fancy API first, Diamond fallback
 *    - Example: "Period Winner" → Fancy API first
 * 
 * 4. FANCY API SCENARIO (for non-MATCH_ODDS/BOOKMAKER):
 *    - URL: /api/new/fancyResultData?eventId=745429556
 *    - Timeout: 10 seconds
 *    - Headers: Accept: application/json, User-Agent: GameStake-Server/1.0
 *    - Response validation: success !== false, data exists
 * 
 * 5. RESULT DATA UPDATE:
 *    - Updates category.resultData from null to Fancy API response
 *    - Only updates specific category that had null data
 *    - Preserves existing data for other categories
 * 
 * 6. BET SETTLEMENT PROCESS:
 *    - Groups pending bets by userId for efficiency
 *    - Uses database transactions for data consistency
 *    - Pessimistic locking on user records
 * 
 * 7. WINNER DETERMINATION:
 *    - findMatchingResult(): Matches by market_id, sid, selection_id
 *    - determineBetWinner(): Compares bet SID with result winner SID
 *    - For "Period Winner": Uses default logic (not MATCH_ODDS/BOOKMAKER logic)
 * 
 * 8. PROFIT/LOSS CALCULATION:
 *    - WINNING BET: profit = stake × (betRate - 1)
 *    - LOSING BET: loss = stake amount
 *    - Updates user balance: oldBalance + profitLoss
 *    - Reduces exposure: oldExposure - stakeAmount
 * 
 * 9. BET STATUS UPDATE:
 *    - Marks bet as "won" or "lost"
 *    - Stores comprehensive result data in betData.result
 *    - Includes: market info, final result, settlement time, profit/loss
 * 
 * EXAMPLE DATA FLOW:
 * =================
 * 
 * Input SportMatch Category:
 * {
 *   "sid": 523711,
 *   "marketId": "745429556",
 *   "marketName": "Cerezo Osaka W (Cerezo Osaka W - NTV Beleza W)",
 *   "marketType": "Period Winner",
 *   "resultData": null  ← This triggers API call
 * }
 * 
 * Fancy API Response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "market_id": "745429556",
 *       "sid": 523711,
 *       "winner": 523711,
 *       "selection_id": 523711,
 *       "value": "1-0",
 *       "status": "finished"
 *     }
 *   ]
 * }
 * 
 * Updated Category:
 * {
 *   "sid": 523711,
 *   "marketId": "745429556",
 *   "marketName": "Cerezo Osaka W (Cerezo Osaka W - NTV Beleza W)",
 *   "marketType": "Period Winner",
 *   "resultData": [Fancy API response data]  ← Updated with API data
 * }
 * 
 * Bet Settlement:
 * - Bet SID: 523711 (Cerezo Osaka W)
 * - Result Winner: 523711
 * - Match: SID === Winner → WIN
 * - Stake: 100, Rate: 2.5
 * - Profit: 100 × (2.5 - 1) = 150
 * - User Balance: oldBalance + 150
 * - User Exposure: oldExposure - 100
 * 
 * API Endpoints Used:
 * - MATCH_ODDS/BOOKMAKER: Diamond API first, Fancy API fallback
 * - Other market types: Fancy API first, Diamond API fallback
 * - /api/v2/diamondResults?eventId=${eventId}
 * - /api/new/fancyResultData?eventId=${eventId}
 */

export class SportSettlementService {
  private dataSource: DataSource;
  private logFilePath: string;
  private logDirectory: string;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    
    // Setup logging directory and file
    this.logDirectory = path.join(process.cwd(), 'logs', 'sport-settlement');
    this.logFilePath = path.join(this.logDirectory, `sport-settlement-${this.getCurrentDateString()}.log`);
    
    // Ensure log directory exists
    this.ensureLogDirectory();
  }

  /**
   * SPORT SETTLEMENT FILE LOGGING SYSTEM
   * 
   * Purpose: Save all sport settlement logs to dedicated files
   * Features:
   * - Daily log files (sport-settlement-YYYY-MM-DD.log)
   * - Structured log format with timestamps
   * - Automatic log directory creation
   * - Error handling for log write failures
   * - Console output for immediate feedback
   * 
   * Log File Location: /logs/sport-settlement/sport-settlement-YYYY-MM-DD.log
   * Log Format: [TIMESTAMP] [LEVEL] [SPORT-SETTLE] Message
   */
   
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
        console.log(`[SPORT-SETTLE] Created log directory: ${this.logDirectory}`);
      }
    } catch (error) {
      console.error(`[SPORT-SETTLE] Failed to create log directory: ${error}`);
    }
  }

  private getCurrentDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  private writeToLogFile(level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG', message: string, data?: any): void {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${level}] [SPORT-SETTLE] ${message}`;
      
      let fullLogEntry = logEntry;
      if (data) {
        fullLogEntry += `\n${JSON.stringify(data, null, 2)}`;
      }
      fullLogEntry += '\n' + '='.repeat(80) + '\n';

      // Append to log file
      fs.appendFileSync(this.logFilePath, fullLogEntry, 'utf8');
      
      // Also log to console for immediate feedback
      console.log(logEntry);
      if (data) {
        console.log(JSON.stringify(data, null, 2));
      }
      
    } catch (error) {
      console.error(`[SPORT-SETTLE] Failed to write to log file: ${error}`);
      // Fallback to console logging
      console.log(`[${new Date().toISOString()}] [${level}] [SPORT-SETTLE] ${message}`);
      if (data) {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  }

  private logInfo(message: string, data?: any): void {
    this.writeToLogFile('INFO', message, data);
  }

  private logError(message: string, data?: any): void {
    this.writeToLogFile('ERROR', message, data);
  }

  private logWarn(message: string, data?: any): void {
    this.writeToLogFile('WARN', message, data);
  }

  private logDebug(message: string, data?: any): void {
    this.writeToLogFile('DEBUG', message, data);
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
    this.logInfo(`Starting batch settlement for ${eventIds.length} events`, { eventIds });
    
    let settledCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    try {
      // Check database connection
      if (!this.dataSource.isInitialized) {
        this.logError("Database not initialized");
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

      this.logInfo(`Found ${pendingBets.length} pending bets across ${eventIds.length} events`, {
        totalBets: pendingBets.length,
        totalEvents: eventIds.length,
        eventIds: eventIds
      });

      if (pendingBets.length === 0) {
        this.logInfo(`No pending bets found for any of the ${eventIds.length} events`);
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

      this.logInfo(`Grouped bets by event`, {
        eventsWithBets: betsByEvent.size,
        betsPerEvent: Array.from(betsByEvent.entries()).map(([eventId, bets]) => ({
          eventId,
          betCount: bets.length
        }))
      });

      // STEP 2: Process each event with pending bets
      for (const [eventId, bets] of betsByEvent) {
        try {
          this.logInfo(`Processing event ${eventId} with ${bets.length} pending bets`);
          const result = await this.settleSportMatch(eventId, bets);
          settledCount += result.settledCount;
          errorCount += result.errorCount;
          errors.push(...result.errors);
          
          this.logInfo(`Event ${eventId} settlement completed`, {
            eventId,
            settledCount: result.settledCount,
            errorCount: result.errorCount,
            errors: result.errors
          });
        } catch (error: any) {
          this.logError(`Error settling event ${eventId}`, { eventId, error: error.message, stack: error.stack });
          errorCount++;
          errors.push({ eventId, error: error.message });
        }
      }

      this.logInfo(`Batch settlement completed`, {
        totalSettled: settledCount,
        totalErrors: errorCount,
        totalEvents: eventIds.length,
        errors: errors
      });
      
      return { settledCount, errorCount, errors };

    } catch (error: any) {
      this.logError("Batch settlement error", { error: error.message, stack: error.stack });
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
   * 
   * COMPLETE API SCENARIO FLOW:
   * ==========================
   * 
   * For marketType = "MATCH_ODDS" or "BOOKMAKER":
   * 1. API SELECTION: Diamond API first, Fancy API fallback
   * 2. DIAMOND API CALL: /api/v2/diamondResults?eventId=652266196
   * 3. FALLBACK: If Diamond fails → Try Fancy API
   * 4. RESULT: Single object with final_result, market_name, event_id
   * 
   * For marketType = "Period Winner" (or any other):
   * 1. API SELECTION: Fancy API ONLY (no fallback)
   * 2. FANCY API CALL: /api/new/fancyResultData?eventId=745429556
   * 3. NO FALLBACK: If Fancy fails → Return null (bets remain pending)
   * 4. RESULT: Array with winner, sid, selection_id
   * 
   * IMPORTANT: For non-MATCH_ODDS/BOOKMAKER markets, we ONLY call Fancy API.
   * No Diamond API fallback to avoid unnecessary API calls and ensure
   * consistent data source for these market types.
   * 
   * Strategy: 
   * - MATCH_ODDS and BOOKMAKER → Try Diamond API first, then Fancy API as fallback
   * - All other market types → Try Fancy API ONLY (no fallback)
   * - Handle connection errors gracefully with proper fallback
   * - Proper error handling for third-party API failures
   */
  private async fetchResultFromAPI(eventId: string, marketType?: string): Promise<any> {
    try {
      // Determine which API to try first based on market type
      const isMatchOdds = marketType === "MATCH_ODDS" || marketType === "BOOKMAKER";
      
      if (isMatchOdds) {
        // MATCH_ODDS/BOOKMAKER: Diamond API first, Fancy API fallback
        this.logInfo(`MATCH_ODDS/BOOKMAKER: Trying Diamond API first for event ${eventId}`, { eventId, marketType });
        
        // Try Diamond API first
        let result = await this.tryAPI(eventId, "diamond", marketType);
        
        if (result) {
          this.logInfo(`MATCH_ODDS/BOOKMAKER: Diamond API succeeded for event ${eventId}`, { eventId, apiUsed: result.apiUsed });
          return result;
        }
        
        // If Diamond API failed, try Fancy API as fallback
        this.logWarn(`MATCH_ODDS/BOOKMAKER: Diamond API failed for event ${eventId}, trying Fancy API fallback`, { eventId, marketType });
        result = await this.tryAPI(eventId, "fancy", marketType);
        
        if (result) {
          this.logInfo(`MATCH_ODDS/BOOKMAKER: Fancy API fallback succeeded for event ${eventId}`, { eventId, apiUsed: result.apiUsed });
          return result;
        }
        
        // Both APIs failed
        this.logError(`MATCH_ODDS/BOOKMAKER: Both Diamond and Fancy APIs failed for event ${eventId} - bet will remain pending`, { eventId, marketType });
        return null;
        
      } else {
        // OTHER MARKET TYPES: Fancy API ONLY (no fallback)
        this.logInfo(`OTHER MARKETS: Trying Fancy API ONLY for event ${eventId}, market type: ${marketType}`, { eventId, marketType });
        
        let result = await this.tryAPI(eventId, "fancy", marketType);
        
        if (result) {
          this.logInfo(`OTHER MARKETS: Fancy API succeeded for event ${eventId}`, { eventId, apiUsed: result.apiUsed });
          return result;
        }
        
        // Fancy API failed - no fallback for other market types
        this.logError(`OTHER MARKETS: Fancy API failed for event ${eventId}, market type ${marketType} - bet will remain pending (no fallback)`, { eventId, marketType });
        return null;
      }

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
   * 
   * FANCY API CALL DETAILS:
   * ======================
   * 
   * When apiType = "fancy":
   * 
   * 1. API REQUEST:
   *    - URL: ${process.env.THIRD_PARTY_URL}/api/new/fancyResultData?eventId=745429556
   *    - Method: GET
   *    - Timeout: 10 seconds
   *    - Headers: Accept: application/json, User-Agent: GameStake-Server/1.0
   * 
   * 2. EXPECTED RESPONSE FORMAT:
   *    {
   *      "success": true,
   *      "data": [
   *        {
   *          "market_id": "745429556",
   *          "sid": 523711,
   *          "winner": 523711,
   *          "selection_id": 523711,
   *          "value": "1-0",
   *          "status": "finished"
   *        }
   *      ]
   *    }
   * 
   * 3. RESPONSE VALIDATION:
   *    - Check: response.data.success !== false
   *    - Check: response.data.data exists and not empty array
   *    - Extract: responseData = response.data.data || response.data
   * 
   * 4. RETURN FORMAT:
   *    {
   *      "data": responseData,        // The actual result data
   *      "apiUsed": "fancy",         // Which API was used
   *      "marketType": "Period Winner" // Market type for logging
   *    }
   * 
   * 5. ERROR HANDLING:
   *    - Network errors: timeout, connection refused
   *    - HTTP errors: 404, 500, etc.
   *    - Invalid responses: success: false, empty data
   *    - All errors logged with detailed context
   */
  private async tryAPI(eventId: string, apiType: "diamond" | "fancy", marketType?: string): Promise<any> {
    try {
      let response;
      let apiUsed = apiType;
      
      if (apiType === "diamond") {
        this.logInfo(`Trying Diamond API for event ${eventId}, market type: ${marketType}`, { eventId, marketType, apiType });
        const diamondUrl = `${process.env.THIRD_PARTY_URL}/api/v2/diamondResults?eventId=${eventId}`;
        this.logDebug(`Diamond API URL: ${diamondUrl}`, { url: diamondUrl });
        
        try {
          response = await axios.get(diamondUrl, { 
            timeout: 10000,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'GameStake-Server/1.0'
            }
          });
          this.logInfo(`Diamond API response received`, { 
            eventId, 
            status: response.status, 
            dataLength: Array.isArray(response.data) ? response.data.length : 'single object',
            hasData: !!response.data
          });
        } catch (err: any) {
          this.logError(`Diamond API failed for event ${eventId}`, {
            eventId,
            marketType,
            error: {
              message: err.message,
              code: err.code,
              status: err.response?.status,
              statusText: err.response?.statusText
            }
          });
          return null;
        }
      } else {
        this.logInfo(`Trying Fancy API for event ${eventId}, market type: ${marketType}`, { eventId, marketType, apiType });
        const fancyUrl = `${process.env.THIRD_PARTY_URL}/api/new/fancyResultData?eventId=${eventId}`;
        this.logDebug(`Fancy API URL: ${fancyUrl}`, { url: fancyUrl });
        
        try {
          response = await axios.get(fancyUrl, { 
            timeout: 10000,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'GameStake-Server/1.0'
            }
          });
          this.logInfo(`Fancy API response received`, { 
            eventId, 
            status: response.status, 
            dataLength: Array.isArray(response.data) ? response.data.length : 'single object',
            hasData: !!response.data
          });
        } catch (err: any) {
          this.logError(`Fancy API failed for event ${eventId}`, {
            eventId,
            marketType,
            error: {
              message: err.message,
              code: err.code,
              status: err.response?.status,
              statusText: err.response?.statusText
            }
          });
          return null;
        }
      }

      this.logDebug(`${apiUsed.toUpperCase()} API response data`, { eventId, responseData: response.data });

      // Process response data with better validation
      if (response.data) {
        // Check if response indicates success
        if (response.data.success === false) {
          this.logWarn(`${apiUsed.toUpperCase()} API returned success: false for event ${eventId}`, { eventId, apiUsed });
          return null;
        }
        
        // Check if response has actual data
        const responseData = response.data.data || response.data;
        if (!responseData || (Array.isArray(responseData) && responseData.length === 0)) {
          this.logWarn(`${apiUsed.toUpperCase()} API returned empty data for event ${eventId}`, { eventId, apiUsed });
          return null;
        }
        
        this.logInfo(`${apiUsed.toUpperCase()} API data validation successful`, { 
          eventId, 
          apiUsed, 
          dataType: Array.isArray(responseData) ? 'array' : 'object',
          dataLength: Array.isArray(responseData) ? responseData.length : 1
        });
        
        return {
          data: responseData,
          apiUsed: apiUsed,
          marketType: marketType
        };
      }

      this.logWarn(`${apiUsed.toUpperCase()} API returned null/undefined data for event ${eventId}`, { eventId, apiUsed });
      return null;

    } catch (error: any) {
      this.logError(`Unexpected API fetch error for event ${eventId}`, { eventId, error: error.message, stack: error.stack });
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
              this.logInfo(`Bet ${bet.id} WON`, {
                betId: bet.id,
                userId: userId,
                stake: stakeAmount,
                rate: betRate,
                profit: profitLoss,
                newBalance: (user as any).balance,
                marketType: marketType,
                marketName: betData.marketName
              });
            } else {
              finalStatus = "lost";
              // Loss is the stake amount
              profitLoss = -stakeAmount;
              (user as any).balance = Number((user as any).balance) + profitLoss; // Add negative = subtract
              this.logInfo(`Bet ${bet.id} LOST`, {
                betId: bet.id,
                userId: userId,
                stake: stakeAmount,
                loss: profitLoss,
                newBalance: (user as any).balance,
                marketType: marketType,
                marketName: betData.marketName
              });
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
   * Logic: Compare bet selection with actual result based on market type
   * Strategy: Different logic for MATCH_ODDS/BOOKMAKER vs other market types
   * Improved: Better error handling and logging
   * 
   * COMPLETE WINNER DETERMINATION SCENARIOS:
   * ======================================
   * 
   * SCENARIO 1: MATCH_ODDS/BOOKMAKER (Diamond API response):
   * ======================================================
   * 
   * Input Data:
   * - betData.marketType: "MATCH_ODDS"
   * - betData.marketName: "Essex W(Essex W v The Blaze W)"
   * - betData.eventId: "652266196"
   * - betData.selectionId: 0
   * - resultData: { final_result: "The Blaze W", market_name: "Essex W(...)", ... }
   * 
   * Winner Determination:
   * - Match by: market_name, event_id, market_type
   * - Compare: bet.marketName with result.market_name
   * - Compare: bet.eventId with result.event_id
   * - Winner: result.final_result (e.g., "The Blaze W")
   * - Logic: If bet is on "Essex W" but winner is "The Blaze W" → LOSE
   * 
   * SCENARIO 2: OTHER MARKET TYPES (Fancy API response):
   * ==================================================
   * 
   * Input Data:
   * - betData.marketType: "Period Winner"
   * - betData.sid: 523711 (Cerezo Osaka W)
   * - betData.marketId: "745429556"
   * - resultData: [Fancy API response array]
   * 
   * Winner Determination:
   * - Match by: market_id, sid, selection_id
   * - Compare: bet.sid with result.winner/sid/selection_id
   * - Uses DEFAULT logic for SID comparison
   * 
   * EXAMPLE MATCH_ODDS SCENARIO:
   * - Bet: Essex W (selection_id: 0)
   * - Result: final_result = "The Blaze W"
   * - Match: Essex W ≠ The Blaze W → LOSE ❌
   * - Stake: 100, Rate: 2.5
   * - Loss: 100 (stake amount)
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
          // For MATCH_ODDS/BOOKMAKER, use market_name and final_result matching
          return this.checkMatchOddsResult(betData, matchingResult);
        
        case "OVER_UNDER":
          return this.checkOverUnderResult(betData, matchingResult);
        
        case "HANDICAP":
          return this.checkHandicapResult(betData, matchingResult);
        
        default:
          // Default logic: check if bet sid matches winner (for Fancy API)
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
   * Strategy: Different matching logic for MATCH_ODDS/BOOKMAKER vs other market types
   * 
   * COMPLETE RESULT MATCHING SCENARIOS:
   * ==================================
   * 
   * SCENARIO 1: MATCH_ODDS/BOOKMAKER (Diamond API response):
   * ======================================================
   * 
   * Input Data:
   * - betData.marketType: "MATCH_ODDS"
   * - betData.marketName: "Essex W(Essex W v The Blaze W)"
   * - betData.eventId: "652266196"
   * - resultData: { market_name: "Essex W(...)", event_id: "652266196", final_result: "The Blaze W" }
   * 
   * Matching Logic:
   * - Primary match: result.market_name === bet.marketName
   * - Secondary match: result.event_id === bet.eventId
   * - Return: Single result object (not array)
   * 
   * SCENARIO 2: OTHER MARKET TYPES (Fancy API response):
   * ==================================================
   * 
   * Input Data:
   * - betData.marketType: "Period Winner"
   * - betData.sid: 523711 (Cerezo Osaka W)
   * - betData.marketId: "745429556"
   * - resultData: [Fancy API response array]
   * 
   * Matching Logic:
   * - Primary match: item.market_id === betMarketId ("745429556")
   * - Secondary match: item.sid === betSid (523711)
   * - Tertiary match: item.selection_id === betSid (523711)
   * - Return: Matching item from array
   * 
   * EXAMPLE MATCH_ODDS MATCH:
   * - Bet: { marketName: "Essex W(...)", eventId: "652266196" }
   * - Result: { market_name: "Essex W(...)", event_id: "652266196", final_result: "The Blaze W" }
   * - Match: market_name === marketName AND event_id === eventId → MATCH ✅
   * - Return: The matching result object
   */
  private findMatchingResult(resultData: any, betData: any): any {
    try {
      const betSid = betData.sid;
      const betMarketId = betData.marketId;
      const betMarketName = betData.marketName;
      const betEventId = betData.eventId || betData.marketId;
      const betMarketType = betData.marketType;

      console.log(`[SPORT-SETTLE] Finding matching result for bet:`, {
        sid: betSid,
        marketId: betMarketId,
        marketName: betMarketName,
        eventId: betEventId,
        marketType: betMarketType
      });
      console.log(`[SPORT-SETTLE] Result data structure:`, typeof resultData, Array.isArray(resultData) ? `Array[${resultData.length}]` : 'Object');

      // Handle MATCH_ODDS/BOOKMAKER (Diamond API response - single object)
      if (betMarketType === "MATCH_ODDS" || betMarketType === "BOOKMAKER") {
        console.log(`[SPORT-SETTLE] MATCH_ODDS/BOOKMAKER: Checking single result object`);
        
        if (resultData && typeof resultData === 'object') {
          console.log(`[SPORT-SETTLE] MATCH_ODDS: Result object:`, {
            market_name: resultData.market_name,
            event_id: resultData.event_id,
            final_result: resultData.final_result
          });

          // Match by market_name and event_id
          if (resultData.market_name === betMarketName && resultData.event_id === betEventId) {
            console.log(`[SPORT-SETTLE] MATCH_ODDS: Found matching result by market_name and event_id`);
            return resultData;
          }
        }
        
        console.log(`[SPORT-SETTLE] MATCH_ODDS: No matching result found`);
        return null;
      }

      // Handle other market types (Fancy API response - array)
      if (Array.isArray(resultData)) {
        console.log(`[SPORT-SETTLE] OTHER MARKETS: Searching in array of ${resultData.length} results`);
        
        for (let i = 0; i < resultData.length; i++) {
          const item = resultData[i];
          console.log(`[SPORT-SETTLE] OTHER MARKETS: Checking item ${i}:`, {
            market_id: item.market_id,
            sid: item.sid,
            selection_id: item.selection_id,
            winner: item.winner,
            fancyName: item.fancyName,
            fancyType: item.fancyType,
            decisionRun: item.decisionRun
          });

          // CRITICAL: Match by market_id AND ensure same market type
          // Don't match OVER_UNDER results with Period Winner bets!
          const isSameMarketType = this.isSameMarketType(betMarketType, item);
          
          if (isSameMarketType && (
              item.market_id === betMarketId || 
              item.sid === betSid || 
              item.selection_id === betSid ||
              String(item.market_id) === String(betMarketId) ||
              String(item.sid) === String(betSid) ||
              String(item.selection_id) === String(betSid))) {
            console.log(`[SPORT-SETTLE] OTHER MARKETS: Found matching result in array at index ${i} with same market type`);
            return item;
          } else if (!isSameMarketType) {
            console.log(`[SPORT-SETTLE] OTHER MARKETS: Skipping item ${i} - different market type (${item.fancyName || item.fancyType} vs ${betMarketType})`);
          }
        }
        
        console.log(`[SPORT-SETTLE] OTHER MARKETS: No matching result found in array with same market type`);
        return null;
      }

      // If resultData is an object for non-MATCH_ODDS (fallback)
      if (resultData && typeof resultData === 'object') {
        console.log(`[SPORT-SETTLE] OTHER MARKETS: Checking single result object:`, {
          market_id: resultData.market_id,
          sid: resultData.sid,
          selection_id: resultData.selection_id,
          winner: resultData.winner,
          fancyName: resultData.fancyName,
          fancyType: resultData.fancyType,
          decisionRun: resultData.decisionRun
        });

        // CRITICAL: Match by market_id AND ensure same market type
        const isSameMarketType = this.isSameMarketType(betMarketType, resultData);
        
        if (isSameMarketType && (
            resultData.market_id === betMarketId || 
            resultData.sid === betSid || 
            resultData.selection_id === betSid ||
            String(resultData.market_id) === String(betMarketId) ||
            String(resultData.sid) === String(betSid) ||
            String(resultData.selection_id) === String(betSid))) {
          console.log(`[SPORT-SETTLE] OTHER MARKETS: Found matching single result object with same market type`);
          return resultData;
        } else if (!isSameMarketType) {
          console.log(`[SPORT-SETTLE] OTHER MARKETS: Single result object has different market type (${resultData.fancyName || resultData.fancyType} vs ${betMarketType})`);
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
   * IS SAME MARKET TYPE
   * 
   * Purpose: Validate that bet market type matches result market type
   * Critical: Prevents matching OVER_UNDER results with Period Winner bets
   * 
   * MARKET TYPE VALIDATION:
   * ======================
   * 
   * Bet Market Type: "Period Winner"
   * Result Data: { fancyName: "OVER_UNDER_05", fancyType: "api" }
   * 
   * Validation Logic:
   * 1. Check if result.fancyName contains market type keywords
   * 2. Check if result.fancyType matches expected type
   * 3. Check if result.decisionRun matches market type
   * 
   * Examples:
   * - Period Winner bet + OVER_UNDER result → FALSE ❌
   * - Period Winner bet + Period Winner result → TRUE ✅
   * - OVER_UNDER bet + OVER_UNDER result → TRUE ✅
   */
  private isSameMarketType(betMarketType: string, resultItem: any): boolean {
    try {
      const fancyName = resultItem.fancyName || "";
      const fancyType = resultItem.fancyType || "";
      const decisionRun = resultItem.decisionRun || "";

      console.log(`[SPORT-SETTLE] Market type validation:`, {
        betMarketType,
        fancyName,
        fancyType,
        decisionRun
      });

      // Period Winner validation
      if (betMarketType === "Period Winner") {
        // Should NOT match OVER_UNDER results
        if (fancyName.includes("OVER_UNDER") || fancyName.includes("UNDER_OVER")) {
          console.log(`[SPORT-SETTLE] Period Winner bet cannot match OVER_UNDER result: ${fancyName}`);
          return false;
        }
        
        // Should match Period Winner results
        if (fancyName.includes("PERIOD_WINNER") || 
            fancyName.includes("Period Winner") ||
            decisionRun.includes("Period Winner") ||
            decisionRun.includes("Winner")) {
          console.log(`[SPORT-SETTLE] Period Winner bet matches Period Winner result`);
          return true;
        }
        
        // Default: allow if no conflicting market type indicators
        console.log(`[SPORT-SETTLE] Period Winner bet - no conflicting indicators, allowing match`);
        return true;
      }

      // OVER_UNDER validation
      if (betMarketType === "OVER_UNDER") {
        return fancyName.includes("OVER_UNDER") || fancyName.includes("UNDER_OVER");
      }

      // HANDICAP validation
      if (betMarketType === "HANDICAP") {
        return fancyName.includes("HANDICAP") || decisionRun.includes("Handicap");
      }

      // Default: allow match for other market types
      console.log(`[SPORT-SETTLE] Unknown market type ${betMarketType}, allowing match`);
      return true;

    } catch (error: any) {
      console.error("[SPORT-SETTLE] Error validating market type:", error);
      return false; // Fail safe: don't match if validation fails
    }
  }

  /**
   * CHECK MATCH ODDS RESULT
   * 
   * Purpose: Determine winner for MATCH_ODDS/BOOKMAKER bets
   * Logic: Match by market_name, event_id, and compare final_result with bet selection
   * 
   * MATCH_ODDS/BOOKMAKER WINNER DETERMINATION:
   * ========================================
   * 
   * Input Data:
   * - betData.marketName: "Essex W(Essex W v The Blaze W)"
   * - betData.eventId: "652266196"
   * - betData.marketType: "MATCH_ODDS"
   * - betData.selectionId: 0
   * - result.final_result: "The Blaze W"
   * - result.market_name: "Essex W(Essex W v The Blaze W)"
   * - result.event_id: "652266196"
   * 
   * Matching Logic:
   * 1. Match by market_name: bet.marketName === result.market_name
   * 2. Match by event_id: bet.eventId === result.event_id
   * 3. Compare winner: Extract team name from bet.marketName
   * 4. Compare with result.final_result
   * 
   * Example:
   * - Bet: Essex W (from market_name "Essex W(Essex W v The Blaze W)")
   * - Result: final_result = "The Blaze W"
   * - Match: Essex W ≠ The Blaze W → LOSE ❌
   */
  private checkMatchOddsResult(betData: any, result: any): boolean {
    try {
      const betMarketName = betData.marketName || "";
      const betEventId = betData.eventId || betData.marketId;
      const resultMarketName = result.market_name || "";
      const resultEventId = result.event_id || "";
      const finalResult = result.final_result || "";

      console.log(`[SPORT-SETTLE] MATCH_ODDS: Checking bet market "${betMarketName}" vs result market "${resultMarketName}"`);
      console.log(`[SPORT-SETTLE] MATCH_ODDS: Bet event "${betEventId}" vs result event "${resultEventId}"`);
      console.log(`[SPORT-SETTLE] MATCH_ODDS: Final result is "${finalResult}"`);

      // Match by market_name and event_id
      if (betMarketName !== resultMarketName || betEventId !== resultEventId) {
        console.log(`[SPORT-SETTLE] MATCH_ODDS: No match found for market/event`);
        return false;
      }

      // Extract team name from market_name (e.g., "Essex W" from "Essex W(Essex W v The Blaze W)")
      const teamName = betMarketName.split('(')[0].trim();
      
      console.log(`[SPORT-SETTLE] MATCH_ODDS: Bet team "${teamName}" vs winner "${finalResult}"`);

      // Compare team name with final result
      const isWinner = teamName === finalResult;
      
      console.log(`[SPORT-SETTLE] MATCH_ODDS: Is Winner: ${isWinner}`);
      return isWinner;

    } catch (error: any) {
      console.error("[SPORT-SETTLE] Error checking match odds result:", error);
      return false;
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

  /**
   * COMPLETE SETTLEMENT SCENARIOS EXAMPLE
   * 
   * Purpose: Demonstrate both MATCH_ODDS/BOOKMAKER and other market type flows
   * Shows exactly what happens for different market types
   * 
   * SCENARIO 1: MATCH_ODDS/BOOKMAKER (Diamond API):
   * ==============================================
   * 
   * Input Data:
   * - Event ID: "652266196"
   * - Event Name: "Essex W v The Blaze W"
   * - Market Type: "MATCH_ODDS"
   * - Market Name: "Essex W(Essex W v The Blaze W)"
   * - Selection ID: 0
   * - Category resultData: null (triggers API call)
   * 
   * Step-by-Step Flow:
   * 1. batchSettleMatches(["652266196"]) called
   * 2. Find pending bets for event "652266196"
   * 3. settleSportMatch("652266196", pendingBets) called
   * 4. Get SportMatch record for eventId
   * 5. Check categories - find "MATCH_ODDS" with resultData: null
   * 6. fetchResultFromAPI("652266196", "MATCH_ODDS") called
   * 7. API selection: isMatchOdds = true → Diamond API first
   * 8. tryAPI("652266196", "diamond", "MATCH_ODDS") called
   * 9. Make GET request to /api/v2/diamondResults?eventId=652266196
   * 10. Validate response: success !== false, data exists
   * 11. updateSportMatchCategoryResult() called
   * 12. Update category.resultData with Diamond API response
   * 13. settleUserBets(pendingBets, resultData) called
   * 14. Group bets by userId
   * 15. settleUserBetsForUser() called for each user
   * 16. determineBetWinner() called for each bet
   * 17. findMatchingResult() finds matching result by market_name/event_id
   * 18. checkMatchOddsResult() compares team name with final_result
   * 19. Calculate profit/loss: stake × (rate - 1) for wins
   * 20. Update user balance and exposure
   * 21. Mark bet as "won" or "lost" with detailed result data
   * 
   * Expected Diamond API Response:
   * {
   *   "id": 3254306,
   *   "event_id": "652266196",
   *   "event_name": "Essex W v The Blaze W",
   *   "market_id": "652266196",
   *   "market_name": "Essex W(Essex W v The Blaze W)",
   *   "market_type": "MATCH_ODDS",
   *   "final_result": "The Blaze W"
   * }
   * 
   * Settlement Result:
   * - Bet: Essex W (from market_name)
   * - Result Winner: "The Blaze W"
   * - Match: Essex W ≠ The Blaze W → LOSE ❌
   * - Stake: 100, Rate: 2.5
   * - Loss: 100 (stake amount)
   * - User Balance: oldBalance - 100
   * - User Exposure: oldExposure - 100
   * - Bet Status: "lost"
   * 
   * SCENARIO 2: OTHER MARKET TYPES (Fancy API):
   * ===========================================
   * 
   * Input Data:
   * - Event ID: "745429556"
   * - Event Name: "Cerezo Osaka W - NTV Beleza W"
   * - Market Type: "Period Winner"
   * - Category SID: 523711 (Cerezo Osaka W)
   * - Category resultData: null (triggers API call)
   * 
   * Step-by-Step Flow:
   * 1. batchSettleMatches(["745429556"]) called
   * 2. Find pending bets for event "745429556"
   * 3. settleSportMatch("745429556", pendingBets) called
   * 4. Get SportMatch record for eventId
   * 5. Check categories - find "Period Winner" with resultData: null
   * 6. fetchResultFromAPI("745429556", "Period Winner") called
   * 7. API selection: isMatchOdds = false → Fancy API first
   * 8. tryAPI("745429556", "fancy", "Period Winner") called
   * 9. Make GET request to /api/new/fancyResultData?eventId=745429556
   * 10. Validate response: success !== false, data exists
   * 11. updateSportMatchCategoryResult() called
   * 12. Update category.resultData with Fancy API response
   * 13. settleUserBets(pendingBets, resultData) called
   * 14. Group bets by userId
   * 15. settleUserBetsForUser() called for each user
   * 16. determineBetWinner() called for each bet
   * 17. findMatchingResult() finds matching result by market_id/sid
   * 18. Compare bet.sid (523711) with result.winner (523711)
   * 19. Calculate profit/loss: stake × (rate - 1) for wins
   * 20. Update user balance and exposure
   * 21. Mark bet as "won" or "lost" with detailed result data
   * 
   * Expected Fancy API Response:
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "market_id": "745429556",
   *       "sid": 523711,
   *       "winner": 523711,
   *       "selection_id": 523711,
   *       "value": "1-0",
   *       "status": "finished"
   *     }
   *   ]
   * }
   * 
   * Settlement Result:
   * - Bet SID: 523711 (Cerezo Osaka W)
   * - Result Winner: 523711 (Cerezo Osaka W)
   * - Match: 523711 === 523711 → WIN ✅
   * - Stake: 100, Rate: 2.5
   * - Profit: 100 × (2.5 - 1) = 150
   * - User Balance: oldBalance + 150
   * - User Exposure: oldExposure - 100
   * - Bet Status: "won"
   * 
   * CRITICAL FIX: MARKET TYPE VALIDATION:
   * ====================================
   * 
   * Problem: Period Winner bets were matching OVER_UNDER results
   * - Bet: { marketType: "Period Winner", sid: 61671, name: "Persela Lamongan" }
   * - Result: { fancyName: "OVER_UNDER_05", decisionRun: "Over 05 Goals" }
   * - Issue: Wrong market type matching caused incorrect settlement
   * 
   * Solution: Added isSameMarketType() validation
   * - Period Winner bets cannot match OVER_UNDER results
   * - Prevents cross-market type settlement errors
   * - Ensures bets remain pending until correct result is available
   */
  public getCompleteSettlementScenarios(): string {
    return `
COMPLETE SETTLEMENT SCENARIOS
=============================

SCENARIO 1: MATCH_ODDS/BOOKMAKER (Diamond API)
=============================================

1. ENTRY POINT:
   batchSettleMatches(["652266196"])

2. API SELECTION:
   marketType = "MATCH_ODDS" → Diamond API first

3. API CALL:
   GET /api/v2/diamondResults?eventId=652266196

4. RESULT UPDATE:
   category.resultData = Diamond API response

5. BET SETTLEMENT:
   - Find matching result by market_name/event_id
   - Compare team name with final_result
   - Calculate profit/loss
   - Update user balance/exposure
   - Mark bet as won/lost

6. EXAMPLE:
   Bet: Essex W (from market_name)
   Result: final_result = "The Blaze W"
   Match: Essex W ≠ The Blaze W → LOSE ❌

SCENARIO 2: OTHER MARKETS (Fancy API)
=====================================

1. ENTRY POINT:
   batchSettleMatches(["745429556"])

2. API SELECTION:
   marketType = "Period Winner" → Fancy API first

3. API CALL:
   GET /api/new/fancyResultData?eventId=745429556

4. RESULT UPDATE:
   category.resultData = Fancy API response

5. BET SETTLEMENT:
   - Find matching result by market_id/sid
   - Compare bet.sid with result.winner
   - Calculate profit/loss
   - Update user balance/exposure
   - Mark bet as won/lost

6. EXAMPLE:
   Bet SID: 523711 (Cerezo Osaka W)
   Result Winner: 523711 (Cerezo Osaka W)
   Match: WIN → Profit: 150
    `;
  }
}
