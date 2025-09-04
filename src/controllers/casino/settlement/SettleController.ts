import { Request, Response } from "express";
import { AppDataSource } from "../../../server";
import { CasinoBet } from "../../../entities/casino/CasinoBet";
import { CASINO_TYPES } from "../../../Helpers/Request/Validation";
import { USER_TABLES } from "../../../Helpers/users/Roles";
import { CronDataSource } from "../../../corn.server";
import { getRedisClient } from "../../../config/redisConfig";
import { CasinoMatch } from "../../../entities/casino/CasinoMatch";
import axios from "axios";
import { settleCard32Result } from "./Card32";
import { settlePokerResult } from "./Poker";
import { settleDragonTiger } from "./DragonTiger6";
import { settleAbjResult } from "./AndarBahar2";
import { settleBaccaratResult } from "./Baccarat2";
import { settleDT202Result } from "./DragonTiger202";
import { settleTeen9Result } from "./Teen9";
import { settlePoker20Result } from "./Poker20";
import { settleAAAResult } from "./Aaa";
import { settleTeen8Result } from "./Teen8";
import { settleTeenMuflisResult } from "./Teenmuf";
import { settleCasinoWarResult } from "./War";

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

    const casinoBetRepo = CronDataSource.getRepository(CasinoBet);
    const casinoMatchRepo = CronDataSource.getRepository(CasinoMatch);

    // First check casinoMatch table for existing result
    let casinoMatch = await casinoMatchRepo.findOne({
      where: { mid, casinoType }
    });

    let resultData = null;

    // If no casinoMatch record exists or result is null, fetch from API
    if (!casinoMatch || casinoMatch.result === null) {
      try {
        const response = await axios.get(`${process.env.THIRD_PARTY_URL}/exchange/casino/roundresult?roundId=${mid}`);

        if (response.data.error === false && response.data.data?.success) {
          const apiData = response.data.data;

          if (Array.isArray(apiData.data)) {
            resultData = apiData.data.find((item: any) => String(item.mid) === String(mid));
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
                  result: resultData
                });
                await casinoMatchRepo.save(casinoMatch);
              }
            } catch (saveError: any) {
              if (saveError.code === '23505' || saveError.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                casinoMatch = await casinoMatchRepo.findOne({
                  where: { mid, casinoType }
                });

                if (casinoMatch && (!casinoMatch.result || casinoMatch.result === null)) {
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
            message: "Failed to fetch result from external API and no existing record found",
            error: apiError.message
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
        message: `No result data found for match ID ${mid}`
      });
    }

    // Find pending bets for this user
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
        userId: userId
      });
    }

    // CASINO-SPECIFIC WINNER DETERMINATION
    const winners = determineWinners(casinoType, resultData);

    if (winners.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No winners could be determined for this casino type",
        resultData: resultData,
        casinoType: casinoType
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

        await CronDataSource.transaction(async (transactionalEntityManager) => {
          const currentBet = await transactionalEntityManager.findOne(CasinoBet, {
            where: { id: bet.id, status: "pending", userId: userId },
            lock: { mode: "pessimistic_write" }
          });

          if (!currentBet) return;

          const user: any = await transactionalEntityManager.findOne(USER_TABLES[bet.userType as any], {
            where: { id: userId },
            lock: { mode: "pessimistic_write" }
          });

          if (!user) {
            errors.push({ betId: bet.id, error: "User not found" });
            return;
          }

          const stakeAmount = Number(betData.stake) || 0;
          const isWinner = winners.includes(betSid);
          const newStatus: "won" | "lost" = isWinner ? "won" : "lost";
          let profitLoss = 0;

          if (isWinner) {
            profitLoss = Number(betData.profit) || 0;
            user.balance = Number(user.balance) + profitLoss;
          } else {
            profitLoss = Number(betData.loss) || 0;
            user.balance = Number(user.balance) - profitLoss;
          }

          user.exposure = Number(user.exposure) - stakeAmount;

          await transactionalEntityManager.update(CasinoBet, { id: bet.id }, {
            status: newStatus,
            betData: {
              ...betData,
              result: {
                winner: isWinner ? betSid : null,
                winnerNation: betData.name || '',
                settledAt: new Date(),
                profitLoss: profitLoss,
                stake: stakeAmount,
                betRate: betData.betRate || betData.matchOdd || 1,
                status: newStatus,
                settled: true
              }
            }
          });

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

// CASINO-SPECIFIC WINNER DETERMINATION FUNCTIONS
function determineWinners(casinoType: string, resultData: any): string[] {
  const winners = new Set<string>();

  switch (casinoType.toLowerCase()) {
    case 'card32e':
    case 'card32eu':
      return settleCard32Result(resultData);

    case 'poker':
      return settlePokerResult(resultData);

    case 'dt6':
      return settleDragonTiger(resultData);

    case 'abj':
      return settleAbjResult(resultData);

    case 'baccarat2':
      return settleBaccaratResult(resultData);

    case 'teen20':
      return settleBaccaratResult(resultData);
    
    case 'teen8':
      return settleTeen8Result(resultData);

    case 'dt202':
      return settleDT202Result(resultData);

    case 'teen9':
      return settleTeen9Result(resultData);

    case 'poker20':
      return settlePoker20Result(resultData);

    case 'aaa':
      return settleAAAResult(resultData);

    case 'lucky7eu':
      return settleTeen8Result(resultData);

    case 'teenmuf':
      return settleTeenMuflisResult(resultData);

    case 'war':
      return settleCasinoWarResult(resultData);


    default:
      console.warn(`Unknown casino type: ${casinoType}`);
      return [];
  }
}