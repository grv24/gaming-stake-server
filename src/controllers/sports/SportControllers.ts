import { Request, Response } from "express";
import {
  fetchCricketData,
  fetchSoccerData,
  fetchTennisData,
  fetchAllSportsData,
  getSportsData,
  getAllSportsData
} from "../../services/sports/SportService";
import { addEventToMonitor, isEventMonitored, getMonitoredEvents, removeEventFromMonitor } from "../../cron/SportsCronJob";
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
    if (!isEventMonitored(sportId, eventId)) {
      addEventToMonitor(sportId, eventId);
    }
    
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

// Controller to manually refresh odds data
// export const refreshOddsData = async (req: Request, res: Response) => {
//   try {
//     const { sportId, eventId } = req.params;
    
//     // Add to monitoring if not already present
//     if (!isEventMonitored(sportId, eventId)) {
//       addEventToMonitor(sportId, eventId);
//     }
    
//     // Fetch from API
//     const result = await processOddsData(sportId, eventId);
    
//     if (result.success) {
//       res.json({
//         success: true,
//         message: 'Odds data refreshed successfully',
//         data: result.data,
//         monitored: true
//       });
//     } else {
//       res.status(500).json({
//         success: false,
//         message: 'Failed to refresh odds data',
//         error: result.error
//       });
//     }
//   } catch (error) {
//     console.error('Error refreshing odds data:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to refresh odds data'
//     });
//   }
// };

// Controller to get all monitored events
// export const fetchMonitoredEvents = async (req: Request, res: Response) => {
//   try {
//     const events = getMonitoredEvents();
    
//     res.json({
//       success: true,
//       events: events,
//       count: events.length
//     });
//   } catch (error) {
//     console.error('Error getting monitored events:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to get monitored events'
//     });
//   }
// };

// Controller to add event to monitoring
// export const addEventToMonitoring = async (req: Request, res: Response) => {
//   try {
//     const { sportId, eventId } = req.body;
    
//     if (!sportId || !eventId) {
//       return res.status(400).json({
//         success: false,
//         message: 'sportId and eventId are required'
//       });
//     }
    
//     // const {} = await import("./oddsCron");
    
//     if (!isEventMonitored(sportId, eventId)) {
//       addEventToMonitor(sportId, eventId);
      
//       // Immediately fetch data for the new event
//       // const { processOddsData } = await import("./oddsService");
//       await processOddsData(sportId, eventId);
      
//       res.json({
//         success: true,
//         message: `Added event to monitoring: sport ${sportId}, event ${eventId}`,
//         monitored: true
//       });
//     } else {
//       res.json({
//         success: true,
//         message: `Event already monitored: sport ${sportId}, event ${eventId}`,
//         monitored: true
//       });
//     }
//   } catch (error) {
//     console.error('Error adding event to monitoring:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to add event to monitoring'
//     });
//   }
// };

// Controller to remove event from monitoring
// export const removeEventFromMonitoring = async (req: Request, res: Response) => {
//   try {
//     const { sportId, eventId } = req.body;
    
//     if (!sportId || !eventId) {
//       return res.status(400).json({
//         success: false,
//         message: 'sportId and eventId are required'
//       });
//     }
    
//     // const { removeEventFromMonitor, isEventMonitored } = await import("./oddsCron");
    
//     if (isEventMonitored(sportId, eventId)) {
//       removeEventFromMonitor(sportId, eventId);
      
//       res.json({
//         success: true,
//         message: `Removed event from monitoring: sport ${sportId}, event ${eventId}`,
//         monitored: false
//       });
//     } else {
//       res.json({
//         success: true,
//         message: `Event not monitored: sport ${sportId}, event ${eventId}`,
//         monitored: false
//       });
//     }
//   } catch (error) {
//     console.error('Error removing event from monitoring:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to remove event from monitoring'
//     });
//   }
// };

// Controller to refresh sports data
// export const refreshSportsData = async (req: Request, res: Response) => {
//   try {
//     const { sportType } = req.params;
    
//     let result;
//     switch (sportType) {
//       case 'cricket':
//         result = await fetchCricketData();
//         break;
//       case 'soccer':
//         result = await fetchSoccerData();
//         break;
//       case 'tennis':
//         result = await fetchTennisData();
//         break;
//       case 'all':
//         result = await fetchAllSportsData();
//         break;
//       default:
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid sport type. Use cricket, soccer, tennis, or all'
//         });
//     }
    
//     res.json({
//       success: true,
//       message: `Refreshed data for ${sportType}`,
//       data: result
//     });
//   } catch (error) {
//     console.error('Error refreshing sports data:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to refresh sports data'
//     });
//   }
// };


// export const getSportsList = async (req: Request, res: Response) => {
//     try {
//         const { sport_id } = req.query;

//         if (!sport_id) {
//             return res.status(400).json({
//                 status: "error",
//                 message: "sport_id is required",
//             });
//         }

//         const redisClient = getRedisClient();
//         const cacheKey = `sports:${sport_id}`;

//         const cachedData = await redisClient.get(cacheKey);
//         if (cachedData) {
//             return res.status(200).json({
//                 status: "success",
//                 message: "Sports list fetched from cache",
//                 data: JSON.parse(cachedData),
//             });
//         }

//         const response = await axios.get(
//             `http://localhost:8085/api/new/getlistdata`,
//             { params: { sport_id } }
//         );

//         const apiData = response.data;

//         console.log("-------------------- API data (sports) --------------------", apiData);

//         await redisClient.set(cacheKey, JSON.stringify(apiData), "EX", 600);

//         return res.status(200).json({
//             status: "success",
//             message: "Sports list fetched successfully",
//             data: apiData,
//         });
//     } catch (err: any) {
//         console.error("Error fetching sports list:", err.message);

//         return res.status(500).json({
//             status: "error",
//             message: "Internal Server Error",
//             error:
//                 process.env.NODE_ENV === "development" ? err.message : undefined,
//         });
//     }
// };
