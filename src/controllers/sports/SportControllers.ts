import { Request, Response } from "express";
import {
  fetchCricketData,
  fetchSoccerData,
  fetchTennisData,
  fetchAllSportsData,
  getSportsData,
  getAllSportsData,
  getFilteredIPlayMatches
} from "../../services/sports/SportService";
// import { addEventToMonitor, isEventMonitored, getMonitoredEvents, removeEventFromMonitor } from "../../cron/SportsCronJob";
import { getOddsFromRedis, processOddsData } from "../../services/sports/OddsService";

// Controller to get cricket data
export const getCricketData = async (req: Request, res: Response) => {
  try {
    const data = await getSportsData('cricket');

    // If no data in Redis, fetch from API
    if (!data) {
      const freshData = await fetchCricketData();
      return res.json({
        success: true,
        data: freshData,
        source: 'api'
      });
    }

    res.json({
      success: true,
      data: data,
      source: 'redis'
    });
  } catch (error) {
    console.error('Error getting cricket data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cricket data'
    });
  }
};

// Controller to get soccer data
export const getSoccerData = async (req: Request, res: Response) => {
  try {
    const data = await getSportsData('soccer');

    // If no data in Redis, fetch from API
    if (!data) {
      const freshData = await fetchSoccerData();
      return res.json({
        success: true,
        data: freshData,
        source: 'api'
      });
    }

    res.json({
      success: true,
      data: data,
      source: 'redis'
    });
  } catch (error) {
    console.error('Error getting soccer data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch soccer data'
    });
  }
};

// Controller to get tennis data
export const getTennisData = async (req: Request, res: Response) => {
  try {
    const data = await getSportsData('tennis');

    // If no data in Redis, fetch from API
    if (!data) {
      const freshData = await fetchTennisData();
      return res.json({
        success: true,
        data: freshData,
        source: 'api'
      });
    }

    res.json({
      success: true,
      data: data,
      source: 'redis'
    });
  } catch (error) {
    console.error('Error getting tennis data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tennis data'
    });
  }
};

// Controller to get all sports data
export const getAllSportsDataController = async (req: Request, res: Response) => {
  try {
    const data = await getAllSportsData();

    // Check if any data is missing and fetch if needed
    let fetchedFromApi = false;
    const sports: any[] = ['cricket', 'soccer', 'tennis'];

    for (const sport of sports) {
      if (!data[sport]) {
        fetchedFromApi = true;
        switch (sport) {
          case 'cricket':
            data.cricket = await fetchCricketData();
            break;
          case 'soccer':
            data.soccer = await fetchSoccerData();
            break;
          case 'tennis':
            data.tennis = await fetchTennisData();
            break;
        }
      }
    }

    res.json({
      success: true,
      data: data,
      source: fetchedFromApi ? 'mixed' : 'redis'
    });
  } catch (error) {
    console.error('Error getting all sports data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sports data'
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

    // Try to get from Redis first
    let data = await getOddsFromRedis(sportId, eventId);

    if (!data) {
      // If not in Redis, fetch from API
      const result = await processOddsData(sportId, eventId);

      if (result.success) {
        data = result.data;
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch odds data',
          error: result.error
        });
      }
    }

    res.json({
      success: true,
      sport_id: sportId,
      event_id: eventId,
      data: data,
      source: 'redis',
      monitored: true
    });
  } catch (error) {
    console.error('Error getting odds data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch odds data'
    });
  }
};


export const getFIlteredData = async (req: Request, res: Response) => {
  try {
    let data = await getFilteredIPlayMatches(10);

    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'No active match present'
      });
    }

    res.status(200).json({
      success: true,
      message: "Successfully fetched result",
      data
    });
  } catch (error) {
    console.error('Error getting odds data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch odds data'
    });
  }
};
