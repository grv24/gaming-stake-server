import axios from "axios";
import { getRedisClient } from "../../config/redisConfig";

// Define sport types
type SportType = 'cricket' | 'soccer' | 'tennis';

// Function to fetch and store sports data in Redis
export const fetchAndStoreSportsData = async (sportType: SportType) => {
  try {
    const redisClient = getRedisClient();

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

    // Fetch from API
    const response = await axios.get(apiUrl);
    const apiData = response.data;

    // Store data in Redis with expiration
    await redisClient.set(
      `sports:${sportType}:data`,
      JSON.stringify(apiData),
      "EX",
      300 // 5 minutes expiration
    );

    console.log(`[SPORTS] Stored data for ${sportType} in Redis`);
    return apiData;

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

  const redisData = await getSportsData(sportType);

  if (redisData) {
    return redisData;
  }

  return await fetchAndStoreSportsData(sportType);
};

export const getFilteredIPlayMatches = async (limit: number = 10) => {
  try {
    const sports: SportType[] = ['cricket', 'soccer', 'tennis'];
    const allMatches = [];

    for (const sportType of sports) {
      const sportData = await getSportDataWithFallback(sportType);

      if (sportType == 'cricket') {

        const iplayMatches = sportData
          .filter((match: any) => match.iplay === true)
          .map((match: any) => ({
            ...match,
            sportType
          }));

        allMatches.push(...iplayMatches);

      } else {
        if (sportData && sportData.success && sportData.data && sportData.data.t1) {

          const iplayMatches = sportData.data.t1
            .filter((match: any) => match.iplay === true)
            .map((match: any) => ({
              ...match,
              sportType
            }));

          allMatches.push(...iplayMatches);
        }
      }
    }

    return allMatches
      .sort((a, b) => new Date(a.stime).getTime() - new Date(b.stime).getTime())
      .slice(0, limit);

  } catch (error) {
    console.error('Error getting filtered iplay matches:', error);
    return [];
  }
};