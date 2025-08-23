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
    if (!freshData?.result?.res) {
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch results",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Results data fetched fresh",
      results: freshData.result.res,
    });
  } catch (err: any) {
    console.error("Error in getCasinoResults:", err.message);
    return res.status(500).json({
      status: "error",
      message: "Internal Server Error",
    });
  }
};
