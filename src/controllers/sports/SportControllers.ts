import { Request, Response } from "express";
import axios from "axios";
import { getRedisClient } from "../../config/redisConfig";

export const getSportsList = async (req: Request, res: Response) => {
    try {
        const { sport_id } = req.query;

        if (!sport_id) {
            return res.status(400).json({
                status: "error",
                message: "sport_id is required",
            });
        }

        const redisClient = getRedisClient();
        const cacheKey = `sports:${sport_id}`;

        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(200).json({
                status: "success",
                message: "Sports list fetched from cache",
                data: JSON.parse(cachedData),
            });
        }

        const response = await axios.get(
            `http://localhost:8085/api/new/getlistdata`,
            { params: { sport_id } }
        );

        const apiData = response.data;

        console.log("-------------------- API data (sports) --------------------", apiData);

        await redisClient.set(cacheKey, JSON.stringify(apiData), "EX", 600);

        return res.status(200).json({
            status: "success",
            message: "Sports list fetched successfully",
            data: apiData,
        });
    } catch (err: any) {
        console.error("Error fetching sports list:", err.message);

        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
            error:
                process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};
