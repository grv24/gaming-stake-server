import { Request, Response } from "express";
import { getRedisClient } from "../../config/redisConfig";
import { fetchAndUpdateCasinoOdds } from "../../services/casino/CasinoService";

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
    const cacheKey = `casino:${casinoType}`;

    // 1. Check Redis
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: "success",
        message: "Casino data from cache",
        data: JSON.parse(cachedData),
      });
    }

    // 2. If cache miss → fetch + update Redis immediately
    const freshData = await fetchAndUpdateCasinoOdds(String(casinoType));
    if (!freshData) {
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch odds",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Casino data fetched fresh",
      data: freshData,
    });
  } catch (err: any) {
    console.error("Error in getCasinoData:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};
