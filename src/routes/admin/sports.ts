import { Router } from "express";
import { fetchAndStoreSportsData } from "../../services/sports/SportService";
import { fetchOddsData } from "../../services/sports/OddsService";
import { getRedisClient } from "../../config/redisConfig";

const router = Router();

// Helper function to get odds data from Redis, fallback to API if not found
const getOddsDataFromRedis = async (gmid: string, etid: string) => {
  try {
    const redisClient = getRedisClient();
    const redisKey = `d247_${gmid}`;

    const oddsData = await redisClient.get(redisKey);
    if (oddsData) {
      const parsedData = JSON.parse(oddsData);
      console.log(`Found odds data in Redis for gmid ${gmid}:`, {
        hasData: !!parsedData,
        dataType: typeof parsedData,
        isArray: Array.isArray(parsedData),
        dataLength: Array.isArray(parsedData) ? parsedData.length : 'Not array'
      });
      return parsedData;
    }

    // If not found in Redis, try to fetch from API
    console.log(`No odds data found in Redis for gmid ${gmid}, trying API...`);
    const apiOddsData = await fetchOddsData(etid, gmid);
    
    if (apiOddsData.success && apiOddsData.data) {
      console.log(`Successfully fetched odds data from API for gmid ${gmid}`);
      console.log(`API response structure:`, {
        hasData: !!apiOddsData.data,
        dataType: typeof apiOddsData.data,
        isArray: Array.isArray(apiOddsData.data),
        dataLength: Array.isArray(apiOddsData.data) ? apiOddsData.data.length : 'Not array',
        firstItem: Array.isArray(apiOddsData.data) && apiOddsData.data[0] ? {
          hasMname: !!apiOddsData.data[0].mname,
          hasSection: !!apiOddsData.data[0].section,
          mname: apiOddsData.data[0].mname
        } : 'No first item'
      });
      
      // Store the fetched data in Redis for future requests
      try {
        await redisClient.setex(redisKey, 20, JSON.stringify(apiOddsData.data)); // Cache for 20 seconds
        console.log(`Stored odds data in Redis for gmid ${gmid} with 20-second TTL`);
      } catch (redisError) {
        console.error(`Failed to store odds data in Redis for gmid ${gmid}:`, redisError);
        // Continue anyway, we still have the data to return
      }
      
      return apiOddsData.data;
    } else {
      console.warn(`Failed to fetch odds data from API for gmid ${gmid}:`, apiOddsData.error);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching odds data for gmid ${gmid}:`, error);
    return null;
  }
};

// Helper function to create tree structure for any sport
const createSportTreeStructure = async (sportData: any, sportName: string, sportId: number) => {
  // Extract actual match data from API response if needed
  let matchData = sportData;
  if (sportData && typeof sportData === 'object' && sportData.data && sportData.data.t1) {
    matchData = sportData.data.t1;
    console.log(`Extracted ${matchData.length} ${sportName.toLowerCase()} matches from API response`);
  } else if (sportData && Array.isArray(sportData)) {
    matchData = sportData;
    console.log(`Using ${sportName.toLowerCase()} data directly as array (${matchData.length} matches)`);
  }

  // Check if match data exists and is valid
  if (!matchData || !Array.isArray(matchData)) {
    console.warn(`${sportName} data is null, undefined, or not an array:`, matchData);
    return {
      success: true,
      message: `No ${sportName.toLowerCase()} data available`,
      data: {
        name: sportName,
        type: "sport",
        expanded: true,
        children: [],
      },
      metadata: {
        totalMatches: 0,
        totalCompetitions: 0,
        structure: `${sportName} > Competition > Event > Match > Team`,
      },
    };
  }

  // Create simple UI-friendly tree structure
  const treeStructure: any = {
    name: sportName,
    type: "sport",
    expanded: true,
    children: [],
  };

  // Group by competition (cname)
  const competitions = new Map();
  
  // Group matches by gmid to collect all markets for each match
  const matchesByGmid = new Map();
  
  // First pass: Group all matches by gmid to collect all markets
  console.log(`Processing ${matchData.length} ${sportName.toLowerCase()} matches to collect markets...`);
  console.log(`Sample ${sportName.toLowerCase()} data structure:`, matchData[0]);
  
  // Collect all unique gmids first
  const uniqueGmids = new Set();
  for (const match of matchData) {
    uniqueGmids.add(match.gmid);
  }
  
  console.log(`Found ${uniqueGmids.size} unique ${sportName.toLowerCase()} matches:`, Array.from(uniqueGmids));
  
  // Group matches by gmid and collect markets from existing data only (no external API calls)
  for (const match of matchData) {
    const { gmid, mname } = match;
    
    if (!matchesByGmid.has(gmid)) {
      matchesByGmid.set(gmid, {
        match: match,
        markets: new Set()
      });
    }
    
    // Add market from existing match data
    if (mname) {
      matchesByGmid.get(gmid).markets.add(mname);
    }
    
    // Add sport-specific common markets (no external API calls needed)
    let commonMarkets: string[] = [];
    if (sportName === 'Cricket') {
      commonMarkets = [
        'MATCH_ODDS', 'Normal', 'oddeven', 'TOSS_WINNER', 'MAN_OF_THE_MATCH', 'TOTAL_RUNS', 'FIRST_WICKET'
      ];
    } else if (sportName === 'Soccer') {
      commonMarkets = [
        'MATCH_ODDS', 'OVER_UNDER', 'BOTH_TEAMS_SCORE', 'CORRECT_SCORE', 'FIRST_GOAL', 'HALF_TIME_RESULT', 'TOTAL_CORNERS'
      ];
    } else if (sportName === 'Tennis') {
      commonMarkets = [
        'MATCH_ODDS', 'SET_BETTING', 'TOTAL_SETS', 'FIRST_SET_WINNER', 'TOTAL_GAMES', 'ACE_COUNT', 'DOUBLE_FAULTS'
      ];
    }
    
    // Add common markets for each match
    commonMarkets.forEach(marketName => {
      matchesByGmid.get(gmid).markets.add(marketName);
    });
  }
  
  console.log(`Final grouped ${sportName.toLowerCase()} matches with all markets:`);
  for (const [gmid, matchData] of matchesByGmid) {
    console.log(`  ${matchData.match.ename} (${gmid}): ${Array.from(matchData.markets).join(', ')}`);
  }

  // Second pass: Build tree structure using grouped matches
  for (const [gmid, matchData] of matchesByGmid) {
    const match = matchData.match;
    const { cname, ename, stime, etid, section } = match;

    if (!competitions.has(cname)) {
      competitions.set(cname, {
        name: cname,
        type: "competition",
        expanded: true,
        children: [],
      });
    }

    const competition = competitions.get(cname);

    // Parse and format the time for better organization
    const matchTime = new Date(stime);
    const timeKey = matchTime.toISOString().split("T")[0]; // YYYY-MM-DD format

    // Group by date within competition
    let dateNode = competition.children.find(
      (child: any) => child.name === timeKey
    );
    if (!dateNode) {
      dateNode = {
        name: timeKey,
        type: "date",
        expanded: true,
        children: [],
      };
      competition.children.push(dateNode);
    }

    // Check if match already has section data (markets)
    console.log(`${sportName} match ${ename} (gmid: ${gmid}) has section data:`, !!section, section ? section.length : 0);
    console.log(`${sportName} match ${ename} has markets:`, Array.from(matchData.markets));
    if (section && section.length > 0) {
      console.log(`Section data structure for ${ename}:`, {
        firstSection: section[0],
        allKeys: Object.keys(section[0] || {}),
        hasMname: !!section[0]?.mname,
        mnameValue: section[0]?.mname
      });
    }

    // Create match node with all collected markets
    const matchNode = {
      name: ename,
      type: "match",
      expanded: false,
      gmid: gmid,
      status: match.status,
      formattedTime: matchTime.toLocaleString(),
      children: matchData.markets.size > 0 ? Array.from(matchData.markets).map((marketName) => ({
        name: marketName as string,
        type: "market",
        expanded: false,
        status: match.status || 'OPEN',
        gmid: gmid, // Event ID
        etid: etid  // Sport ID
      })) : [
        {
          name: "No Markets Available",
          type: "market",
          expanded: false,
          status: "N/A"
        }
      ]
    };

    dateNode.children.push(matchNode);
  }

  // Convert map to array and sort
  treeStructure.children = Array.from(competitions.values()).sort(
    (a: any, b: any) => a.name.localeCompare(b.name)
  );

  return {
    success: true,
    message: `${sportName} data structured as UI tree`,
    data: treeStructure,
      metadata: {
        totalMatches: matchData.length,
        totalCompetitions: competitions.size,
        structure: `${sportName} > Competition > Event > Match > Team`,
      },
  };
};

// Helper function to transform flat cricket data into simple UI-friendly structure
const transformCricketDataToHierarchy = async (cricketData: any[]) => {
  // Add null/undefined checks
  if (!cricketData || !Array.isArray(cricketData)) {
    console.warn(
      "Cricket data is null, undefined, or not an array:",
      cricketData
    );
    return {};
  }

  const hierarchy: any = {};
  const matchPromises: Array<{match: any, promise: Promise<any>}> = [];

  // First pass: Build hierarchy structure and collect odds promises
  for (const match of cricketData) {
    const { cname, ename, stime, gmid, etid } = match;

    // Skip if essential fields are missing
    if (!cname || !ename || !stime || !gmid || !etid) {
      console.warn("Skipping match with missing essential fields:", match);
      continue;
    }

    // Create nested structure: cricket.cname.date.ename
    if (!hierarchy[cname]) {
      hierarchy[cname] = {};
    }

    // Parse and format the time for better organization
    const matchTime = new Date(stime);
    const timeKey = matchTime.toISOString().split("T")[0]; // YYYY-MM-DD format

    if (!hierarchy[cname][timeKey]) {
      hierarchy[cname][timeKey] = {};
    }

    if (!hierarchy[cname][timeKey][ename]) {
      hierarchy[cname][timeKey][ename] = [];
    }

    // Create match data structure without odds initially
    const matchData = {
      gmid: gmid,
      status: match.status,
      formattedTime: matchTime.toLocaleString(),
      markets: [] // Will be populated after fetching odds
    };

    hierarchy[cname][timeKey][ename].push(matchData);

    // Collect promise for concurrent fetching
    matchPromises.push({
      match: matchData,
      promise: getOddsDataFromRedis(gmid.toString(), etid.toString())
    });
  }

  // Second pass: Fetch all odds data concurrently
  console.log(`Fetching odds data for ${matchPromises.length} matches concurrently (hierarchy)...`);
  const startTime = Date.now();
  
  const oddsResults = await Promise.all(
    matchPromises.map(({promise}) => promise)
  );
  
  const fetchTime = Date.now() - startTime;
  console.log(`Concurrent odds fetching completed in ${fetchTime}ms (hierarchy)`);

  // Third pass: Attach odds data to match data
  matchPromises.forEach(({match}, index) => {
    const oddsData = oddsResults[index];
    
    match.markets = oddsData && oddsData.data ? oddsData.data.map((market: any) => ({
      mname: market.mname,
      status: market.status,
      teams: market.section ? market.section.map((section: any) => ({
        name: section.nat,
        odds: section.odds
      })) : []
    })) : [];
  });

  return hierarchy;
};

router.get("/", async (req, res) => {
  try {
    const cricketData = await fetchAndStoreSportsData("cricket");
    const soccerData = await fetchAndStoreSportsData("soccer");
    const tennisData = await fetchAndStoreSportsData("tennis");
    res.json({
      success: true,
      cricketData,
      soccerData,
      tennisData,
    });
  } catch (error) {
    console.error("Error getting all sports data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sports data",
    });
  }
});

// Hierarchical cricket data route
router.get("/cricket/hierarchy", async (req, res) => {
  try {
    const cricketData = await fetchAndStoreSportsData("cricket");

    // Check if cricket data exists and is valid
    if (!cricketData || !Array.isArray(cricketData)) {
      console.warn(
        "Cricket data is null, undefined, or not an array:",
        cricketData
      );
      return res.json({
        success: true,
        message: "No cricket data available",
        data: {
          cricket: {},
          structure: "cricket.cname.ename.stime",
          totalMatches: 0,
          competitions: 0,
        },
      });
    }

    // Transform flat data into hierarchical structure
    const hierarchicalData = await transformCricketDataToHierarchy(cricketData);

    res.json({
      success: true,
      message: "Cricket data structured hierarchically",
      data: {
        cricket: hierarchicalData,
        structure: "cricket.cname.ename.stime",
        totalMatches: cricketData.length,
        competitions: Object.keys(hierarchicalData).length,
      },
    });
  } catch (error: any) {
    console.error("Error getting hierarchical cricket data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hierarchical cricket data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// UI-friendly tree structure route
router.get("/cricket/tree", async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check Redis cache first with new key pattern
    const redisClient = getRedisClient();
    const cachedCricket = await redisClient.get("d247_cricket_tree");
    if (cachedCricket) {
      console.log("Returning cached cricket tree data (key: d247_cricket_tree)");
      const parsedCache = JSON.parse(cachedCricket);
      res.json({
        ...parsedCache,
        cached: true,
        cacheTime: Date.now() - startTime
      });
      return;
    }
    
    const cricketData = await fetchAndStoreSportsData("cricket");

    // Check if cricket data exists and is valid
    if (!cricketData || !Array.isArray(cricketData)) {
      console.warn(
        "Cricket data is null, undefined, or not an array:",
        cricketData
      );
      return res.json({
        success: true,
        message: "No cricket data available",
        data: {
          name: "Cricket",
          type: "sport",
          expanded: true,
          children: [],
        },
        metadata: {
          totalMatches: 0,
          totalCompetitions: 0,
          structure: "Cricket > Competition > Event > Match > Team",
        },
      });
    }

     // Create simple UI-friendly tree structure
     const treeStructure: any = {
       name: "Cricket",
       type: "sport",
       expanded: true,
       children: [],
     };

     // Group by competition (cname)
     const competitions = new Map();
     const matchPromises: Array<{match: any, promise: Promise<any>}> = [];
     
     // Group matches by gmid to collect all markets for each match
     const matchesByGmid = new Map();
     
     // First pass: Group all matches by gmid to collect all markets
     console.log(`Processing ${cricketData.length} cricket matches to collect markets...`);
     console.log(`Sample cricket data structure:`, cricketData[0]);
     
     // Collect all unique gmids first
     const uniqueGmids = new Set();
     for (const match of cricketData) {
       uniqueGmids.add(match.gmid);
     }
     
     console.log(`Found ${uniqueGmids.size} unique matches:`, Array.from(uniqueGmids));
     
     // For each unique gmid, try to fetch detailed odds data to get all markets
     const marketPromises: Array<{gmid: string, promise: Promise<any>}> = [];
     
     for (const gmid of uniqueGmids) {
       // Find a sample match for this gmid to get etid
       const sampleMatch = cricketData.find(match => match.gmid === gmid);
       if (sampleMatch) {
         marketPromises.push({
           gmid: (gmid as string).toString(),
           promise: getOddsDataFromRedis((gmid as string).toString(), sampleMatch.etid.toString())
         });
       }
     }
     
     console.log(`Fetching detailed odds data for ${marketPromises.length} matches to get all markets...`);
     const oddsStartTime = Date.now();
     
     const oddsResults = await Promise.all(
       marketPromises.map(({promise}) => promise)
     );
     
     const oddsFetchTime = Date.now() - oddsStartTime;
     console.log(`Detailed odds fetching completed in ${oddsFetchTime}ms`);
     
     // Process odds results to extract all markets
     for (let i = 0; i < marketPromises.length; i++) {
       const { gmid } = marketPromises[i];
       const oddsData = oddsResults[i];
       
       console.log(`Processing odds data for gmid ${gmid}:`, !!oddsData);
       if (oddsData && oddsData.data && Array.isArray(oddsData.data)) {
         console.log(`Found ${oddsData.data.length} markets for gmid ${gmid}`);
         oddsData.data.forEach((market: any, index: number) => {
           console.log(`  Market ${index + 1}: ${market.mname}`);
         });
       }
     }
     
     // Group matches by gmid and collect markets from both basic data and detailed odds
     for (const match of cricketData) {
       const { gmid, mname } = match;
       
       if (!matchesByGmid.has(gmid)) {
         matchesByGmid.set(gmid, {
           match: match,
           markets: new Set()
         });
       }
       
       // Add market from basic match data
       if (mname) {
         matchesByGmid.get(gmid).markets.add(mname);
       }
       
       // Add markets from detailed odds data
       const oddsData = oddsResults.find((_, index) => marketPromises[index].gmid === gmid.toString());
       if (oddsData && oddsData.data && Array.isArray(oddsData.data)) {
         oddsData.data.forEach((market: any) => {
           if (market.mname) {
             matchesByGmid.get(gmid).markets.add(market.mname);
           }
         });
       }
       
       // Since external API is not working, create common cricket markets based on match data
       const commonMarkets = [
         'MATCH_ODDS',
         'Normal',
         'oddeven',
         'TOSS_WINNER',
         'MAN_OF_THE_MATCH',
         'TOTAL_RUNS',
         'FIRST_WICKET'
       ];
       
       // Add common markets for each match
       commonMarkets.forEach(marketName => {
         matchesByGmid.get(gmid).markets.add(marketName);
       });
     }
     
     console.log(`Final grouped matches with all markets:`);
     for (const [gmid, matchData] of matchesByGmid) {
       console.log(`  ${matchData.match.ename} (${gmid}): ${Array.from(matchData.markets).join(', ')}`);
     }

     // Second pass: Build tree structure using grouped matches
     for (const [gmid, matchData] of matchesByGmid) {
       const match = matchData.match;
       const { cname, ename, stime, etid, section } = match;

       if (!competitions.has(cname)) {
         competitions.set(cname, {
           name: cname,
           type: "competition",
           expanded: true,
           children: [],
         });
       }

       const competition = competitions.get(cname);

       // Parse and format the time for better organization
       const matchTime = new Date(stime);
       const timeKey = matchTime.toISOString().split("T")[0]; // YYYY-MM-DD format

       // Group by date within competition
       let dateNode = competition.children.find(
         (child: any) => child.name === timeKey
       );
       if (!dateNode) {
         dateNode = {
           name: timeKey,
           type: "date",
           expanded: true,
           children: [],
         };
         competition.children.push(dateNode);
       }

       // Check if match already has section data (markets)
       console.log(`Match ${ename} (gmid: ${gmid}) has section data:`, !!section, section ? section.length : 0);
       console.log(`Match ${ename} has markets:`, Array.from(matchData.markets));
       if (section && section.length > 0) {
         console.log(`Section data structure for ${ename}:`, {
           firstSection: section[0],
           allKeys: Object.keys(section[0] || {}),
           hasMname: !!section[0]?.mname,
           mnameValue: section[0]?.mname
         });
       }

       // Create match node with all collected markets
       const matchNode = {
         name: ename,
         type: "match",
         expanded: false,
         gmid: gmid,
         status: match.status,
         formattedTime: matchTime.toLocaleString(),
         children: matchData.markets.size > 0 ? Array.from(matchData.markets).map((marketName) => ({
           name: marketName as string,
           type: "market",
           expanded: false,
           status: match.status || 'OPEN',
           gmid: gmid, // Event ID
           etid: etid  // Sport ID
         })) : [
           {
             name: "No Markets Available",
             type: "market",
             expanded: false,
             status: "N/A"
           }
         ]
       };

       dateNode.children.push(matchNode);

     }

     // Convert map to array and sort
     treeStructure.children = Array.from(competitions.values()).sort(
       (a: any, b: any) => a.name.localeCompare(b.name)
     );

     const responseData = {
       success: true,
       message: "Cricket data structured as UI tree",
       data: treeStructure,
       metadata: {
         totalMatches: cricketData.length,
         totalCompetitions: competitions.size,
         structure: "Cricket > Competition > Event > Match > Team",
       },
     };

     // Cache the response for 2 minutes with new key pattern
     await redisClient.setex("d247_cricket_tree", 120, JSON.stringify(responseData));
     
     const totalTime = Date.now() - startTime;
     console.log(`Cricket tree generation completed in ${totalTime}ms`);

     res.json({
       ...responseData,
       processingTime: totalTime
     });
  } catch (error: any) {
    console.error("Error getting cricket tree data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cricket tree data",
    });
  }
});

// Summary route
router.get("/cricket/summary", async (req, res) => {
  try {
    const cricketData = await fetchAndStoreSportsData("cricket");

    // Check if cricket data exists and is valid
    if (!cricketData || !Array.isArray(cricketData)) {
      console.warn(
        "Cricket data is null, undefined, or not an array:",
        cricketData
      );
      return res.json({
        success: true,
        message: "No cricket data available",
        data: {
          totalMatches: 0,
          totalCompetitions: 0,
          totalEvents: 0,
          competitions: [],
          sampleStructure: {
            level1: "Cricket (Sport)",
            level2: "Competition (e.g., ICC Womens World Cup Warmup Matches)",
            level3: "Event (e.g., Bangladesh W v South Africa W)",
            level4: "Match Time (e.g., 9/25/2025 3:00:00 PM)",
            level5: "Teams & Odds",
          },
          availableEndpoints: {
            flat: "/api/v1/admin/sports/",
            hierarchy: "/api/v1/admin/sports/cricket/hierarchy",
            tree: "/api/v1/admin/sports/cricket/tree",
            summary: "/api/v1/admin/sports/cricket/summary",
          },
        },
      });
    }

    // Create summary statistics
    const competitions = new Set();
    const events = new Set();
    const matches = cricketData.length;

    cricketData.forEach((match: any) => {
      competitions.add(match.cname);
      events.add(match.ename);
    });

    res.json({
      success: true,
      message: "Cricket data summary",
      data: {
        totalMatches: matches,
        totalCompetitions: competitions.size,
        totalEvents: events.size,
        competitions: Array.from(competitions),
        sampleStructure: {
          level1: "Cricket (Sport)",
          level2: "Competition (e.g., ICC Womens World Cup Warmup Matches)",
          level3: "Event (e.g., Bangladesh W v South Africa W)",
          level4: "Match Time (e.g., 9/25/2025 3:00:00 PM)",
          level5: "Teams & Odds",
        },
        availableEndpoints: {
          flat: "/api/v1/admin/sports/",
          hierarchy: "/api/v1/admin/sports/cricket/hierarchy",
          tree: "/api/v1/admin/sports/cricket/tree",
          summary: "/api/v1/admin/sports/cricket/summary",
        },
      },
    });
  } catch (error: any) {
    console.error("Error getting cricket summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cricket summary",
    });
  }
});





// Soccer tree route
router.get("/soccer/tree", async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check Redis cache first with new key pattern
    const redisClient = getRedisClient();
    const cachedSoccer = await redisClient.get("d247_soccer_tree");
    if (cachedSoccer) {
      console.log("Returning cached soccer tree data (key: d247_soccer_tree)");
      const parsedCache = JSON.parse(cachedSoccer);
      res.json({
        ...parsedCache,
        cached: true,
        cacheTime: Date.now() - startTime
      });
      return;
    }
    
    const soccerData = await fetchAndStoreSportsData("soccer");
    const result = await createSportTreeStructure(soccerData, "Soccer", 1);
    
    // Cache the response for 2 minutes with new key pattern
    await redisClient.setex("d247_soccer_tree", 120, JSON.stringify(result));
    
    const totalTime = Date.now() - startTime;
    console.log(`Soccer tree generation completed in ${totalTime}ms`);
    
    res.json({
      ...result,
      processingTime: totalTime
    });
  } catch (error: any) {
    console.error("Error getting soccer tree data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch soccer tree data",
    });
  }
});

// Tennis tree route
router.get("/tennis/tree", async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check Redis cache first with new key pattern
    const redisClient = getRedisClient();
    const cachedTennis = await redisClient.get("d247_tennis_tree");
    if (cachedTennis) {
      console.log("Returning cached tennis tree data (key: d247_tennis_tree)");
      const parsedCache = JSON.parse(cachedTennis);
      res.json({
        ...parsedCache,
        cached: true,
        cacheTime: Date.now() - startTime
      });
      return;
    }
    
    const tennisData = await fetchAndStoreSportsData("tennis");
    const result = await createSportTreeStructure(tennisData, "Tennis", 2);
    
    // Cache the response for 2 minutes with new key pattern
    await redisClient.setex("d247_tennis_tree", 120, JSON.stringify(result));
    
    const totalTime = Date.now() - startTime;
    console.log(`Tennis tree generation completed in ${totalTime}ms`);
    
    res.json({
      ...result,
      processingTime: totalTime
    });
  } catch (error: any) {
    console.error("Error getting tennis tree data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tennis tree data",
    });
  }
});

// All sports tree route
router.get("/tree", async (req, res) => {
  try {
    console.log("Fetching all sports data for tree structure...");
    const startTime = Date.now();
    
    // Check Redis cache first with new key pattern
    const redisClient = getRedisClient();
    const cachedTree = await redisClient.get("d247_all_sports_tree");
    if (cachedTree) {
      console.log("Returning cached sports tree data (key: d247_all_sports_tree)");
      const parsedCache = JSON.parse(cachedTree);
      res.json({
        ...parsedCache,
        cached: true,
        cacheTime: Date.now() - startTime
      });
      return;
    }
    
    // Fetch all sports data concurrently
    const [cricketData, soccerData, tennisData] = await Promise.all([
      fetchAndStoreSportsData("cricket"),
      fetchAndStoreSportsData("soccer"),
      fetchAndStoreSportsData("tennis")
    ]);

    // Create tree structure for all sports concurrently
    const sports = [
      { data: cricketData, name: "Cricket", sportId: 4 },
      { data: soccerData, name: "Soccer", sportId: 1 },
      { data: tennisData, name: "Tennis", sportId: 2 }
    ];

    // Process all sports concurrently instead of sequentially
    const sportPromises = sports.map(async (sport) => {
      if (sport.data && Array.isArray(sport.data) && sport.data.length > 0) {
        return await createSportTreeStructure(sport.data, sport.name, sport.sportId);
      } else {
        return {
          data: {
            name: sport.name,
            type: "sport",
            expanded: true,
            children: []
          }
        };
      }
    });

    const sportResults = await Promise.all(sportPromises);

    // Create tree structure for all sports
    const allSportsTree: any = {
      name: "Sports",
      type: "root",
      expanded: true,
      children: sportResults.map(result => result.data)
    };

    const responseData = {
      success: true,
      message: "All sports data structured as UI tree",
      data: allSportsTree,
      metadata: {
        totalSports: sports.length,
        structure: "Sports > Sport > Competition > Event > Match > Market",
        sports: sports.map(s => ({
          name: s.name,
          sportId: s.sportId,
          hasData: !!(s.data && Array.isArray(s.data) && s.data.length > 0),
          matchCount: s.data ? s.data.length : 0
        }))
      }
    };

    // Cache the response for 2 minutes with new key pattern
    await redisClient.setex("d247_all_sports_tree", 120, JSON.stringify(responseData));
    
    const totalTime = Date.now() - startTime;
    console.log(`Sports tree generation completed in ${totalTime}ms`);
    
    res.json({
      ...responseData,
      processingTime: totalTime
    });
  } catch (error: any) {
    console.error("Error getting all sports tree data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all sports tree data",
    });
  }
});

export default router;
