import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { CasinoBet } from "../../entities/casino/CasinoBet";
import { CASINO_TYPES } from "../../Helpers/Request/Validation";
import { USER_TABLES } from "../../Helpers/users/Roles";
import { CronDataSource } from "../../corn.server";
import { getRedisClient } from "../../config/redisConfig";

export const createBet = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const userId = req.user.userId;
    const { betData, exposure, commission, partnership } = req.body;

    // Validate required fields
    if (!userId || !betData || !betData?.stake || !betData?.mid || !betData?.gameSlug) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        status: false,
        message: "Missing required fields: userId, betData with stake, mid, and gameSlug are required"
      });
    }

    const userRepo = queryRunner.manager.getRepository(USER_TABLES[req.__type!]);
    const casinoBetRepository = queryRunner.manager.getRepository(CasinoBet);

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
    const bet = casinoBetRepository.create({
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
      matchId: betData.mid,
      status: "pending",
    });

    await casinoBetRepository.save(bet);

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

// export const createBet = async (req: Request, res: Response) => {
//   const casinoBetRepository = AppDataSource.getRepository(CasinoBet);

//   try {

//     const userId = req.user.userId;

//     const { betData, exposure, commission, partnership } = req.body;

//     const userRepo = AppDataSource.getRepository(USER_TABLES[req.__type!]);

//     const user = await userRepo.findOne({ where: { id: userId } });

//     if (!user) {
//       return res.status(401).json({
//         status: false,
//         message: "User not found"
//       });
//     }

//     const userBalance = Number(user.balance);
//     const userExposure = Number(user.exposure);
//     const userExposureLimit = Number(user.exposureLimit);
//     const stakeAmount = Number(betData?.stake);

//     if (!userId || !stakeAmount) {
//       return res.status(400).json({
//         status: false,
//         message: "Missing required fields: userId, casinoType, and amount are required"
//       });
//     }

//     if (stakeAmount > userBalance - userExposure) {
//       return res.status(400).json({
//         status: false,
//         message: "Not enough balance"
//       });
//     }

//     if (stakeAmount + userExposure > userExposureLimit) {
//       return res.status(400).json({
//         status: false,
//         message: "exceeded exposure limit"
//       });
//     }

//     const bet = casinoBetRepository.create({
//       userId,
//       userType: req.__type,
//       exposure,
//       commission,
//       partnership,
//       betData,
//       matchId: betData?.mid || null,
//       status: "pending",
//     });

//     await casinoBetRepository.save(bet);

//     user.exposure = userExposure + stakeAmount;
//     await userRepo.save(user);

//     return res.status(201).json({
//       status: true,
//       message: "Bet placed successfully",
//       data: bet,
//     });

//   } catch (error: any) {
//     console.error("Error placing bet:", error);
//     return res.status(500).json({
//       status: false,
//       message: "Internal server error",
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// };

export const casinoResult = async (req: Request, res: Response) => {
  try {
    const casinoBetRepo = AppDataSource.getRepository(CasinoBet);

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized",
      });
    }

    const {
      startTime,
      endTime,
      gameSlug,
      search,
      page = 1,
      limit = 10,
    } = req.query as {
      startTime?: string;
      endTime?: string;
      gameSlug?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const qb = casinoBetRepo
      .createQueryBuilder("bet")
      .where("bet.userId = :userId", { userId });

    if (startTime && endTime) {
      qb.andWhere("bet.createdAt BETWEEN :start AND :end", {
        start: new Date(startTime),
        end: new Date(endTime),
      });
    } else if (startTime) {
      qb.andWhere("bet.createdAt >= :start", { start: new Date(startTime) });
    } else if (endTime) {
      qb.andWhere("bet.createdAt <= :end", { end: new Date(endTime) });
    }

    if (gameSlug) {
      qb.andWhere("bet.betData ->> 'gameSlug' ILIKE :gameSlug", {
        gameSlug: `%${gameSlug}%`,
      });
    }

    if (search) {
      qb.andWhere(
        `(bet.betData ->> 'gameSlug' ILIKE :search 
          OR bet.betData -> 'result' ->> 'status' ILIKE :search
          OR bet.matchId ILIKE :search)`,
        { search: `%${search}%` }
      );
    }

    const skip = (Number(page) - 1) * Number(limit);
    qb.skip(skip).take(Number(limit));
    qb.orderBy("bet.createdAt", "DESC");

    const [bets, total] = await qb.getManyAndCount();

    const transformed = bets
      .filter((bet) => bet.betData?.result)
      .map((bet) => {
        return {
          id: bet.id,
          matchId: bet.matchId,
          createdAt: bet.createdAt,
          updatedAt: bet.updatedAt,
          status: bet.status,
          gameDate: bet.betData?.gameDate,
          gameName: bet.betData?.gameName,
          stake: bet.betData?.stake,
          winner: bet.betData?.result?.winner,
          resultStatus: bet.betData?.result?.status,
        };
      });

    return res.status(200).json({
      status: true,
      message: "User bets fetched successfully",
      data: transformed,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching bets:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getCurrentBet = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { slug } = req.query;


    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Slug parameter is required"
      });
    }

    const currentBetRepo = AppDataSource.getRepository(CasinoBet);

    const latestBet = await currentBetRepo
      .createQueryBuilder("bet")
      .where("bet.userId = :userId", { userId })
      .andWhere("bet.betData ->> 'gameSlug' = :slug", { slug })
      .orderBy("bet.createdAt", "DESC")
      .getOne();


    if (!latestBet) {
      return res.status(404).json({
        success: false,
        message: "No bets found for this user with the specified slug"
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

export const settleUserCasinoBets = async (req: Request, res: Response) => {
  try {
    const { casinoType, mid } = req.body;
    const userId = req.user?.userId;
    
    // Validate input
    if (!casinoType || !mid) {
      return res.status(400).json({
        success: false,
        message: "casinoType and mid are required in the request body"
      });
    }
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const redisClient = getRedisClient();
    const casinoBetRepo = CronDataSource.getRepository(CasinoBet);
    
    // Get results from Redis for this casino type
    const resultsKey = `casino:${casinoType}:results`;
    const resultsData = await redisClient.get(resultsKey);
    
    if (!resultsData) {
      return res.status(404).json({
        success: false,
        message: `No results found in Redis for casino type: ${casinoType}`
      });
    }

    let results;
    try {
      results = JSON.parse(resultsData);
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        message: "Failed to parse results data from Redis"
      });
    }

    // Find the specific result for the requested mid
    const result = results.find((r: any) => {
      const resultMid = String(r.mid || r.matchId);
      return resultMid === String(mid);
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Match ID ${mid} not found in results for casino type: ${casinoType}`
      });
    }
      
    // Extract winner from result (handle different field names)
    const winner = result.win || result.result || result.winner;
    
    if (!winner) {
      return res.status(404).json({
        success: false,
        message: `Winner not determined for match ID ${mid}`
      });
    }

    // Find pending bets for this match ID, casino type, and specific user
    const pendingBets = await casinoBetRepo.find({
      where: { 
        matchId: mid, 
        userId: userId,
        status: "pending" 
      }
    });

    if (pendingBets.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No pending bets found for this user and match",
        settledCount: 0,
        matchId: mid,
        casinoType: casinoType,
        winner: winner,
        userId: userId
      });
    }

    let settledCount = 0;
    let errors = [];

    for (const bet of pendingBets) {
      try {
        // Check if bet is already settled to prevent double processing
        if (bet.betData?.result?.settled === true || bet.status !== "pending") {
          console.log(`[PATCH] Bet ${bet.id} already settled (status: ${bet.status}), skipping`);
          continue;
        }

        const betData = bet.betData || {};
        const betSid: String = betData.sid;

        if (!betSid) {
          console.log(`[PATCH] Bet ${bet.id} has no SID, skipping result update`);
          errors.push({ betId: bet.id, error: "No SID found" });
          continue;
        }

        // Use a transaction for each bet
        await CronDataSource.transaction(async (transactionalEntityManager) => {
          // First, check if bet is still pending with a lock to prevent race conditions
          const currentBet = await transactionalEntityManager.findOne(CasinoBet, {
            where: { id: bet.id, status: "pending", userId: userId },
            lock: { mode: "pessimistic_write" }
          });

          if (!currentBet) {
            console.log(`[PATCH] Bet ${bet.id} no longer pending, skipping`);
            return;
          }

          // Find user with lock
          const user: any = await transactionalEntityManager.findOne(USER_TABLES[bet.betData.gameSlug], {
            where: { id: userId },
            lock: { mode: "pessimistic_write" }
          });

          if (!user) {
            console.log(`[PATCH] User ${userId} not found for bet ${bet.id}`);
            errors.push({ betId: bet.id, error: "User not found" });
            return;
          }

          const stakeAmount = Number(betData.stake) || 0;
          let newStatus: "won" | "lost" = "lost";
          let profitLoss = 0;

          if (winner === betSid) {
            newStatus = "won";
            profitLoss = Number(betData.profit) || 0;
            user.balance = Number(user.balance) + profitLoss;
          } else {
            newStatus = "lost";
            profitLoss = Number(betData.loss) || 0;
            user.balance = Number(user.balance) - profitLoss;
          }

          user.exposure = Number(user.exposure) - stakeAmount;

          // Update user and bet - update status first to prevent re-processing
          await transactionalEntityManager.update(CasinoBet, { id: bet.id }, {
            status: newStatus,
            betData: {
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
            }
          });
          
          // Update user balance after bet is marked as settled
          await transactionalEntityManager.save(user);

          console.log(`[PATCH] Updated bet ${bet.id}: ${newStatus} with profit/loss: ${profitLoss}`);
          settledCount++;
        });
      } catch (error: any) {
        console.error(`[PATCH] Error processing bet ${bet.id}:`, error);
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
      winner: winner,
      userId: userId,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error(`[PATCH] Error in settleUserCasinoBets:`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during settlement",
      error: error.message
    });
  }
};