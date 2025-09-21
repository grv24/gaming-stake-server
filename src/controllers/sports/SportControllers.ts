import { Request, Response } from "express";
import {
  fetchCricketData,
  fetchSoccerData,
  fetchTennisData,
  fetchAllSportsData,
  getSportsData,
  getAllSportsData,
  getFilteredIPlayMatches,
} from "../../services/sports/SportService";
import {
  getOddsFromRedis,
  processOddsData,
  getProviderDataFromRedis,
} from "../../services/sports/OddsService";
import { getRedisClient } from "../../config/redisConfig";
import axios from "axios";

// Controller to get cricket data
export const getCricketData = async (req: Request, res: Response) => {
  try {
    const data = await getSportsData("cricket");

    // If no data in Redis, fetch from API
    if (!data) {
      const freshData = await fetchCricketData();
      return res.json({
        success: true,
        data: freshData,
        source: "api",
      });
    }

    res.json({
      success: true,
      data: data,
      source: "redis",
    });
  } catch (error) {
    console.error("Error getting cricket data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cricket data",
    });
  }
};

// Controller to get soccer data
export const getSoccerData = async (req: Request, res: Response) => {
  try {
    const data = await getSportsData("soccer");

    // If no data in Redis, fetch from API
    if (!data) {
      const freshData = await fetchSoccerData();
      return res.json({
        success: true,
        data: freshData,
        source: "api",
      });
    }

    res.json({
      success: true,
      data: data,
      source: "redis",
    });
  } catch (error) {
    console.error("Error getting soccer data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch soccer data",
    });
  }
};

// Controller to get tennis data
export const getTennisData = async (req: Request, res: Response) => {
  try {
    const data = await getSportsData("tennis");

    // If no data in Redis, fetch from API
    if (!data) {
      const freshData = await fetchTennisData();
      return res.json({
        success: true,
        data: freshData,
        source: "api",
      });
    }

    res.json({
      success: true,
      data: data,
      source: "redis",
    });
  } catch (error) {
    console.error("Error getting tennis data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tennis data",
    });
  }
};

// Controller to get all sports data
export const getAllSportsDataController = async (
  req: Request,
  res: Response
) => {
  try {
    const data = await getAllSportsData();

    // Check if any data is missing and fetch if needed
    let fetchedFromApi = false;
    const sports: any[] = ["cricket", "soccer", "tennis"];

    for (const sport of sports) {
      if (!data[sport]) {
        fetchedFromApi = true;
        switch (sport) {
          case "cricket":
            data.cricket = await fetchCricketData();
            break;
          case "soccer":
            data.soccer = await fetchSoccerData();
            break;
          case "tennis":
            data.tennis = await fetchTennisData();
            break;
        }
      }
    }

    res.json({
      success: true,
      data: data,
      source: fetchedFromApi ? "mixed" : "redis",
    });
  } catch (error) {
    console.error("Error getting all sports data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sports data",
    });
  }
};

// Controller to get odds data
export const getOddsData = async (req: Request, res: Response) => {
  try {
    const { sportId, eventId } = req.params;

    let data = null;
    let source = "api";

    // Step 1: Check for d247_{eventId} pattern in Redis first (provider data)
    data = await getProviderDataFromRedis(eventId);
    if (data) {
      console.log(
        `[ODDS] Found provider data for event ${eventId} in Redis key: d247_${eventId}`
      );
      source = "provider_redis";
    } else {
      // Step 2: Try to get from existing odds Redis cache
      data = await getOddsFromRedis(sportId, eventId);
      if (data) {
        source = "odds_redis";
      }
    }

    // Step 3: If not found in Redis, fetch from third-party API
    if (!data) {
      console.log(
        `[ODDS] No data found in Redis for event ${eventId}, fetching from API`
      );
      const result = await processOddsData(sportId, eventId);

      if (result.success) {
        data = result.data;
        source = "api";
      } else {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch odds data",
          error: result.error,
        });
      }
    }

    res.json({
      success: true,
      sport_id: sportId,
      event_id: eventId,
      data: data,
      source: source,
      monitored: true,
      redis_key: source === "provider_redis" ? `d247_${eventId}` : undefined,
    });
  } catch (error) {
    console.error("Error getting odds data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch odds data",
    });
  }
};

export const getFIlteredData = async (req: Request, res: Response) => {
  try {
    let data = await getFilteredIPlayMatches(10);

    if (!data) {
      return res.status(400).json({
        success: false,
        message: "No active match present",
      });
    }

    res.status(200).json({
      success: true,
      message: "Successfully fetched result",
      data,
    });
  } catch (error) {
    console.error("Error getting odds data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch odds data",
    });
  }
};

export const getCricketScore = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.query;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "EventId is required",
      });
    }

    console.log(`[CRICKET_SCORE] Fetching score for eventId: ${eventId}`);

    // Fetch cricket data from API
    const betFairData = await axios(
      `${process.env.THIRD_PARTY_URL}/api/new/cricketnew`
    );

    console.log(`[CRICKET_SCORE] BetFair data received:`, {
      success: betFairData?.data?.success,
      dataLength: betFairData?.data?.data?.length || 0
    });

    // Find the gameId for the given eventId
    const gameId = betFairData?.data?.data?.find(
      (item: any) => item.eventid === parseInt(eventId as string)
    )?.gameId;

    console.log(`[CRICKET_SCORE] Found gameId: ${gameId} for eventId: ${eventId}`);

    if (!gameId) {
      return res.status(404).json({
        success: false,
        message: "Game not found for the given eventId",
        eventId: eventId,
        betFairData: betFairData?.data,
      });
    }

    // Fetch score data using the gameId
    const freshData = await axios(
      `${process.env.THIRD_PARTY_URL}/api/new/GetCricketScoreDiamoand?eventid=${gameId}`
    );

    console.log(`[CRICKET_SCORE] Score data received:`, {
      success: freshData?.data?.success,
      dataLength: freshData?.data?.data?.length || 0,
      hasData: !!freshData?.data?.data
    });

    // Check if score data is available
    if (!freshData?.data?.data || freshData.data.data === "") {
      return res.json({
        success: true,
        data: null,
        message: "Match is not started yet",
        gameId: gameId,
        eventId: eventId,
        // betFairData: betFairData?.data,
      });
    }

    return res.json({
      success: true,
      data: freshData.data.data,
      gameId: gameId,
      eventId: eventId,
      // betFairData: betFairData?.data,
      message: "Fetched cricket score successfully",
    });
  } catch (error) {
    console.error("Error getting cricket score:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cricket score",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
