import { Request, Response } from "express";
import { AppDataSource } from "../../../server";
import { CasinoBet } from "../../../entities/casino/CasinoBet";
import { CasinoMatchNew } from "../../../entities/casino/CasinoMatchNew";
import { CASINO_TYPES } from "../../../Helpers/Request/Validation";
import { USER_TABLES } from "../../../Helpers/users/Roles";
import { getRedisClient } from "../../../config/redisConfig";
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

          // --- Lay / Back logic ---
          let finalStatus: "won" | "lost" = "lost";
          if (betData.oddCategory === "Back") {
            finalStatus = isWinner ? "won" : "lost";
          } else if (betData.oddCategory === "Lay") {
            finalStatus = !isWinner ? "won" : "lost";
          }

          let profitLoss = 0;

          if (isWinner) {
            profitLoss = Number(betData.profit) || 0;
            user.balance = Number(user.balance) + profitLoss;
          } else {
            profitLoss = Number(betData.loss) || 0;
            user.balance = Number(user.balance) - profitLoss;
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
