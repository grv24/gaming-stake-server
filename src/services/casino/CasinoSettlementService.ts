import { DataSource, In } from "typeorm";
import { CasinoBet } from "../../entities/casino/CasinoBet";
import { CasinoMatchNew } from "../../entities/casino/CasinoMatchNew";
import { USER_TABLES } from "../../Helpers/users/Roles";
import axios from "axios";

// Import all settlement functions
import { settleCard32Result } from "../../controllers/casino/settlement/game/Card32";
import { settlePokerResult } from "../../controllers/casino/settlement/game/Poker";
import { settleDragonTiger } from "../../controllers/casino/settlement/game/DragonTiger6";
import { settleAbjResult } from "../../controllers/casino/settlement/game/AndarBahar2";
import { settleBaccaratResult } from "../../controllers/casino/settlement/game/Baccarat2";
import { settleDT202Result } from "../../controllers/casino/settlement/game/DragonTiger202";
import { settleTeen9Result } from "../../controllers/casino/settlement/game/Teen9";
import { settlePoker20Result } from "../../controllers/casino/settlement/game/Poker20";
import { settleAAAResult } from "../../controllers/casino/settlement/game/Aaa";
import { settleTeen8Result } from "../../controllers/casino/settlement/game/Teen8";
import { settleTeenMuflisResult } from "../../controllers/casino/settlement/game/Teenmuf";
import { settleCasinoWarResult } from "../../controllers/casino/settlement/game/War";
import { settleResultDT20 } from "../../controllers/casino/settlement/game/Dt20";
import { settleTeen20cResult } from "../../controllers/casino/settlement/game/Teen20c";
import { settleBollywoodCasino2Result } from "../../controllers/casino/settlement/game/Bollywoordcasino2";
import { settleJoker20Result } from "../../controllers/casino/settlement/game/Joker20";
import { settleJoker1Result } from "../../controllers/casino/settlement/game/Joker1";
import { settleGoalResult } from "../../controllers/casino/settlement/game/goal";
import { settleLucky5Result } from "../../controllers/casino/settlement/game/lucky5";
import { settleAB4Result } from "../../controllers/casino/settlement/game/ab4";
import { settleTeenResult } from "../../controllers/casino/settlement/game/Teen";
import { settlePoker6Result } from "../../controllers/casino/settlement/game/poker6";

/**
 * CASINO SETTLEMENT SERVICE
 * 
 * Purpose: Automatic settlement of casino bets using pub/sub pattern
 * 
 * Key Responsibilities:
 * - Monitors casino match completion via Redis pub/sub
 * - Automatically fetches result data from third-party API
 * - Updates casino_match_new table with result data
 * - Settles all pending bets for completed matches
 * - Provides batch settlement for performance
 * 
 * Performance Optimizations:
 * - Batch settlement operations
 * - Smart filtering to avoid duplicate settlements
 * - Efficient database transactions
 * - Parallel processing where possible
 * 
 * Data Flow:
 * Redis Pub/Sub → Match Completion Detection → API Result Fetch → Database Update → Bet Settlement
 */
export class CasinoSettlementService {
  private dataSource: DataSource;
  private casinoBetRepo: any;
  private casinoMatchRepo: any;

  /**
   * Initialize the settlement service with database connection
   * @param dataSource - TypeORM DataSource instance
   */
  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.casinoBetRepo = dataSource.getRepository(CasinoBet);
    this.casinoMatchRepo = dataSource.getRepository(CasinoMatchNew);
  }

  /**
   * SETTLE CASINO MATCH - Automatic Settlement
   * 
   * Purpose: Automatically settle all bets for a completed casino match
   * 
   * Process Flow:
   * 1. Check if there are pending bets for this match first
   * 2. Only fetch from third-party API if bets exist
   * 3. Update casino_match_new with result data
   * 4. Determine winners using casino-specific logic
   * 5. Settle all bets in batch transactions
   * 
   * @param casinoType - The casino game type
   * @param mid - The match ID to settle
   * @returns Promise with settlement statistics
   */
  async settleCasinoMatch(casinoType: string, mid: string): Promise<any> {
    try {
      console.log(`[CASINO_SETTLEMENT_SERVICE] Starting settlement for ${casinoType}:${mid}`);

      // FIRST: Check if there are any pending bets for this match
      const pendingBets = await this.casinoBetRepo.find({
        where: {
          matchId: mid,
          status: "pending",
        },
      });

      if (pendingBets.length === 0) {
        console.log(`[CASINO_SETTLEMENT_SERVICE] No pending bets found for ${mid} - skipping API fetch`);
        return {
          success: true,
          message: "No pending bets found for this match",
          settledCount: 0,
          matchId: mid,
          casinoType: casinoType,
        };
      }

      console.log(`[CASINO_SETTLEMENT_SERVICE] Found ${pendingBets.length} pending bets for ${mid} - proceeding with settlement`);

      // Check if match already has result data
      let casinoMatch = await this.casinoMatchRepo.findOne({
        where: { mid, casinoType },
      });

      let resultData = null;

      // Only fetch from third-party API if there are pending bets and no result data exists
      if (!casinoMatch || casinoMatch.result === null) {
        console.log(`[CASINO_SETTLEMENT_SERVICE] Fetching result data from API for ${mid} (bets exist)`);
        resultData = await this.fetchResultFromAPI(casinoType, mid);

        if (resultData) {
          // Update casino_match_new with result data
          if (casinoMatch) {
            casinoMatch.result = resultData;
            await this.casinoMatchRepo.save(casinoMatch);
          } else {
            casinoMatch = this.casinoMatchRepo.create({
              mid,
              casinoType,
              result: resultData,
            });
            await this.casinoMatchRepo.save(casinoMatch);
          }
          console.log(`[CASINO_SETTLEMENT_SERVICE] Updated casino_match_new with result data for ${mid}`);
        }
      } else {
        resultData = casinoMatch.result;
        console.log(`[CASINO_SETTLEMENT_SERVICE] Using existing result data for ${mid}`);
      }

      if (!resultData) {
        console.log(`[CASINO_SETTLEMENT_SERVICE] No result data available for ${mid}`);
        return {
          success: false,
          message: `No result data found for match ${mid}`,
          settledCount: 0,
        };
      }

      console.log(`[CASINO_SETTLEMENT_SERVICE] Found ${pendingBets.length} pending bets for ${mid}`);

      // Determine winners using casino-specific logic
      const winners = this.determineWinners(casinoType, resultData);

      if (winners.length === 0) {
        console.log(`[CASINO_SETTLEMENT_SERVICE] No winners determined for ${casinoType}`);
        return {
          success: false,
          message: "No winners could be determined for this casino type",
          resultData: resultData,
          casinoType: casinoType,
        };
      }

      console.log(`[CASINO_SETTLEMENT_SERVICE] Winners determined: ${winners.join(', ')}`);

      // Group bets by user for batch processing
      const betsByUser = this.groupBetsByUser(pendingBets);

      let totalSettledCount = 0;
      let totalErrors = [];

      // Process settlement for each user
      for (const [userId, userBets] of betsByUser) {
        try {
          const settlementResult = await this.settleUserBets(userId, userBets, winners, resultData);
          totalSettledCount += settlementResult.settledCount;
          totalErrors.push(...settlementResult.errors);
        } catch (error: any) {
          console.error(`[CASINO_SETTLEMENT_SERVICE] Error settling bets for user ${userId}:`, error);
          totalErrors.push({ userId, error: error.message });
        }
      }

      console.log(`[CASINO_SETTLEMENT_SERVICE] Settlement completed for ${mid}: ${totalSettledCount} bets settled`);

      return {
        success: true,
        message: `Settlement completed for match ${mid} (${casinoType})`,
        settledCount: totalSettledCount,
        errorCount: totalErrors.length,
        matchId: mid,
        casinoType: casinoType,
        winners: winners,
        errors: totalErrors.length > 0 ? totalErrors : undefined,
        timestamp: new Date().toISOString(),
      };

    } catch (error: any) {
      console.error(`[CASINO_SETTLEMENT_SERVICE] Error settling casino match ${mid}:`, error);
      throw error;
    }
  }

  /**
   * FETCH RESULT FROM API - Third-Party Integration
   * 
   * Purpose: Fetch casino result data from third-party API using roundresult_new endpoint
   * 
   * @param casinoType - The casino game type
   * @param mid - The match ID
   * @returns Promise with result data or null
   */
  private async fetchResultFromAPI(casinoType: string, mid: string): Promise<any> {
    try {
      // Use only roundresult_new endpoint as specified
      const response = await axios.get(
        `${process.env.THIRD_PARTY_URL}/exchange/casino/roundresult_new?roundId=${mid}&gtype=${casinoType}`,
        { timeout: 5000 }
      );

      console.log(`[CASINO_SETTLEMENT_SERVICE] API response (roundresult_new):`, response.data);

      if (response.data.error === false && response.data.data?.success) {
        const apiData = response.data.data;

        if (Array.isArray(apiData.data)) {
          return apiData.data.find(
            (item: any) => String(item.mid) === String(mid)
          );
        } else if (apiData.data?.t1) {
          return apiData.data.t1;
        }
      }

      return null;
    } catch (error: any) {
      console.error(`[CASINO_SETTLEMENT_SERVICE] Error fetching result from API for ${mid}:`, error);
      throw error;
    }
  }

  /**
   * GROUP BETS BY USER - Batch Processing Optimization
   * 
   * Purpose: Group pending bets by user for efficient batch processing
   * 
   * @param pendingBets - Array of pending bets
   * @returns Map of userId to bets array
   */
  private groupBetsByUser(pendingBets: any[]): Map<string, any[]> {
    const betsByUser = new Map<string, any[]>();

    for (const bet of pendingBets) {
      if (bet.betData?.result?.settled === true || bet.status !== "pending") {
        continue;
      }

      const userId = bet.userId;
      if (!betsByUser.has(userId)) {
        betsByUser.set(userId, []);
      }
      betsByUser.get(userId)!.push(bet);
    }

    return betsByUser;
  }

  /**
   * SETTLE USER BETS - Individual User Settlement
   * 
   * Purpose: Settle all bets for a specific user in a single transaction
   * 
   * @param userId - The user ID
   * @param userBets - Array of bets for the user
   * @param winners - Array of winning SIDs
   * @param resultData - The result data
   * @returns Promise with settlement results
   */
  private async settleUserBets(userId: string, userBets: any[], winners: string[], resultData: any): Promise<any> {
    let settledCount = 0;
    let errors = [];

    for (const bet of userBets) {
      try {
        const betData = bet.betData || {};
        const betSid: string = betData.sid;

        if (!betSid) {
          errors.push({ betId: bet.id, error: "No SID found" });
          continue;
        }

        await this.dataSource.transaction(async (transactionalEntityManager) => {
          const currentBet = await transactionalEntityManager.findOne(
            CasinoBet,
            {
              where: { id: bet.id, status: "pending", userId: userId },
              lock: { mode: "pessimistic_write" },
            }
          );

          if (!currentBet) return;

          const user: any = await transactionalEntityManager.findOne(
            USER_TABLES[bet.userType as any],
            {
              where: { id: userId },
              lock: { mode: "pessimistic_write" },
            }
          );

          if (!user) {
            errors.push({ betId: bet.id, error: "User not found" });
            return;
          }

          const stakeAmount = Number(betData.stake) || 0;
          const isWinner = winners.includes(betSid);

          // Lay / Back logic with correct profit/loss calculation
          let finalStatus: "won" | "lost" = "lost";
          let profitLoss = 0;

          if (betData.oddCategory === "Back") {
            // Back bet: Win if selected outcome happens
            finalStatus = isWinner ? "won" : "lost";
            if (isWinner) {
              profitLoss = Number(betData.profit) || 0;  // Positive for win
              user.balance = Number(user.balance) + profitLoss;
            } else {
              // For lost Back bet: user loses the stake amount
              profitLoss = -(Number(betData.stake) || 0);  // Negative for loss (stake amount)
              user.balance = Number(user.balance) + profitLoss;  // Add negative = subtract
            }
          } else if (betData.oddCategory === "Lay") {
            // Lay bet: Win if selected outcome DOESN'T happen
            finalStatus = !isWinner ? "won" : "lost";
            if (!isWinner) {
              // Lay bet wins when selected outcome doesn't happen
              profitLoss = Number(betData.stake) || 0;  // Positive for win (stake amount)
              user.balance = Number(user.balance) + profitLoss;
            } else {
              // Lay bet loses when selected outcome happens
              profitLoss = -(Number(betData.stake) || 0);  // Negative for loss (stake amount)
              user.balance = Number(user.balance) + profitLoss;  // Add negative = subtract
            }
          }

          // Determine the actual winner for display purposes
          const actualWinner = winners.length > 0 ? winners[0] : null;

          user.exposure = Number(user.exposure) - stakeAmount;

          await transactionalEntityManager.update(
            CasinoBet,
            { id: bet.id },
            {
              status: finalStatus,
              betData: {
                ...betData,
                result: {
                  winner: actualWinner,
                  winnerNation: betData.name || "",
                  settledAt: new Date(),
                  profitLoss: profitLoss,
                  stake: stakeAmount,
                  betRate: betData.betRate || betData.matchOdd || 1,
                  status: finalStatus,
                  settled: true,
                },
              },
            }
          );

          await transactionalEntityManager.save(user);
          settledCount++;
        });
      } catch (error: any) {
        errors.push({ betId: bet.id, error: error.message });
      }
    }

    return {
      settledCount,
      errors,
    };
  }

  /**
   * DETERMINE WINNERS - Casino-Specific Logic
   * 
   * Purpose: Determine winning SIDs based on casino type and result data
   * 
   * @param casinoType - The casino game type
   * @param resultData - The result data from API
   * @returns Array of winning SIDs
   */
  private determineWinners(casinoType: string, resultData: any): string[] {
    const winners = new Set<string>();

    switch (casinoType.toLowerCase()) {
      case "card32e":
      case "card32eu":
        return settleCard32Result(resultData);

      case "poker":
        return settlePokerResult(resultData);

      case "poker6":
        return settlePoker6Result(resultData);

      case "dt6":
        return settleDragonTiger(resultData);

      case "abj":
        return settleAbjResult(resultData);

      case "baccarat2":
        return settleBaccaratResult(resultData);

      case "teen20":
        return settleBaccaratResult(resultData);

      case "teen8":
        return settleTeen8Result(resultData);

      case "dt202":
        return settleDT202Result(resultData);

      case 'dt20':
        return settleResultDT20(resultData);

      case "teen9":
        return settleTeen9Result(resultData);

      case "poker20":
        return settlePoker20Result(resultData);

      case "aaa":
        return settleAAAResult(resultData);

      case "btable2":
        return settleAAAResult(resultData);

      case "lucky7eu":
        return settleTeen8Result(resultData);

      case "teenmuf":
        return settleTeenMuflisResult(resultData);

      case "war":
        return settleCasinoWarResult(resultData);

      case "teen20c":
        return settleTeen20cResult(resultData);

      case "bollywoodcasino2":
        return settleBollywoodCasino2Result(resultData);

      case "joker20":
        return settleJoker20Result(resultData);

      case "joker1":
        return settleJoker1Result(resultData);

      case "goal":
        return settleGoalResult(resultData);

      case "lucky5":
        return settleLucky5Result(resultData);

      case "ab4":
        return settleAB4Result(resultData);
      
      case "teen":
        return settleTeenResult(resultData);

      case "poison20":
        // Add poison20 settlement logic here when available
        console.warn(`[CASINO_SETTLEMENT_SERVICE] Settlement logic not implemented for ${casinoType}`);
        return [];

      default:
        console.warn(`[CASINO_SETTLEMENT_SERVICE] Unknown casino type: ${casinoType}`);
        return [];
    }
  }

  /**
   * BATCH SETTLE MATCHES - Ultra-Optimized Settlement
   * 
   * Purpose: Settle multiple casino matches with minimal database calls
   * 
   * Performance Optimizations:
   * - Single query to get all pending bets for all matches
   * - Single query to get all existing casino matches
   * - Batch API calls for result data
   * - Batch database operations
   * 
   * @param matches - Array of {casinoType, mid} objects
   * @returns Promise with batch settlement results
   */
  async batchSettleMatches(matches: Array<{casinoType: string, mid: string}>): Promise<any> {
    try {
      console.log(`[CASINO_SETTLEMENT_SERVICE] Starting ultra-optimized batch settlement for ${matches.length} matches`);

      if (matches.length === 0) {
        return {
          success: true,
          message: "No matches to settle",
          totalSettledCount: 0,
          totalErrors: 0,
          results: [],
          timestamp: new Date().toISOString(),
        };
      }

      // Extract all match IDs for batch queries
      const allMatchIds = matches.map(m => m.mid);
      
      // SINGLE QUERY: Get all pending bets for all matches at once
      const allPendingBets = await this.casinoBetRepo.find({
        where: {
          matchId: In(allMatchIds),
          status: "pending",
        },
      });

      console.log(`[CASINO_SETTLEMENT_SERVICE] Found ${allPendingBets.length} total pending bets across all matches`);

      // Group bets by match ID for efficient processing
      const betsByMatch = new Map<string, any[]>();
      for (const bet of allPendingBets) {
        if (!betsByMatch.has(bet.matchId)) {
          betsByMatch.set(bet.matchId, []);
        }
        betsByMatch.get(bet.matchId)!.push(bet);
      }

      // Filter matches that actually have pending bets
      const matchesWithBets = matches.filter(match => betsByMatch.has(match.mid));
      
      if (matchesWithBets.length === 0) {
        console.log(`[CASINO_SETTLEMENT_SERVICE] No matches have pending bets - skipping settlement`);
        return {
          success: true,
          message: "No matches have pending bets",
          totalSettledCount: 0,
          totalErrors: 0,
          results: [],
          timestamp: new Date().toISOString(),
        };
      }

      console.log(`[CASINO_SETTLEMENT_SERVICE] Processing ${matchesWithBets.length} matches with pending bets`);

      // SINGLE QUERY: Get all existing casino matches at once
      const existingMatches = await this.casinoMatchRepo.find({
        where: {
          mid: In(matchesWithBets.map(m => m.mid)),
        },
      });

      // Create lookup map for existing matches
      const existingMatchesMap = new Map();
      for (const match of existingMatches) {
        existingMatchesMap.set(`${match.mid}_${match.casinoType}`, match);
      }

      // Process matches that need API calls (no result data)
      const matchesNeedingAPI = matchesWithBets.filter(match => {
        const key = `${match.mid}_${match.casinoType}`;
        const existingMatch = existingMatchesMap.get(key);
        return !existingMatch || existingMatch.result === null;
      });

      console.log(`[CASINO_SETTLEMENT_SERVICE] ${matchesNeedingAPI.length} matches need API calls`);

      // Batch API calls for result data
      const apiResults = new Map<string, any>();
      if (matchesNeedingAPI.length > 0) {
        const apiPromises = matchesNeedingAPI.map(async (match) => {
          try {
            const resultData = await this.fetchResultFromAPI(match.casinoType, match.mid);
            if (resultData) {
              apiResults.set(`${match.mid}_${match.casinoType}`, resultData);
            }
          } catch (error) {
            console.error(`[CASINO_SETTLEMENT_SERVICE] API error for ${match.casinoType}:${match.mid}:`, error);
          }
        });

        await Promise.all(apiPromises);
        console.log(`[CASINO_SETTLEMENT_SERVICE] Completed ${apiResults.size} API calls`);
      }

      // Batch update casino_match_new with result data
      const matchesToUpdate = [];
      for (const match of matchesNeedingAPI) {
        const key = `${match.mid}_${match.casinoType}`;
        const resultData = apiResults.get(key);
        
        if (resultData) {
          const existingMatch = existingMatchesMap.get(key);
          if (existingMatch) {
            existingMatch.result = resultData;
            matchesToUpdate.push(existingMatch);
          } else {
            matchesToUpdate.push({
              mid: match.mid,
              casinoType: match.casinoType,
              result: resultData,
            });
          }
        }
      }

      if (matchesToUpdate.length > 0) {
        await this.casinoMatchRepo.save(matchesToUpdate);
        console.log(`[CASINO_SETTLEMENT_SERVICE] Updated ${matchesToUpdate.length} casino matches with result data`);
      }

      // Now settle all bets in optimized batches
      const results = [];
      let totalSettledCount = 0;
      let totalErrors = [];

      for (const match of matchesWithBets) {
        try {
          const key = `${match.mid}_${match.casinoType}`;
          const existingMatch = existingMatchesMap.get(key);
          const resultData = existingMatch?.result || apiResults.get(key);

          if (!resultData) {
            console.log(`[CASINO_SETTLEMENT_SERVICE] No result data for ${match.casinoType}:${match.mid}`);
            results.push({
              success: false,
              casinoType: match.casinoType,
              mid: match.mid,
              error: "No result data available",
            });
            continue;
          }

          const pendingBets = betsByMatch.get(match.mid) || [];
          const winners = this.determineWinners(match.casinoType, resultData);

          if (winners.length === 0) {
            console.log(`[CASINO_SETTLEMENT_SERVICE] No winners determined for ${match.casinoType}`);
            results.push({
              success: false,
              casinoType: match.casinoType,
              mid: match.mid,
              error: "No winners could be determined",
            });
            continue;
          }

          // Group bets by user for batch processing
          const betsByUser = this.groupBetsByUser(pendingBets);
          let settledCount = 0;
          let errors = [];

          // Process settlement for each user
          for (const [userId, userBets] of betsByUser) {
            try {
              const settlementResult = await this.settleUserBets(userId, userBets, winners, resultData);
              settledCount += settlementResult.settledCount;
              errors.push(...settlementResult.errors);
            } catch (error: any) {
              console.error(`[CASINO_SETTLEMENT_SERVICE] Error settling bets for user ${userId}:`, error);
              errors.push({ userId, error: error.message });
            }
          }

          results.push({
            success: true,
            casinoType: match.casinoType,
            mid: match.mid,
            settledCount,
            errorCount: errors.length,
            winners,
            errors: errors.length > 0 ? errors : undefined,
          });

          totalSettledCount += settledCount;
          totalErrors.push(...errors);

        } catch (error: any) {
          console.error(`[CASINO_SETTLEMENT_SERVICE] Error processing ${match.casinoType}:${match.mid}:`, error);
          results.push({
            success: false,
            casinoType: match.casinoType,
            mid: match.mid,
            error: error.message,
          });
          totalErrors.push({
            casinoType: match.casinoType,
            mid: match.mid,
            error: error.message,
          });
        }
      }

      console.log(`[CASINO_SETTLEMENT_SERVICE] Ultra-optimized batch settlement completed: ${totalSettledCount} total bets settled`);

      return {
        success: true,
        message: `Ultra-optimized batch settlement completed for ${matchesWithBets.length} matches`,
        totalSettledCount,
        totalErrors: totalErrors.length,
        results,
        errors: totalErrors.length > 0 ? totalErrors : undefined,
        timestamp: new Date().toISOString(),
      };

    } catch (error: any) {
      console.error(`[CASINO_SETTLEMENT_SERVICE] Error in ultra-optimized batch settlement:`, error);
      throw error;
    }
  }
}

// Export singleton instance
let casinoSettlementServiceInstance: CasinoSettlementService | null = null;

export const getCasinoSettlementService = (dataSource: DataSource): CasinoSettlementService => {
  if (!casinoSettlementServiceInstance) {
    casinoSettlementServiceInstance = new CasinoSettlementService(dataSource);
  }
  return casinoSettlementServiceInstance;
};
