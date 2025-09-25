import axios from "axios";
import { getRedisClient } from "../../config/redisConfig";

// Define sport types
type SportType = 'cricket' | 'soccer' | 'tennis';

// Function to fetch and store sports data in Redis
export const fetchAndStoreSportsData = async (sportType: SportType) => {
  try {
    const redisClient = getRedisClient();

    // Check Redis cache first with new key pattern
    const cachedMatches = await redisClient.get(`d247_${sportType}`);
    if (cachedMatches) {
      console.log(`[SPORTS] Returning cached ${sportType} data from Redis (key: d247_${sportType})`);
      return JSON.parse(cachedMatches);
    }

    let apiUrl = '';

    // Determine API endpoint based on sport type
    switch (sportType) {
      case 'cricket':
        apiUrl = `${process.env.THIRD_PARTY_URL}/api/new/getlistdata?sport_id=4`;
        break;
      case 'soccer':
        apiUrl = `${process.env.THIRD_PARTY_URL}/api/new/getlistdata?sport_id=1`;
        break;
      case 'tennis':
        apiUrl = `${process.env.THIRD_PARTY_URL}/api/new/getlistdata?sport_id=2`;
        break;
      default:
        throw new Error(`Unknown sport type: ${sportType}`);
    }

    console.log(`[SPORTS] Fetching ${sportType} data from API...`);
    const startTime = Date.now();

    // Fetch from API
    const response = await axios.get(apiUrl);
    const apiData = response.data;

    // Extract actual match data from the API response
    let matchData = [];
    console.log(`[SPORTS] API response structure for ${sportType}:`, {
      hasData: !!apiData,
      dataType: typeof apiData,
      hasDataProperty: !!(apiData && apiData.data),
      hasT1Property: !!(apiData && apiData.data && apiData.data.t1),
      isArray: Array.isArray(apiData),
      dataKeys: apiData ? Object.keys(apiData) : 'No data'
    });
    
    if (apiData && apiData.data && apiData.data.t1) {
      matchData = apiData.data.t1;
      console.log(`[SPORTS] Extracted ${matchData.length} matches from ${sportType} API response (t1 property)`);
    } else if (apiData && Array.isArray(apiData)) {
      // Fallback for cricket data which might be directly an array
      matchData = apiData;
      console.log(`[SPORTS] Using ${sportType} data directly as array (${matchData.length} matches)`);
    } else if (apiData && apiData.data && Array.isArray(apiData.data)) {
      // Another fallback - data might be directly in apiData.data
      matchData = apiData.data;
      console.log(`[SPORTS] Using ${sportType} data from apiData.data (${matchData.length} matches)`);
    } else {
      console.warn(`[SPORTS] No valid data structure found for ${sportType}:`, {
        apiData: apiData,
        hasData: !!(apiData && apiData.data),
        dataType: typeof apiData,
        dataKeys: apiData ? Object.keys(apiData) : 'No keys'
      });
    }

    // Store both full API data and extracted match data in Redis with new key pattern
    await redisClient.set(
      `d247_${sportType}_full`,
      JSON.stringify(apiData),
      "EX",
      600 // 10 minutes expiration
    );
    
    await redisClient.set(
      `d247_${sportType}`,
      JSON.stringify(matchData),
      "EX",
      600 // 10 minutes expiration
    );

    const fetchTime = Date.now() - startTime;
    console.log(`[SPORTS] Fetched and stored ${sportType} data in ${fetchTime}ms. Found ${matchData.length} matches.`);
    return matchData;

  } catch (err: any) {
    console.error(`[SPORTS] Failed to fetch data for ${sportType}:`, err.message);
    return null;
  }
};

// Individual functions for each sport
export const fetchCricketData = async () => {
  return fetchAndStoreSportsData('cricket');
};

export const fetchSoccerData = async () => {
  return fetchAndStoreSportsData('soccer');
};

export const fetchTennisData = async () => {
  return fetchAndStoreSportsData('tennis');
};

// Function to fetch all sports data
export const fetchAllSportsData = async () => {
  try {
    const results = await Promise.allSettled([
      fetchCricketData(),
      fetchSoccerData(),
      fetchTennisData()
    ]);

    return results.map(result =>
      result.status === 'fulfilled' ? result.value : null
    );
  } catch (error) {
    console.error('Error fetching all sports data:', error);
    return [];
  }
};

// Function to get sports data from Redis
export const getSportsData = async (sportType: SportType) => {
  try {
    const redisClient = getRedisClient();
    const data = await redisClient.get(`sports:${sportType}:data`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error getting data for ${sportType}:`, error);
    return null;
  }
};

// Function to get all sports data from Redis
export const getAllSportsData = async () => {
  try {
    const redisClient = getRedisClient();
    const sports: SportType[] = ['cricket', 'soccer', 'tennis'];
    const result: Record<string, any> = {};

    for (const sport of sports) {
      const data = await redisClient.get(`sports:${sport}:data`);
      result[sport] = data ? JSON.parse(data) : null;
    }

    return result;
  } catch (error) {
    console.error('Error getting all sports data:', error);
    return {};
  }
};

const getSportDataWithFallback = async (sportType: SportType) => {
  const redisClient = getRedisClient();
  
  // Check Redis cache with new key pattern
  const cachedData = await redisClient.get(`d247_${sportType}`);
  if (cachedData) {
    console.log(`[FILTERED] Using cached ${sportType} data for filtered matches`);
    return JSON.parse(cachedData);
  }

  // If not in cache, fetch fresh data
  console.log(`[FILTERED] No cached ${sportType} data, fetching fresh data`);
  return await fetchAndStoreSportsData(sportType);
};

export const getFilteredIPlayMatches = async (limit: number = 10) => {
  try {
    const sports: SportType[] = ['cricket', 'soccer', 'tennis'];
    const allMatches = [];

    for (const sportType of sports) {
      const sportData = await getSportDataWithFallback(sportType);
      
      console.log(`[FILTERED] Processing ${sportType} data:`, {
        hasData: !!sportData,
        isArray: Array.isArray(sportData),
        length: sportData ? sportData.length : 'No data',
        dataType: typeof sportData
      });

      // Extract match data - now all sports should return arrays directly
      let matchData = sportData;
      if (sportData && typeof sportData === 'object' && sportData.data && sportData.data.t1) {
        matchData = sportData.data.t1;
        console.log(`[FILTERED] Extracted ${matchData.length} ${sportType} matches from API response`);
      } else if (sportData && Array.isArray(sportData)) {
        matchData = sportData;
        console.log(`[FILTERED] Using ${sportType} data directly as array (${matchData.length} matches)`);
      } else if (sportData && typeof sportData === 'object' && sportData.data && Array.isArray(sportData.data)) {
        matchData = sportData.data;
        console.log(`[FILTERED] Using ${sportType} data from sportData.data (${matchData.length} matches)`);
      } else {
        console.warn(`[FILTERED] No valid data structure found for ${sportType}:`, sportData);
        continue;
      }

      // Filter for iplay matches
      if (matchData && Array.isArray(matchData)) {
        const iplayMatches = matchData
          .filter((match: any) => match.iplay === true)
          .map((match: any) => ({
            ...match,
            sportType
          }));

        console.log(`[FILTERED] Found ${iplayMatches.length} iplay matches for ${sportType}`);
        allMatches.push(...iplayMatches);
      }
    }

    // Sort by start time and limit results
    const sortedMatches = allMatches
      .sort((a, b) => new Date(a.stime).getTime() - new Date(b.stime).getTime())
      .slice(0, limit);

    console.log(`[FILTERED] Returning ${sortedMatches.length} filtered matches`);
    return sortedMatches;

  } catch (error) {
    console.error('Error getting filtered iplay matches:', error);
    return [];
  }
};


export const betSettlement = async (betId: string) => {
  try {

    
    return null;
  } catch (error) {
    console.error('Error settling bet:', error);
    return null;
  }
};