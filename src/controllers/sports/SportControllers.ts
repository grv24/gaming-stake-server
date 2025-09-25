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
// import { addEventToMonitor, isEventMonitored, getMonitoredEvents, removeEventFromMonitor } from "../../cron/SportsCronJob";
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
    const startTime = Date.now();
    const redisClient = getRedisClient();
    
    // Check Redis cache first with new key pattern
    const cachedData = await redisClient.get("d247_cricket");
    if (cachedData) {
      console.log("Returning cached cricket data (key: d247_cricket)");
      const parsedData = JSON.parse(cachedData);
      return res.json({
        success: true,
        data: parsedData,
        source: "redis",
        cacheTime: Date.now() - startTime
      });
    }

    // If no data in Redis, fetch from API
    console.log("Cricket data not in cache, fetching from API...");
    const freshData = await fetchCricketData();
    
    // Cache the fresh data for 10 minutes
    if (freshData) {
      await redisClient.setex("d247_cricket", 600, JSON.stringify(freshData));
      console.log("Cached fresh cricket data for 10 minutes");
    }
    
    const totalTime = Date.now() - startTime;
    res.json({
      success: true,
      data: freshData,
      source: "api",
      processingTime: totalTime
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
    const startTime = Date.now();
    const redisClient = getRedisClient();
    
    // Check Redis cache first with new key pattern
    const cachedData = await redisClient.get("d247_soccer");
    if (cachedData) {
      console.log("Returning cached soccer data (key: d247_soccer)");
      const parsedData = JSON.parse(cachedData);
      return res.json({
        success: true,
        data: parsedData,
        source: "redis",
        cacheTime: Date.now() - startTime
      });
    }

    // If no data in Redis, fetch from API
    console.log("Soccer data not in cache, fetching from API...");
    const freshData = await fetchSoccerData();
    
    // Cache the fresh data for 10 minutes
    if (freshData) {
      await redisClient.setex("d247_soccer", 600, JSON.stringify(freshData));
      console.log("Cached fresh soccer data for 10 minutes");
    }
    
    const totalTime = Date.now() - startTime;
    res.json({
      success: true,
      data: freshData,
      source: "api",
      processingTime: totalTime
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
    const startTime = Date.now();
    const redisClient = getRedisClient();
    
    // Check Redis cache first with new key pattern
    const cachedData = await redisClient.get("d247_tennis");
    if (cachedData) {
      console.log("Returning cached tennis data (key: d247_tennis)");
      const parsedData = JSON.parse(cachedData);
      return res.json({
        success: true,
        data: parsedData,
        source: "redis",
        cacheTime: Date.now() - startTime
      });
    }

    // If no data in Redis, fetch from API
    console.log("Tennis data not in cache, fetching from API...");
    const freshData = await fetchTennisData();
    
    // Cache the fresh data for 10 minutes
    if (freshData) {
      await redisClient.setex("d247_tennis", 600, JSON.stringify(freshData));
      console.log("Cached fresh tennis data for 10 minutes");
    }
    
    const totalTime = Date.now() - startTime;
    res.json({
      success: true,
      data: freshData,
      source: "api",
      processingTime: totalTime
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
    const startTime = Date.now();
    const redisClient = getRedisClient();
    
    // Check Redis cache first for all sports combined
    const cachedAllSports = await redisClient.get("d247_all_sports");
    if (cachedAllSports) {
      console.log("Returning cached all sports data (key: d247_all_sports)");
      const parsedData = JSON.parse(cachedAllSports);
      return res.json({
        success: true,
        data: parsedData,
        source: "redis",
        cacheTime: Date.now() - startTime
      });
    }

    // If not in cache, fetch all sports data concurrently
    console.log("All sports data not in cache, fetching from API...");
    const [cricketData, soccerData, tennisData] = await Promise.all([
      fetchCricketData(),
      fetchSoccerData(),
      fetchTennisData()
    ]);

    const allSportsData = {
      cricket: cricketData,
      soccer: soccerData,
      tennis: tennisData
    };

    // Cache the combined data for 10 minutes
    await redisClient.setex("d247_all_sports", 600, JSON.stringify(allSportsData));
    console.log("Cached fresh all sports data for 10 minutes");
    
    const totalTime = Date.now() - startTime;
    res.json({
      success: true,
      data: allSportsData,
      source: "api",
      processingTime: totalTime
    });
  } catch (error) {
    console.error("Error getting all sports data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all sports data",
    });
  }
};

// Controller to get odds data
export const getOddsData = async (req: Request, res: Response) => {
  try {
    const { sportId, eventId } = req.params;

    // Add to monitoring if not already present
    // if (!isEventMonitored(sportId, eventId)) {
    //   addEventToMonitor(sportId, eventId);
    // }

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
    const startTime = Date.now();
    const redisClient = getRedisClient();
    
    // Check Redis cache first
    const cachedFilteredData = await redisClient.get("d247_filtered_matches");
    if (cachedFilteredData) {
      const parsedData = JSON.parse(cachedFilteredData);
      if (parsedData && parsedData.length > 0) {
        console.log("Returning cached filtered matches data (key: d247_filtered_matches)");
        return res.json({
          success: true,
          message: "Successfully fetched result",
          data: parsedData,
          source: "redis",
          cacheTime: Date.now() - startTime
        });
      } else {
        console.log("Cached filtered matches data is empty, clearing cache and fetching fresh data");
        await redisClient.del("d247_filtered_matches");
      }
    }

    // If not in cache, fetch from service
    console.log("Filtered matches data not in cache, fetching from service...");
    let data = await getFilteredIPlayMatches(10);

    if (!data || data.length === 0) {
      console.log("No filtered matches found, clearing cache and retrying...");
      // Clear the cache and try again
      await redisClient.del("d247_filtered_matches");
      data = await getFilteredIPlayMatches(10);
    }

    if (!data || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No active match present",
      });
    }

    // Cache the filtered data for 5 minutes
    await redisClient.setex("d247_filtered_matches", 300, JSON.stringify(data));
    console.log("Cached fresh filtered matches data for 5 minutes");

    const totalTime = Date.now() - startTime;
    res.status(200).json({
      success: true,
      message: "Successfully fetched result",
      data,
      source: "api",
      processingTime: totalTime
    });
  } catch (error) {
    console.error("Error getting filtered data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch filtered data",
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
