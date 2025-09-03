import { Request, Response } from "express";
import { getRedisClient } from "../../config/redisConfig";
import { fetchAndUpdateCasinoOdds } from "../../services/casino/CasinoService";
import { AppDataSource } from "../../server";
import { CasinoBet } from "../../entities/casino/CasinoBet";
import { CasinoMatch } from "../../entities/casino/CasinoMatch";
import { ALTERNATIVE_API_CASINO_TYPES, DIFF_STRUCT_CASINO_TYPES } from "../../Helpers/Request/Validation";
import { Between, JsonContains } from "typeorm";
import axios from "axios";

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

    if (!slug) {
      return res.status(400).json({
        status: "error",
        message: "casinoType (slug) is required",
      });
    }

    const CasinoBetRepo = AppDataSource.getRepository(CasinoBet);
    const CasinoMatchRepo = AppDataSource.getRepository(CasinoMatch);

    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    // First, try the JsonContains approach
    const whereConditions: any = {
      userId,
      betData: JsonContains({ gameSlug: slug as string })
    };

    // Add date filter if provided
    if (date) {
      const targetDate = date as string;
      const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
      const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

      whereConditions.createdAt = Between(startOfDay, endOfDay);
    }

    const [placedBets, totalCount] = await CasinoBetRepo.findAndCount({
      where: whereConditions,
      skip,
      take,
      order: { createdAt: "DESC" }
    });

    // Get match details for each bet
    const matches = await Promise.all(
      placedBets.map(async (bet) => {
        const match = await CasinoMatchRepo.findOne({
          where: { mid: bet.matchId }
        });

        if (!match) return null;

        const createdAtIST = new Date(match.createdAt)
          .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

        return {
          roundId: match.mid,
          winner: match.winner,
          result: match.result,
          dateAndTime: createdAtIST,
          myBetDetails: bet.betData
        };
      })
    );

    const filteredMatches = matches.filter((m) => m !== null);

    return res.status(200).json({
      status: "success",
      message: "Casino history fetched successfully",
      pagination: {
        page: Number(page),
        limit: Number(limit),
        count: placedBets.length,
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / take)
      },
      results: filteredMatches,
    });
  } catch (err: any) {
    console.error("Error in getCasinoHistory:", err);

    // If JsonContains fails, fall back to string matching
    if (err.message.includes("JSON") || err.message.includes("json")) {
      // Implement fallback solution here
      return res.status(500).json({
        status: "error",
        message: "JSON query issue. Please check database configuration.",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};

export const getCasinoMatchDetails = async (req: Request, res: Response) => {
  try {

    const CasinoBetRepo = AppDataSource.getRepository(CasinoBet);
    const casinoMatchRepo = AppDataSource.getRepository(CasinoMatch);

    const userId = req.user?.userId;
    const { matchId, casinoType } = req.query;

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

    let casinoMatch = await casinoMatchRepo.findOne({
      where: { mid: matchId as any }
    });

    if (!casinoMatch) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
      });
    }

    let resultData = null;
    // If no casinoMatch record exists or result is null, fetch from API
    if (!casinoMatch || casinoMatch.result === null) {
      try {
        // Fetch result from 3rd party API
        const response = await axios.get(`${process.env.THIRD_PARTY_URL}/exchange/casino/roundresult?roundId=${matchId}`);

        if (response.data.error === false && response.data.data?.success) {
          const apiData = response.data.data;

          // Handle different response formats
          if (Array.isArray(apiData.data)) {
            // Format 1: Array response
            const matchResult = apiData.data.find((item: any) => String(item.mid) === String(matchId));
            if (matchResult) {
              resultData = {
                ...matchResult
              };
            }
          } else if (apiData.data?.t1) {
            // Format 2: Object with t1 property
            const t1Data = apiData.data.t1;
            resultData = {
              ...t1Data
            };
          }

          // Create or update casinoMatch record
          if (resultData) {
            try {
              if (casinoMatch) {
                // Update existing record
                casinoMatch.result = resultData;
                await casinoMatchRepo.save(casinoMatch);
              } else {
                // Create new record with duplicate handling
                casinoMatch = casinoMatchRepo.create({
                  mid: matchId,
                  casinoType,
                  result: resultData
                } as Partial<CasinoMatch>);
                await casinoMatchRepo.save(casinoMatch);
              }
            } catch (saveError: any) {
              // Handle duplicate key error (race condition)
              if (saveError.code === '23505' || saveError.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                console.log(`Duplicate key detected for mid ${matchId}, fetching existing record`);
                // Record already exists, fetch it
                casinoMatch = await casinoMatchRepo.findOne({
                  where: { mid: matchId as any }
                });

                // If the existing record has no result, update it
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
        console.error(`[API] Error fetching result for mid ${matchId}:`, apiError);
        // Don't return error here, continue with existing data if available
        if (!casinoMatch) {
          return res.status(500).json({
            success: false,
            message: "Failed to fetch result from external API and no existing record found",
            error: apiError.message
          });
        }
        // If we have existing casinoMatch data, use it instead
        console.log(`Using existing casinoMatch data due to API error`);
        resultData = casinoMatch.result;
      }
    } else {
      // Use existing result from casinoMatch table
      resultData = casinoMatch.result;
    }


    const createdAtIST = new Date(casinoMatch?.createdAt as any)
      .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    resultData = {
      result: casinoMatch?.result,
      dateAndTime: createdAtIST,
    };


    const userBets = await CasinoBetRepo.find({
      where: { userId, matchId: casinoMatch?.mid as any }
    });

    return res.json({
      success: true,
      data: {
        matchData: resultData,
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
