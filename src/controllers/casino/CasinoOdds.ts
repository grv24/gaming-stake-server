import { Request, Response } from "express";
import { getRedisClient } from "../../config/redisConfig";
import {
  // fetchAndUpdateCasinoOdds,
  getCircuitBreakerHealth,
  resetCircuitBreaker,
  markCasinoAsActive,
  requestImmediateUpdate,
} from "../../services/casino/CasinoService";
import { getCasinoDataForWhitelist } from "../../services/casino/WhitelistCasinoService";
import { AppDataSource } from "../../server";
import { CasinoBet } from "../../entities/casino/CasinoBet";
// import { CasinoMatch } from "../../entities/casino/CasinoMatch";
// import {
//   ALTERNATIVE_API_CASINO_TYPES,
//   DIFF_STRUCT_CASINO_TYPES,
// } from "../../Helpers/Request/Validation";
import { Between, In, JsonContains, Not, IsNull } from "typeorm";
import axios from "axios";
import { CasinoMatchNew } from "../../entities/casino/CasinoMatchNew";

export const getCasinoData = async (req: Request, res: Response) => {
  try {
    const { casinoType } = req.query;
    if (!casinoType) {
      return res.status(400).json({
        status: "error",
        message: "casinoType is required",
      });
    }

    const casinoTypeStr = String(casinoType);
    const redisClient = getRedisClient();
    
    // Use the direct Redis key pattern: casino_data:${slug}
    const redisKey = `casino_data:${casinoTypeStr}`;

    console.log(`[CASINO_DATA] Fetching data for key: ${redisKey}`);

    // Fetch directly from Redis using the provider's key pattern
    const redisData = await redisClient.get(redisKey);

    if (redisData) {
      try {
        const parsedData = JSON.parse(redisData);
        console.log(`[CASINO_DATA] Successfully retrieved data from Redis key: ${redisKey}`);
        
        return res.status(200).json({
          status: "success",
          message: "Casino data retrieved from Redis",
          data: parsedData?.data,
          source: "redis",
          redisKey: redisKey,
        });
      } catch (parseError) {
        console.error(`[CASINO_DATA] Failed to parse Redis data for key: ${redisKey}`, parseError);
        return res.status(500).json({
          status: "error",
          message: "Failed to parse casino data from Redis",
          redisKey: redisKey,
        });
      }
    }

    // If not found in Redis, return appropriate error
    console.log(`[CASINO_DATA] No data found in Redis for key: ${redisKey}`);
    return res.status(404).json({
      status: "error",
      message: "Casino data not found in Redis",
      redisKey: redisKey,
      suggestion: "Check if the casino type exists or if data is being updated",
    });

  } catch (err: any) {
    console.error("Error in getCasinoData:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: err.message,
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

    const casinoTypeStr = String(casinoType);
    const redisClient = getRedisClient();
    
    // Use the direct Redis key pattern: r_${slug} for results
    const redisKey = `r_${casinoTypeStr}`;

    console.log(`[CASINO_RESULTS] Fetching results for key: ${redisKey}`);

    // Fetch directly from Redis using the provider's key pattern
    const redisData = await redisClient.get(redisKey);

    if (redisData) {
      try {
        const parsedData = JSON.parse(redisData);
        console.log(`[CASINO_RESULTS] Successfully retrieved results from Redis key: ${redisKey}`);
        
        return res.status(200).json({
          status: "success",
          message: "Casino results retrieved from Redis",
          results: parsedData?.data?.res,
          source: "redis",
          redisKey: redisKey,
        });
      } catch (parseError) {
        console.error(`[CASINO_RESULTS] Failed to parse Redis data for key: ${redisKey}`, parseError);
        return res.status(500).json({
          status: "error",
          message: "Failed to parse casino results from Redis",
          redisKey: redisKey,
        });
      }
    }

    // If not found in Redis, return appropriate error
    console.log(`[CASINO_RESULTS] No results found in Redis for key: ${redisKey}`);
    return res.status(404).json({
      status: "error",
      message: "Casino results not found in Redis",
      redisKey: redisKey,
      suggestion: "Check if the casino type exists or if results are being updated",
    });

  } catch (err: any) {
    console.error("Error in getCasinoResults:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      error: err.message,
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

    const CasinoMatchRepo = AppDataSource.getRepository(CasinoMatchNew);
    const CasinoBetRepo = AppDataSource.getRepository(CasinoBet);

    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    // Build where conditions for CasinoMatch
    const whereConditions: any = {
      casinoType: slug as string, // assuming CasinoMatch has gameSlug field
      winner: Not(IsNull()),
    };

    // Add date filter if provided
    if (date) {
      const targetDate = date as string;
      const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
      const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

      whereConditions.createdAt = Between(startOfDay, endOfDay);
    }

    // Fetch matches directly
    const [matches, totalCount] = await CasinoMatchRepo.findAndCount({
      where: whereConditions,
      skip,
      take,
      order: { createdAt: "DESC" },
    });

    // For each match, fetch my bet (if any)
    const results = await Promise.all(
      matches.map(async (match) => {
        const bet = await CasinoBetRepo.findOne({
          where: {
            userId,
            matchId: match.mid as any,
            status: In(["won", "lost"]),
          },
        });

        const createdAtIST = new Date(match.createdAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        });

        return {
          roundId: match.mid,
          winner: match.winner,
          result: match.result,
          dateAndTime: createdAtIST,
          myBetDetails: bet ? bet.betData : null,
        };
      })
    );

    return res.status(200).json({
      status: "success",
      message: "Casino matches fetched successfully",
      pagination: {
        page: Number(page),
        limit: Number(limit),
        count: matches.length,
        totalCount,
        totalPages: Math.ceil(totalCount / take),
      },
      results,
    });
  } catch (err: any) {
    console.error("Error in getCasinoHistory:", err);

    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};

// export const getCasinoHistory = async (req: Request, res: Response) => {
//   try {
//     const userId = req.user?.userId;
//     const { slug, page = 1, limit = 10, date } = req.query;

//     if (!slug) {
//       return res.status(400).json({
//         status: "error",
//         message: "casinoType (slug) is required",
//       });
//     }

//     const CasinoBetRepo = AppDataSource.getRepository(CasinoBet);
//     const CasinoMatchRepo = AppDataSource.getRepository(CasinoMatch);

//     const take = Number(limit);
//     const skip = (Number(page) - 1) * take;

//     // First, try the JsonContains approach
//     const whereConditions: any = {
//       betData: JsonContains({ gameSlug: slug as string }),
//       status: In(["won", "lost"]),
//     };

//     // Add date filter if provided
//     if (date) {
//       const targetDate = date as string;
//       const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
//       const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

//       whereConditions.createdAt = Between(startOfDay, endOfDay);
//     }

//     const [placedBets, totalCount] = await CasinoBetRepo.findAndCount({
//       where: whereConditions,
//       skip,
//       take,
//       order: { createdAt: "DESC" }
//     });

//     // Get match details for each bet
//     const matches = await Promise.all(
//       placedBets.map(async (bet) => {
//         const match = await CasinoMatchRepo.findOne({
//           where: { mid: bet.matchId }
//         });

//         if (!match) return null;

//         const createdAtIST = new Date(match.createdAt)
//           .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

//         return {
//           roundId: match.mid,
//           winner: match.winner,
//           result: match.result,
//           dateAndTime: createdAtIST,
//           myBetDetails: bet.betData
//         };
//       })
//     );

//     const filteredMatches = matches.filter((m) => m !== null);

//     return res.status(200).json({
//       status: "success",
//       message: "Casino history fetched successfully",
//       pagination: {
//         page: Number(page),
//         limit: Number(limit),
//         count: placedBets.length,
//         totalCount: totalCount,
//         totalPages: Math.ceil(totalCount / take)
//       },
//       results: filteredMatches,
//     });
//   } catch (err: any) {
//     console.error("Error in getCasinoHistory:", err);

//     // If JsonContains fails, fall back to string matching
//     if (err.message.includes("JSON") || err.message.includes("json")) {
//       // Implement fallback solution here
//       return res.status(500).json({
//         status: "error",
//         message: "JSON query issue. Please check database configuration.",
//       });
//     }

//     return res.status(500).json({
//       status: "error",
//       message: "Internal Server Error",
//     });
//   }
// };

export const getCasinoMatchDetails = async (req: Request, res: Response) => {
  try {
    const CasinoBetRepo = AppDataSource.getRepository(CasinoBet);
    const casinoMatchRepo = AppDataSource.getRepository(CasinoMatchNew);

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

    // Validate casinoType if provided
    if (casinoType && typeof casinoType !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Invalid casinoType format",
      });
    }

    // Fetch existing match record
    let casinoMatch = await casinoMatchRepo.findOne({
      where: { mid: matchId as any },
    });

    let resultData = null;
    let source = null;

    // Check if we need to fetch from API
    const needsApiFetch = !casinoMatch || casinoMatch.result === null;
    
    if (needsApiFetch) {
      try {
        // Validate required environment variable
        if (!process.env.THIRD_PARTY_URL) {
          console.error("THIRD_PARTY_URL environment variable is not set");
          return res.status(500).json({
            success: false,
            message: "Service configuration error",
          });
        }
       
        // Build API URL with proper parameter validation
        const apiUrl = `${process.env.THIRD_PARTY_URL}/exchange/casino/roundresult?roundId=${matchId}`;
        // const params = new URLSearchParams({
        //   roundId: String(matchId),
        //   ...(casinoType && { gtype: String(casinoType) })
        // });

        console.log(`Fetching casino result from API for matchId: ${matchId}, casinoType: ${casinoType || 'not provided'}`);
        
        const response = await axios.get(`${apiUrl}`, {
          timeout: 10000, // 10 second timeout
          headers: {
            'Content-Type': 'application/json',
          }
        });

        // Validate API response structure
        if (!response?.data?.data?.data || !Array.isArray(response.data.data.data)) {
          console.error("Invalid API response structure:", response?.data);
          return res.status(500).json({
            success: false,
            message: "Invalid response format from external API",
          });
        }

        source = "api";
        resultData = response.data.data.data[0];

        // Validate result data
        if (!resultData) {
          console.warn(`No result data found for matchId: ${matchId}`);
          return res.status(404).json({
            success: false,
            message: "No result data available for this match",
          });
        }

        // Update database with proper error handling
        try {
          if (casinoMatch) {
            // Update existing record
            await casinoMatchRepo.update(
              { mid: matchId as any },
              { result: resultData }
            );
            console.log(`Updated existing casino match record for matchId: ${matchId}`);
          } else {
            // Create new record if it doesn't exist
            const newMatch = casinoMatchRepo.create({
              mid: matchId as any,
              casinoType: casinoType || 'unknown',
              result: resultData,
            });
            await casinoMatchRepo.save(newMatch);
            casinoMatch = newMatch;
            console.log(`Created new casino match record for matchId: ${matchId}`);
          }
        } catch (dbError: any) {
          console.error(`Database error while saving casino match for matchId ${matchId}:`, dbError);
          // Don't fail the request if DB update fails, we still have the API data
          console.warn("Continuing with API data despite database update failure");
        }

      } catch (error: any) {
        console.error(`API error fetching casino result for matchId ${matchId}:`, {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          data: error.response?.data
        });

        // Handle specific error types
        if (error.code === 'ECONNABORTED') {
          return res.status(504).json({
            success: false,
            message: "External API timeout - please try again",
          });
        }

        if (error.response?.status === 404) {
          return res.status(404).json({
            success: false,
            message: "Match not found in external system",
          });
        }

        if (error.response?.status >= 500) {
          return res.status(502).json({
            success: false,
            message: "External service temporarily unavailable",
          });
        }

        // If we have existing data, use it instead of failing
        if (casinoMatch?.result) {
          console.log(`Using existing database data due to API error for matchId: ${matchId}`);
          source = "database";
          resultData = casinoMatch.result;
        } else {
          return res.status(500).json({
            success: false,
            message: "Unable to fetch match data from external source",
          });
        }
      }
    } else {
      source = "database";
      resultData = casinoMatch?.result;
      console.log(`Using cached database result for matchId: ${matchId}`);
    }

    // Fetch user bets for this match (include all statuses)
    const userBets = await CasinoBetRepo.find({
      where: {
        userId,
        matchId: casinoMatch?.mid as any,
        status: In(["pending", "won", "lost"]),
      },
    });

    // If we have result data and pending bets exist, trigger settlement
    if (resultData && userBets.some(bet => bet.status === "pending")) {
      try {
        console.log(`Triggering settlement for matchId: ${matchId} with ${userBets.filter(bet => bet.status === "pending").length} pending bets`);
        
        // Use the public settlement method
        const { CasinoSettlementService } = await import('../../services/casino/CasinoSettlementService');
        const settlementService = new CasinoSettlementService(AppDataSource);
        
        // Trigger settlement for this match (this will settle all pending bets for this match)
        const settlementResult = await settlementService.settleCasinoMatch(
          casinoType as string || 'unknown', 
          matchId as string
        );
        
        if (settlementResult.settledCount > 0) {
          console.log(`Settlement completed: ${settlementResult.settledCount} bets settled for match ${matchId}`);
          
          // Refetch user bets to get updated statuses
          const updatedUserBets = await CasinoBetRepo.find({
            where: {
              userId,
              matchId: casinoMatch?.mid as any,
              status: In(["pending", "won", "lost"]),
            },
          });
          
          return res.json({
            success: true,
            data: {
              matchData: resultData,
              userBets: updatedUserBets,
              source,
              betSummary: {
                total: updatedUserBets.length,
                pending: updatedUserBets.filter(bet => bet.status === "pending").length,
                won: updatedUserBets.filter(bet => bet.status === "won").length,
                lost: updatedUserBets.filter(bet => bet.status === "lost").length,
              },
              hasResultData: !!resultData,
              hasPendingBets: updatedUserBets.some(bet => bet.status === "pending"),
              settlementInfo: {
                settledCount: settlementResult.settledCount,
                message: settlementResult.message
              }
            },
          });
        }
      } catch (settlementError: any) {
        console.error(`Error triggering settlement for match ${matchId}:`, {
          message: settlementError.message,
          stack: settlementError.stack,
          userId,
          matchId,
          casinoType
        });
        
        // Log warning about pending bets that couldn't be settled
        const pendingBetsCount = userBets.filter(bet => bet.status === "pending").length;
        if (pendingBetsCount > 0) {
          console.warn(`Warning: ${pendingBetsCount} pending bets for user ${userId} in match ${matchId} could not be settled automatically`);
        }
        
        // Continue with original response even if settlement fails
      }
    }

    return res.json({
      success: true,
      data: {
        matchData: resultData,
        userBets,
        source,
        betSummary: {
          total: userBets.length,
          pending: userBets.filter(bet => bet.status === "pending").length,
          won: userBets.filter(bet => bet.status === "won").length,
          lost: userBets.filter(bet => bet.status === "lost").length,
        },
        hasResultData: !!resultData,
        hasPendingBets: userBets.some(bet => bet.status === "pending"),
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

// Health check endpoint for monitoring circuit breaker states
export const getCasinoHealth = async (req: Request, res: Response) => {
  try {
    const health = getCircuitBreakerHealth();

    return res.status(200).json({
      status: "success",
      message: "Casino service health check",
      data: {
        ...health,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  } catch (err: any) {
    console.error("Error in getCasinoHealth:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};

// Reset circuit breaker endpoint (for manual recovery)
export const resetCasinoCircuitBreaker = async (
  req: Request,
  res: Response
) => {
  try {
    const { casinoType } = req.body;

    if (!casinoType) {
      return res.status(400).json({
        status: "error",
        message: "casinoType is required",
      });
    }

    resetCircuitBreaker(casinoType);

    return res.status(200).json({
      status: "success",
      message: `Circuit breaker reset for ${casinoType}`,
    });
  } catch (err: any) {
    console.error("Error in resetCasinoCircuitBreaker:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};

// Request immediate update for specific casino type
export const requestCasinoUpdate = async (req: Request, res: Response) => {
  try {
    const { casinoType } = req.body;

    if (!casinoType) {
      return res.status(400).json({
        status: "error",
        message: "casinoType is required",
      });
    }

    const casinoTypeStr = String(casinoType);

    // Mark as active and request immediate update
    markCasinoAsActive(casinoTypeStr);
    const updateRequested = requestImmediateUpdate(casinoTypeStr);

    return res.status(200).json({
      status: "success",
      message: updateRequested
        ? `Immediate update requested for ${casinoTypeStr}`
        : `${casinoTypeStr} was updated recently, will be processed in next cycle`,
      updateRequested: updateRequested,
    });
  } catch (err: any) {
    console.error("Error in requestCasinoUpdate:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};

// Get casino data filtered by whitelist panel configuration
export const getCasinoDataForWhitelistPanel = async (req: Request, res: Response) => {
  try {
    const { whitelistId } = req.params;

    if (!whitelistId) {
      return res.status(400).json({
        status: "error",
        message: "whitelistId is required",
      });
    }

    // Get filtered casino data for this whitelist panel
    const casinoData = await getCasinoDataForWhitelist(whitelistId);

    return res.status(200).json({
      status: "success",
      message: "Casino data filtered for whitelist panel",
      data: casinoData,
      whitelistId: whitelistId,
      casinoCount: Object.keys(casinoData).length
    });

  } catch (err: any) {
    console.error("Error in getCasinoDataForWhitelistPanel:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};
