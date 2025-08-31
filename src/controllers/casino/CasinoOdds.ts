import { Request, Response } from "express";
import { getRedisClient } from "../../config/redisConfig";
import { fetchAndUpdateCasinoOdds } from "../../services/casino/CasinoService";
import { AppDataSource } from "../../server";
import { CasinoBet } from "../../entities/casino/CasinoBet";
import { CasinoMatch } from "../../entities/casino/CasinoMatch";
import { ALTERNATIVE_API_CASINO_TYPES, DIFF_STRUCT_CASINO_TYPES } from "../../Helpers/Request/Validation";
import { Between } from "typeorm";

export const getCasinoData = async (req: Request, res: Response) => {
  try {
    const { casinoType } = req.query;
    if (!casinoType) {
      return res.status(400).json({
        status: "error",
        message: "casinoType is required",
      });
    }

    const redisClient = getRedisClient();
    const cacheKey = `casino:${casinoType}:current`;

    // 1. Check Redis for current match
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return res.status(200).json({
        status: "success",
        message: "Current match data from cache",
        data: JSON.parse(cachedData),
      });
    }

    // 2. If cache miss → fetch + update
    const freshData = await fetchAndUpdateCasinoOdds(String(casinoType));
    if (!freshData?.data) {
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch odds",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Current match data fetched fresh",
      data: freshData.data,
    });
  } catch (err: any) {
    console.error("Error in getCasinoData:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};

export const getCasinoResults = async (req: Request, res: Response) => {
  try {
    const { casinoType } = req.query;
    if (!casinoType) {
      return res.status(400).json({
        status: "error",
        message: "casinoType is required",
      });
    }

    const redisClient = getRedisClient();
    const cacheKey = `casino:${casinoType}:results`;

    // 1. Check Redis for results
    const cachedResults = await redisClient.get(cacheKey);
    if (cachedResults) {
      return res.status(200).json({
        status: "success",
        message: "Results data from cache",
        results: JSON.parse(cachedResults),
      });
    }

    // 2. If cache miss → fetch + update
    const freshData = await fetchAndUpdateCasinoOdds(String(casinoType));

    // Handle both result structures
    let results = [];
    if (freshData?.result?.res && Array.isArray(freshData.result.res)) {
      results = freshData.result.res;
    } else if (freshData?.result && Array.isArray(freshData.result)) {
      results = freshData.result;
    }

    if (results.length === 0) {
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch results",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Results data fetched fresh",
      results: results,
    });
  } catch (err: any) {
    console.error("Error in getCasinoResults:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};

const TYPE_1 = ["aaa", "abj", "baccarat2", "card32eu", "dt20", "dt202", "dt6", "lucky7eu", "poker", "poker20", "teen", "teen8", "teen9", "war"];
const TYPE_2 = ["btable2", "goal", "joker1", "joker20", "lottcard", "lucky5", "teen20c", "teenmuf"];
const TYPE_3 = ["poker6", "teen20"];
const TYPE_4 = ["ab4"];

export const getCasinoHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { slug, page = 1, limit = 10, date } = req.query;

    if (!slug) {
      return res.status(400).json({
        status: "error",
        message: "casinoType (slug) is required",
      });
    }

    const CasinoBetRepo = AppDataSource.getRepository(CasinoBet);
    const CasinoMatchRepo = AppDataSource.getRepository(CasinoMatch);

    // Build bet filter
    const betFilter: any = {
      userId,
      betData: { gameSlug: slug as string },
    };

    // Pagination setup
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    // Fetch bets with pagination
    const placedBets = await CasinoBetRepo.find({
      where: betFilter,
      skip,
      take,
    });

    // If single date filter is applied
    let matchDateFilter: any = {};
    if (date) {
      const targetDate = date as string; // e.g. "2025-08-30"
      const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
      const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

      matchDateFilter.createdAt = Between(startOfDay, endOfDay);
    }

    // Fetch related matches
    let matches = null;

    if (TYPE_1.includes(slug as any)) {
      matches = await Promise.all(
        placedBets.map(async (bet) => {
          const match = await CasinoMatchRepo.findOne({
            where: { mid: bet.matchId, ...matchDateFilter },
          });

          if (!match) return null;

          const winnerObj = match?.data?.t2?.find(
            (item: any) => item?.sid === match?.winner
          );

          const createdAtIST = new Date(match.createdAt)
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

          return {
            roundId: match.mid,
            winner: match.winner,
            winnerData: winnerObj || null,
            dateAndTime: createdAtIST,
            myBetDetails: bet.betData
          };
        })
      );
    } else if (TYPE_2.includes(slug as any)) {
      matches = await Promise.all(
        placedBets.map(async (bet) => {
          const match = await CasinoMatchRepo.findOne({
            where: { mid: bet.matchId, ...matchDateFilter },
          });

          if (!match) return null;

          const winnerObj = match?.data?.sub?.find(
            (item: any) => item.sid == match.winner
          );

          const createdAtIST = new Date(match.createdAt)
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

          return {
            roundId: match.mid,
            winner: match.winner,
            winnerData: winnerObj || null,
            dateAndTime: createdAtIST,
            myBetDetails: bet.betData

          };
        })
      );
    } else if (TYPE_3.includes(slug as any)) {
      matches = await Promise.all(
        placedBets.map(async (bet) => {
          const match = await CasinoMatchRepo.findOne({
            where: { mid: bet.matchId, ...matchDateFilter },
          });

          if (!match) return null;

          const createdAtIST = new Date(match.createdAt)
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

          return {
            roundId: match.mid,
            winner: match.winner,
            winnerData: match.data,
            dateAndTime: createdAtIST,
            myBetDetails: bet.betData
          };
        })
      );
    } else if (TYPE_4.includes(slug as any)) {
      matches = await Promise.all(
        placedBets.map(async (bet) => {
          const match = await CasinoMatchRepo.findOne({
            where: { mid: bet.matchId, ...matchDateFilter },
          });

          if (!match) return null;

          const winnerObj = match?.data?.child?.find(
            (item: any) => item.sid == match.winner
          );

          const createdAtIST = new Date(match.createdAt)
            .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

          return {
            roundId: match.mid,
            winner: match.winner,
            winnerData: winnerObj || null,
            dateAndTime: createdAtIST,
            myBetDetails: bet.betData
          };
        })
      );
    }

    matches = matches?.filter((m) => m !== null);

    return res.status(200).json({
      status: "success",
      message: "Casino history fetched successfully",
      pagination: {
        page: Number(page),
        limit: Number(limit),
        count: (matches || [])?.length || 0,
      },
      results: matches,
    });
  } catch (err: any) {
    console.error("Error in getCasinoHistory:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};

export const getCasinoMatchDetails = async (req: Request, res: Response) => {
  try {

    const CasinoBetRepo = AppDataSource.getRepository(CasinoBet);
    const CasinoMatchRepo = AppDataSource.getRepository(CasinoMatch);

    const userId = req.user?.userId;
    const { matchId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!matchId) {
      return res.status(400).json({
        success: false,
        message: "MatchId is required",
      });
    }

    // Fetch the match
    const match = await CasinoMatchRepo.findOne({
      where: { mid: matchId },
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
      });
    }

    let result = null;

    if (TYPE_1.includes(match?.casinoType as any)) {


      const winnerObj = match?.data?.t2?.find(
        (item: any) => item?.sid === match?.winner
      );

      const createdAtIST = new Date(match.createdAt)
        .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

      result = {
        roundId: match?.mid,
        winner: match?.winner,
        winnerData: winnerObj || null,
        dateAndTime: createdAtIST,
      };

    } else if (TYPE_2.includes(match?.casinoType as any)) {

      const winnerObj = match?.data?.sub?.find(
        (item: any) => item.sid == match?.winner
      );

      const createdAtIST = new Date(match?.createdAt)
        .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

      result = {
        roundId: match?.mid,
        winner: match?.winner,
        winnerData: winnerObj || null,
        dateAndTime: createdAtIST,
      };

    } else if (TYPE_3.includes(match?.casinoType as any)) {

      const createdAtIST = new Date(match?.createdAt)
        .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

      result = {
        roundId: match?.mid,
        winner: match?.winner,
        winnerData: match?.data,
        dateAndTime: createdAtIST,
      };

    } else if (TYPE_4.includes(match?.casinoType as any)) {

      const winnerObj = match?.data?.child?.find(
        (item: any) => item?.sid == match?.winner
      );

      const createdAtIST = new Date(match.createdAt)
        .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

      result = {
        roundId: match?.mid,
        winner: match?.winner,
        winnerData: winnerObj || null,
        dateAndTime: createdAtIST,
      };
    }

    // Fetch all bets of this user for this match
    const userBets = await CasinoBetRepo.find({
      where: { userId, matchId: match?.mid as any }
    });

    return res.json({
      success: true,
      data: {
        matchData: result,
        userBets,
      },
    });
  } catch (err) {
    console.error("Error in getCasinoMatchDetails:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
