import { Request, Response } from "express";
import { AppDataSource } from "../../../server";
import { CasinoBet } from "../../../entities/casino/CasinoBet";
import { CasinoMatchNew } from "../../../entities/casino/CasinoMatchNew";
import { CASINO_TYPES } from "../../../Helpers/Request/Validation";
import { USER_TABLES } from "../../../Helpers/users/Roles";
import { AccountTrasaction } from "../../../entities/Transactions/AccountTransactions";
import { getRedisClient } from "../../../config/redisConfig";
import { Between, MoreThanOrEqual, LessThanOrEqual, In } from "typeorm";
// import { CasinoMatch } from "../../../entities/casino/CasinoMatch";
import axios from "axios";
import { settleCard32Result } from "./game/Card32";
import { settlePokerResult } from "./game/Poker";
import { settleDragonTiger } from "./game/DragonTiger6";
import { settleAbjResult } from "./game/AndarBahar2";
import { settleBaccaratResult } from "./game/Baccarat2";
import { settleDT202Result } from "./game/DragonTiger202";
import { settleTeen9Result } from "./game/Teen9";
import { settlePoker20Result } from "./game/Poker20";
import { settleAAAResult } from "./game/Aaa";
import { settleTeen8Result } from "./game/Teen8";
import { settleTeenMuflisResult } from "./game/Teenmuf";
import { settleCasinoWarResult } from "./game/War";
import { settleResultDT20 } from "./game/Dt20";
import { settleTeen20cResult } from "./game/Teen20c";
import { settleBollywoodCasino2Result } from "./game/Bollywoordcasino2";
import { settleJoker20Result } from "./game/Joker20";
import { settleJoker1Result } from "./game/Joker1";
import { settleGoalResult } from "./game/goal";
import { settleLucky5Result } from "./game/lucky5";
import { settleAB4Result } from "./game/ab4";
import { settleTeenResult } from "./game/Teen";
import { settlePoker6Result } from "./game/poker6";

export const settleUserCasinoBets = async (req: Request, res: Response) => {
  try {
    const { casinoType, mid } = req.body;
    const userId = req.user?.userId;

    // Validate input
    if (!casinoType || !mid) {
      return res.status(400).json({
        success: false,
        message: "casinoType and mid are required in the request body",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const casinoBetRepo = AppDataSource.getRepository(CasinoBet);
    const casinoMatchRepo = AppDataSource.getRepository(CasinoMatchNew);

    // First check casinoMatch table for existing result
    let casinoMatch = await casinoMatchRepo.findOne({
      where: { mid, casinoType },
    });

    let resultData = null;

    // If no casinoMatch record exists or result is null, fetch from API
    if (!casinoMatch || casinoMatch.result === null) {

      try {

        let response;
        try {
          // First attempt with roundresult_new
          response = await axios.get(
            `${process.env.THIRD_PARTY_URL}/exchange/casino/roundresult_new?roundId=${mid}&gtype=${casinoType}`,
            { timeout: 5000 }
          );

          console.log("******** roundresult_new ********");
          console.log(response.data);

          // If response is empty/null → fall back
          if (!response.data || Object.keys(response.data).length === 0) {
            console.log("Fallback to roundresult...");
            response = await axios.get(
              `${process.env.THIRD_PARTY_URL}/exchange/casino/roundresult?roundId=${mid}`,
              { timeout: 5000 }
            );
          }
        } catch (err) {
          // If first API fails → directly fall back
          try {
            response = await axios.get(
              `${process.env.THIRD_PARTY_URL}/exchange/casino/roundresult?roundId=${mid}`,
              { timeout: 5000 }
            );
          } catch (err2: any) {
            console.error("Both APIs failed:", err2.message);
            throw err2; 
          }
        }

        console.log(response.data, "response.data");
        if (response.data.error === false && response.data.data?.success) {
          const apiData = response.data.data;

          if (Array.isArray(apiData.data)) {
            resultData = apiData.data.find(
              (item: any) => String(item.mid) === String(mid)
            );
          } else if (apiData.data?.t1) {
            resultData = apiData.data.t1;
          }

          if (resultData) {
            try {
              if (casinoMatch) {
                casinoMatch.result = resultData;
                await casinoMatchRepo.save(casinoMatch);
              } else {
                casinoMatch = casinoMatchRepo.create({
                  mid,
                  casinoType,
                  result: resultData,
                });
                await casinoMatchRepo.save(casinoMatch);
              }
            } catch (saveError: any) {
              if (
                saveError.code === "23505" ||
                saveError.code === "SQLITE_CONSTRAINT_UNIQUE"
              ) {
                casinoMatch = await casinoMatchRepo.findOne({
                  where: { mid, casinoType },
                });

                if (
                  casinoMatch &&
                  (!casinoMatch.result || casinoMatch.result === null)
                ) {
                  casinoMatch.result = resultData;
                  await casinoMatchRepo.save(casinoMatch);
                }
              } else {
                throw saveError;
              }
            }
          }
        }
      } catch (apiError: any) {
        console.error(`[API] Error fetching result for mid ${mid}:`, apiError);
        if (!casinoMatch) {
          return res.status(500).json({
            success: false,
            message:
              "Failed to fetch result from external API and no existing record found",
            error: apiError.message,
          });
        }
        resultData = casinoMatch.result;
      }
    } else {
      resultData = casinoMatch.result;
    }

    if (!resultData) {
      return res.status(404).json({
        success: false,
        message: `No result data found for match ID ${mid}`,
      });
    }

    // Find pending bets for this user
    const pendingBets = await casinoBetRepo.find({
      where: {
        matchId: mid,
        userId: userId,
        status: "pending",
      },
    });

    if (pendingBets.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No pending bets found for this user and match",
        settledCount: 0,
        matchId: mid,
        casinoType: casinoType,
        userId: userId,
      });
    }

    // CASINO-SPECIFIC WINNER DETERMINATION
    const winners = determineWinners(casinoType, resultData);

    if (winners.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No winners could be determined for this casino type",
        resultData: resultData,
        casinoType: casinoType,
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
        const betSid: string = betData.sid;

        if (!betSid) {
          errors.push({ betId: bet.id, error: "No SID found" });
          continue;
        }

        await AppDataSource.transaction(async (transactionalEntityManager) => {
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

          // --- Lay / Back logic with correct profit/loss calculation ---
          let finalStatus: "won" | "lost" = "lost";
          let profitLoss = 0;

          if (betData.oddCategory === "Back") {
            // Back bet: Win if selected outcome happens
            finalStatus = isWinner ? "won" : "lost";
            if (isWinner) {
              profitLoss = Number(betData.profit) || 0;  // Positive for win
              user.balance = Number(user.balance) + profitLoss;
            } else {
              profitLoss = -(Number(betData.loss) || 0);  // Negative for loss
              user.balance = Number(user.balance) + profitLoss;  // Add negative = subtract
            }
          } else if (betData.oddCategory === "Lay") {
            // Lay bet: Win if selected outcome DOESN'T happen
            finalStatus = !isWinner ? "won" : "lost";
            if (!isWinner) {
              // Lay bet wins when selected outcome doesn't happen
              profitLoss = Number(betData.loss) || 0;  // Positive for win
              user.balance = Number(user.balance) + profitLoss;
            } else {
              // Lay bet loses when selected outcome happens
              profitLoss = -(Number(betData.profit) || 0);  // Negative for loss
              user.balance = Number(user.balance) + profitLoss;  // Add negative = subtract
            }
          }

          user.exposure = Number(user.exposure) - stakeAmount;

          await transactionalEntityManager.update(
            CasinoBet,
            { id: bet.id },
            {
              status: finalStatus,
              betData: {
                ...betData,
                result: {
                  winner: isWinner ? betSid : null,
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

          // Create account transaction record for settlement
          const accountTransactionRepo = transactionalEntityManager.getRepository(AccountTrasaction);
          const accountTransaction = accountTransactionRepo.create({
            uplineUserId: user.uplineId || userId, // Use uplineId if available, otherwise self
            downlineUserId: userId,
            remarks: `[CASINO-BET-SETTLED] ${casinoType} (Match: ${mid}) - ${finalStatus} - Stake: ${stakeAmount}, P/L: ${profitLoss}`,
            type: profitLoss > 0 ? "deposit" : "withdraw", // Use deposit for wins, withdraw for losses
            amount: Math.abs(profitLoss),
          });
          await accountTransactionRepo.save(accountTransaction);

          await transactionalEntityManager.save(user);
          settledCount++;
        });
      } catch (error: any) {
        errors.push({ betId: bet.id, error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Settlement completed for user ${userId} on match ${mid} (${casinoType})`,
      settledCount,
      errorCount: errors.length,
      matchId: mid,
      casinoType: casinoType,
      winners: winners,
      userId: userId,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Internal server error during settlement",
      error: error.message,
    });
  }
};

// CASINO-SPECIFIC WINNER DETERMINATION FUNCTIONS
function determineWinners(casinoType: string, resultData: any): string[] {
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

    // panga
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

    default:
      console.warn(`Unknown casino type: ${casinoType}`);
      return [];
  }
}

/**
 * REVERSE CASINO BET SETTLEMENT
 * 
 * Purpose: Allow upline users to reverse incorrect casino bet settlements
 * Access: Only upline users can reverse settlements for their downline
 * 
 * What it does:
 * - Reverts bet status from "won"/"lost" back to "pending"
 * - Restores user balance to pre-settlement state
 * - Restores user exposure
 * - Logs reversal for audit trail
 * - Validates upline-downline relationship
 */
export const reverseCasinoBetSettlement = async (req: Request, res: Response) => {
  try {
    const { betId, reason } = req.body;
    const userId = req.user?.id;
    const userType = req.user?.__type || req.user?.userType;

    if (!betId) {
      return res.status(400).json({
        success: false,
        message: "Bet ID is required"
      });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Reversal reason must be at least 10 characters"
      });
    }

    // Validate user type - only upline users can reverse
    const allowedUserTypes = ["admin", "superadmin", "techAdmin", "master", "supermaster", "agent", "superagent"];
    if (!allowedUserTypes.includes(userType)) {
      return res.status(403).json({
        success: false,
        message: "Only upline users can reverse settlements"
      });
    }

    // Get the bet to reverse
    const bet = await AppDataSource.getRepository(CasinoBet).findOne({
      where: { id: betId },
      relations: ["user"]
    });

    if (!bet) {
      return res.status(404).json({
        success: false,
        message: "Bet not found"
      });
    }

    // Check if bet is already settled
    if (bet.status === "pending") {
      return res.status(400).json({
        success: false,
        message: "Bet is already pending - nothing to reverse"
      });
    }

    // Validate upline-downline relationship
    const canReverse = await validateUplineDownlineRelationship(
      userId as string, 
      bet.userId as string, 
      userType as string
    );

    if (!canReverse) {
      return res.status(403).json({
        success: false,
        message: "You can only reverse settlements for your downline users"
      });
    }

    // Get user to restore balance
    const user = await AppDataSource.getRepository(USER_TABLES[bet.userType as any]).findOne({
      where: { id: bet.userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Calculate reversal amounts
    const betData = bet.betData || {};
    const result = betData.result || {};
    const stakeAmount = Number(betData.stake) || 0;
    const profitLoss = Number(result.profitLoss) || 0;

    // Reverse the settlement
    await AppDataSource.transaction(async (transactionalEntityManager: any) => {
      // Restore user balance
      user.balance = Number(user.balance) - profitLoss;
      user.exposure = Number(user.exposure) + stakeAmount;

      // Update bet status back to pending
      await transactionalEntityManager.update(
        CasinoBet,
        { id: betId },
        {
          status: "pending",
          betData: {
            ...betData,
            result: null, // Clear result data
            reversal: {
              reversedBy: userId,
              reversedAt: new Date(),
              reason: reason.trim(),
              originalResult: result,
              originalProfitLoss: profitLoss
            }
          }
        }
      );

      // Create account transaction record for reversal
      const accountTransactionRepo = transactionalEntityManager.getRepository(AccountTrasaction);
      const accountTransaction = accountTransactionRepo.create({
        uplineUserId: user.uplineId || userId, // Use uplineId if available, otherwise self
        downlineUserId: bet.userId,
        remarks: `[CASINO-BET-REVERSED] ${betData.gameSlug || 'Unknown'} (Match: ${bet.matchId}) - Reason: ${reason.trim()} - Original P/L: ${profitLoss}`,
        type: profitLoss > 0 ? "withdraw" : "deposit", // Reverse the original transaction type
        amount: Math.abs(profitLoss),
      });
      await accountTransactionRepo.save(accountTransaction);

      // Save user
      await transactionalEntityManager.save(user);

      // Log reversal for audit
      await transactionalEntityManager.save(CasinoBet, {
        id: `reversal_${betId}_${Date.now()}`,
        userId: bet.userId,
        userType: bet.userType,
        matchId: bet.matchId,
        status: "reversed",
        betData: {
          originalBetId: betId,
          reversalReason: reason.trim(),
          reversedBy: userId,
          reversedAt: new Date(),
          originalResult: result
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    return res.status(200).json({
      success: true,
      message: "Bet settlement reversed successfully",
      data: {
        betId,
        originalStatus: bet.status,
        newStatus: "pending",
        balanceRestored: profitLoss,
        exposureRestored: stakeAmount,
        reversalReason: reason.trim(),
        reversedBy: userId,
        reversedAt: new Date()
      }
    });

  } catch (error: any) {
    console.error("[SETTLE] Error reversing casino bet settlement:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reverse settlement",
      error: error.message
    });
  }
}

/**
 * VALIDATE UPLINE-DOWNLINE RELATIONSHIP
 * 
 * Purpose: Ensure only upline users can reverse settlements for their downline
 * 
 * Hierarchy:
 * - SuperAdmin > Admin > Master > SuperMaster > Agent > SuperAgent > Client
 * - Each level can only reverse settlements for users below them
 */
const validateUplineDownlineRelationship = async (
  uplineUserId: string,
  downlineUserId: string,
  uplineUserType: string
): Promise<boolean> => {
  try {
    // SuperAdmin, Admin, and TechAdmin can reverse any settlement
    if (["superadmin", "admin", "techAdmin"].includes(uplineUserType)) {
      return true;
    }

    // Get downline user info
    const downlineUser = await AppDataSource.getRepository(USER_TABLES[uplineUserType as any]).findOne({
      where: { id: downlineUserId }
    });

    if (!downlineUser) {
      return false;
    }

    // Check hierarchy relationships
    const hierarchy = {
      "techAdmin": ["master", "supermaster", "agent", "superagent", "client"],
      "master": ["supermaster", "agent", "superagent", "client"],
      "supermaster": ["agent", "superagent", "client"],
      "agent": ["superagent", "client"],
      "superagent": ["client"]
    };

    const allowedDownlineTypes = hierarchy[uplineUserType as keyof typeof hierarchy] || [];
    return allowedDownlineTypes.includes(downlineUser.userType);

  } catch (error: any) {
    console.error("[SETTLE] Error validating upline-downline relationship:", error);
    return false;
  }
}

/**
 * GET SETTLEMENT REVERSAL HISTORY
 * 
 * Purpose: Provide audit trail of all settlement reversals
 * Access: Only upline users can view reversal history
 */
export const getSettlementReversalHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.__type || req.user?.userType;
    const { page = 1, limit = 50, downlineUserId } = req.query;

    // Validate user type
    const allowedUserTypes = ["admin", "superadmin", "techAdmin", "master", "supermaster", "agent", "superagent"];
    if (!allowedUserTypes.includes(userType)) {
      return res.status(403).json({
        success: false,
        message: "Only upline users can view reversal history"
      });
    }

    // Build query conditions
    const whereConditions: any = {
      status: "reversed"
    };

    // If specific downline user requested, validate relationship
    if (downlineUserId) {
      const canView = await validateUplineDownlineRelationship(
        userId,
        downlineUserId as string,
        userType
      );

      if (!canView) {
        return res.status(403).json({
          success: false,
          message: "You can only view reversal history for your downline users"
        });
      }

      whereConditions.userId = downlineUserId;
    }

    // Get reversal history
    const [reversals, total] = await AppDataSource.getRepository(CasinoBet).findAndCount({
      where: whereConditions,
      order: { createdAt: "DESC" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });

    return res.status(200).json({
      success: true,
      data: {
        reversals: reversals.map((reversal: any) => ({
          id: reversal.id,
          originalBetId: reversal.betData?.originalBetId,
          userId: reversal.userId,
          userType: reversal.userType,
          matchId: reversal.matchId,
          reversalReason: reversal.betData?.reversalReason,
          reversedBy: reversal.betData?.reversedBy,
          reversedAt: reversal.betData?.reversedAt,
          originalResult: reversal.betData?.originalResult,
          createdAt: reversal.createdAt
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error: any) {
    console.error("[SETTLE] Error getting settlement reversal history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get reversal history",
      error: error.message
    });
  }
}

/**
 * GET SETTLED BETS OF DOWNLINE USERS
 * 
 * Purpose: Allow upline users to view settled bets of their downline users
 * Access: Only upline users can view downline settled bets
 * 
 * What it does:
 * - Fetches settled bets (won/lost) for downline users
 * - Validates upline-downline relationship
 * - Provides pagination and filtering options
 * - Shows settlement details and profit/loss information
 */
export const getDownlineSettledBets = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.__type || req.user?.userType;
    const { 
      page = 1, 
      limit = 50, 
      downlineUserId, 
      status, 
      casinoType, 
      startDate, 
      endDate,
      sortBy = "createdAt",
      sortOrder = "DESC"
    } = req.query;

    // Debug: Log user type for troubleshooting
    console.log("[SETTLE] User type received:", userType);
    console.log("[SETTLE] User ID:", userId);
    console.log("[SETTLE] Full req.user object:", JSON.stringify(req.user, null, 2));

    // Try different possible property names for user type
    const actualUserType = userType || req.user?.__type || req.user?.userType || req.user?.role || req.user?.type;
    console.log("[SETTLE] Actual user type resolved:", actualUserType);

    // Validate user type
    const allowedUserTypes = ["admin", "superadmin", "techAdmin", "master", "supermaster", "agent", "superagent"];
    if (!allowedUserTypes.includes(actualUserType)) {
      console.log("[SETTLE] User type not allowed:", actualUserType);
      return res.status(403).json({
        success: false,
        message: "Only upline users can view downline settled bets",
        debug: {
          userType: actualUserType,
          allowedTypes: allowedUserTypes,
          reqUserKeys: Object.keys(req.user || {}),
          originalUserType: userType
        }
      });
    }

    // Build query conditions
    const whereConditions: any = {
      status: status ? status : In(["won", "lost"]) // Default to settled bets only
    };

    // If specific downline user requested, validate relationship
    if (downlineUserId) {
      const canView = await validateUplineDownlineRelationship(
        userId as string,
        downlineUserId as string,
        actualUserType as string
      );

      if (!canView) {
        return res.status(403).json({
          success: false,
          message: "You can only view settled bets for your downline users"
        });
      }

      whereConditions.userId = downlineUserId;
    }

    console.log("[SETTLE] Query conditions:", whereConditions);

    // Debug: Check if there are ANY settled bets in the database
    const allBetsCount = await AppDataSource.getRepository(CasinoBet).count();
    const settledBetsCount = await AppDataSource.getRepository(CasinoBet).count({
      where: { status: In(["won", "lost"]) }
    });
    console.log("[SETTLE] Database stats:", {
      totalBets: allBetsCount,
      settledBets: settledBetsCount,
      userType: actualUserType,
      userId: userId
    });

    // Add date range filter
    if (startDate || endDate) {
      if (startDate && endDate) {
        whereConditions.createdAt = Between(new Date(startDate as string), new Date(endDate as string));
      } else if (startDate) {
        whereConditions.createdAt = MoreThanOrEqual(new Date(startDate as string));
      } else if (endDate) {
        whereConditions.createdAt = LessThanOrEqual(new Date(endDate as string));
      }
    }

    // Validate sort parameters
    const allowedSortFields = ["createdAt", "updatedAt", "betData.stake", "betData.profitLoss"];
    const sortField = allowedSortFields.includes(sortBy as string) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "ASC" ? "ASC" : "DESC";

    // Get settled bets with pagination
    const [allSettledBets, total] = await AppDataSource.getRepository(CasinoBet).findAndCount({
      where: whereConditions,
      order: { [sortField as string]: sortDirection }
    });

    console.log("[SETTLE] Raw query results:", {
      totalRawBets: total,
      whereConditions,
      sampleBet: allSettledBets[0] ? {
        id: allSettledBets[0].id,
        userId: allSettledBets[0].userId,
        userType: allSettledBets[0].userType,
        status: allSettledBets[0].status
      } : null
    });

    // Filter by casino type if specified (post-query filtering for JSON fields)
    let filteredBets = allSettledBets;
    if (casinoType) {
      filteredBets = allSettledBets.filter((bet: any) => {
        const betData = bet.betData || {};
        return betData.gameSlug === casinoType || betData.casinoType === casinoType;
      });
    }

    // Apply pagination after filtering
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const settledBets = filteredBets.slice(startIndex, endIndex);

    // Format response data
    const formattedBets = settledBets.map((bet: any) => {
      const betData = bet.betData || {};
      const result = betData.result || {};
      
      return {
        id: bet.id,
        userId: bet.userId,
        userType: bet.userType,
        matchId: bet.matchId,
        status: bet.status,
        stake: betData.stake || 0,
        profitLoss: result.profitLoss || 0,
        winner: result.winner || null,
        winnerNation: result.winnerNation || "",
        betName: betData.betName || "",
        gameName: betData.gameName || "",
        gameSlug: betData.gameSlug || "",
        casinoType: betData.casinoType || "",
        oddCategory: betData.oddCategory || "",
        betRate: betData.betRate || betData.matchOdd || 1,
        settledAt: result.settledAt || bet.updatedAt,
        createdAt: bet.createdAt,
        updatedAt: bet.updatedAt
      };
    });

    // Calculate summary statistics
    const totalStake = settledBets.reduce((sum: number, bet: any) => sum + (bet.betData?.stake || 0), 0);
    const totalProfitLoss = settledBets.reduce((sum: number, bet: any) => {
      const result = bet.betData?.result || {};
      return sum + (result.profitLoss || 0);
    }, 0);
    const wonBets = settledBets.filter((bet: any) => bet.status === "won").length;
    const lostBets = settledBets.filter((bet: any) => bet.status === "lost").length;

    return res.status(200).json({
      success: true,
      data: {
        bets: formattedBets,
        summary: {
          totalBets: settledBets.length,
          wonBets,
          lostBets,
          totalStake,
          totalProfitLoss,
          winRate: settledBets.length > 0 ? ((wonBets / settledBets.length) * 100).toFixed(2) : "0.00"
        },
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: filteredBets.length,
          pages: Math.ceil(filteredBets.length / Number(limit))
        },
        filters: {
          status: status || ["won", "lost"],
          casinoType: casinoType || "all",
          startDate: startDate || null,
          endDate: endDate || null,
          sortBy: sortField,
          sortOrder: sortDirection
        }
      }
    });

  } catch (error: any) {
    console.error("[SETTLE] Error getting downline settled bets:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get downline settled bets",
      error: error.message
    });
  }
}

/**
 * GET DOWNLINE USERS LIST
 * 
 * Purpose: Get list of downline users for the current upline user
 * Access: Only upline users can view their downline
 */
export const getDownlineUsers = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.__type || req.user?.userType;

    // Validate user type
    const allowedUserTypes = ["admin", "superadmin", "techAdmin", "master", "supermaster", "agent", "superagent"];
    if (!allowedUserTypes.includes(userType)) {
      return res.status(403).json({
        success: false,
        message: "Only upline users can view downline users"
      });
    }

    // Define hierarchy relationships
    const hierarchy = {
      "admin": ["superadmin", "techAdmin", "master", "supermaster", "agent", "superagent", "client"],
      "superadmin": ["techAdmin", "master", "supermaster", "agent", "superagent", "client"],
      "techAdmin": ["master", "supermaster", "agent", "superagent", "client"],
      "master": ["supermaster", "agent", "superagent", "client"],
      "supermaster": ["agent", "superagent", "client"],
      "agent": ["superagent", "client"],
      "superagent": ["client"]
    };

    const allowedDownlineTypes = hierarchy[userType as keyof typeof hierarchy] || [];
    
    if (allowedDownlineTypes.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          downlineUsers: [],
          total: 0
        }
      });
    }

    // Get downline users from all allowed user types
    const downlineUsers = [];
    
    for (const userTypeToQuery of allowedDownlineTypes) {
      try {
        const users = await AppDataSource.getRepository(USER_TABLES[userTypeToQuery as any]).find({
          select: ["id", "username", "name", "userType", "createdAt", "balance", "exposure"],
          order: { createdAt: "DESC" }
        });
        
        downlineUsers.push(...users.map((user: any) => ({
          id: user.id,
          username: user.username || user.name || "Unknown",
          userType: user.userType,
          balance: user.balance || 0,
          exposure: user.exposure || 0,
          createdAt: user.createdAt
        })));
      } catch (error: any) {
        console.error(`[SETTLE] Error fetching ${userTypeToQuery} users:`, error);
        // Continue with other user types
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        downlineUsers,
        total: downlineUsers.length,
        userTypes: allowedDownlineTypes
      }
    });

  } catch (error: any) {
    console.error("[SETTLE] Error getting downline users:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get downline users",
      error: error.message
    });
  }
}

/**
 * DEBUG: GET ALL SETTLED BETS (for testing purposes)
 * 
 * Purpose: Debug endpoint to see all settled bets without hierarchy restrictions
 * Access: Only upline users can access
 */
export const debugGetAllSettledBets = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.__type || req.user?.userType;

    // Validate user type
    const allowedUserTypes = ["admin", "superadmin", "techAdmin", "master", "supermaster", "agent", "superagent"];
    if (!allowedUserTypes.includes(userType)) {
      return res.status(403).json({
        success: false,
        message: "Only upline users can access debug endpoint"
      });
    }

    // Get ALL settled bets without any restrictions
    const allSettledBets = await AppDataSource.getRepository(CasinoBet).find({
      where: { status: In(["won", "lost"]) },
      order: { createdAt: "DESC" },
      take: 20 // Limit to 20 for debugging
    });

    // Get total counts
    const totalBets = await AppDataSource.getRepository(CasinoBet).count();
    const settledBetsCount = await AppDataSource.getRepository(CasinoBet).count({
      where: { status: In(["won", "lost"]) }
    });

    return res.status(200).json({
      success: true,
      data: {
        debug: {
          userType,
          userId,
          totalBetsInDatabase: totalBets,
          settledBetsInDatabase: settledBetsCount,
          sampleSettledBets: allSettledBets.map(bet => ({
            id: bet.id,
            userId: bet.userId,
            userType: bet.userType,
            status: bet.status,
            matchId: bet.matchId,
            createdAt: bet.createdAt,
            betData: bet.betData ? {
              gameSlug: bet.betData.gameSlug,
              casinoType: bet.betData.casinoType,
              stake: bet.betData.stake,
              betName: bet.betData.betName
            } : null
          }))
        }
      }
    });

  } catch (error: any) {
    console.error("[SETTLE] Error in debug endpoint:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get debug data",
      error: error.message
    });
  }
}
