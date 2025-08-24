import axios from "axios";
import { getRedisClient } from "../../config/redisConfig";
import { getRedisPublisher } from "../../config/redisPubSub";

// Function to fetch odds data from API
export const fetchOddsData = async (sportId: string, eventId: string) => {
  try {
    const apiUrl = `http://localhost:8085/api/new/getdataodds?sport_id=${sportId}&eventid=${eventId}`;
    
    // Fetch from API
    const response = await axios.get(apiUrl, { timeout: 5000 });
    const apiData = response.data;

    return {
      success: true,
      sport_id: sportId,
      event_id: eventId,
      data: apiData,
      timestamp: Date.now()
    };
  } catch (err: any) {
    console.error(`[ODDS] Failed to fetch odds for sport ${sportId}, event ${eventId}:`, err.message);
    return {
      success: false,
      sport_id: sportId,
      event_id: eventId,
      error: err.message,
      timestamp: Date.now()
    };
  }
};

// Function to store odds data in Redis
export const storeOddsInRedis = async (sportId: string, eventId: string, data: any) => {
  try {
    const redisClient = getRedisClient();

    // Store with individual keys for sport and event
    await redisClient.set(
      `odds:sport:${sportId}:event:${eventId}`,
      JSON.stringify(data),
      "EX",
      10 // 10 seconds expiration
    );

    console.log(`[ODDS] Stored data for sport ${sportId}, event ${eventId} in Redis`);
    return true;
  } catch (error) {
    console.error(`[ODDS] Error storing data in Redis:`, error);
    return false;
  }
};

// Function to publish odds update via Redis Pub/Sub
export const publishOddsUpdate = async (sportId: string, eventId: string, data: any) => {
  try {
    const redisPublisher = getRedisPublisher();

    await redisPublisher.publish(
      `sports_odds_updates`,
      JSON.stringify({
        type: 'sports_odds_updates',
        sport_id: sportId,
        event_id: eventId,
        data: data,
        timestamp: Date.now()
      })
    );

    console.log(`[ODDS] Published update for sport ${sportId}, event ${eventId}`);
    return true;
  } catch (error) {
    console.error(`[ODDS] Error publishing update:`, error);
    return false;
  }
};

// Function to process odds for a specific sport and event
export const processOddsData = async (sportId: string, eventId: string) => {
  try {
    // Fetch data from API
    const oddsData = await fetchOddsData(sportId, eventId);
    
    if (oddsData.success) {
      // Store in Redis
      await storeOddsInRedis(sportId, eventId, oddsData.data);
      
      // Publish update
      await publishOddsUpdate(sportId, eventId, oddsData.data);
      
      return oddsData;
    }
    
    return oddsData;
  } catch (error) {
    console.error(`[ODDS] Error processing data for sport ${sportId}, event ${eventId}:`, error);
    return {
      success: false,
      sport_id: sportId,
      event_id: eventId,
      error: 'Processing error',
      timestamp: Date.now()
    };
  }
};

// Function to get odds data from Redis
export const getOddsFromRedis = async (sportId: string, eventId: string) => {
  try {
    const redisClient = getRedisClient();
    
    // Get specific event data
    const data = await redisClient.get(`odds:sport:${sportId}:event:${eventId}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`[ODDS] Error getting data from Redis:`, error);
    return null;
  }
};