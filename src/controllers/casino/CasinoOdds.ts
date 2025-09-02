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

export const getCasinoHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { slug, page = 1, limit = 10, date } = req.query;

    console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");

    if (!slug) {
      return res.status(400).json({
        status: "error",
        message: "casinoType (slug) is required",
      });
    }

    const CasinoBetRepo = AppDataSource.getRepository(CasinoBet);
    const CasinoMatchRepo = AppDataSource.getRepository(CasinoMatch);

    const betFilter: any = {
      userId,
      betData: { gameSlug: slug as string },
    };

    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const placedBets = await CasinoBetRepo.find({
      where: betFilter,
      skip,
      take,
    });

    let matchDateFilter: any = {};
    if (date) {
      const targetDate = date as string; 
      const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
      const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

      matchDateFilter.createdAt = Between(startOfDay, endOfDay);
    }

    let matches = null;

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


    const createdAtIST = new Date(match?.createdAt)
      .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    result = {
      result: match.result,
      dateAndTime: createdAtIST,
    };


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
