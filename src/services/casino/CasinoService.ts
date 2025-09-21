import axios from "axios";
import { getRedisClient } from "../../config/redisConfig";
import { getRedisPublisher } from "../../config/redisPubSub";
import { CronDataSource } from "../../corn.server";
// import { CasinoMatch } from "../../entities/casino/CasinoMatch";
import { CasinoBet } from "../../entities/casino/CasinoBet";
import { USER_TABLES } from "../../Helpers/users/Roles";
import { AppDataSource } from "../../server";
import { DIFF_STRUCT_CASINO_TYPES, ALTERNATIVE_API_CASINO_TYPES } from "../../Helpers/Request/Validation";
import { CasinoMatchNew } from "../../entities/casino/CasinoMatchNew";

// Circuit breaker state tracking
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const circuitBreakers = new Map<string, CircuitBreakerState>();
const MAX_FAILURES = 3; // Reduced failures for faster circuit opening
const TIMEOUT_DURATION = 30000; // 30 seconds - faster recovery
const HALF_OPEN_TIMEOUT = 15000; // 15 seconds - faster half-open testing

// Retry configuration - optimized for 10-second intervals
const MAX_RETRIES = 2; // Reduced retries for faster processing
const RETRY_DELAYS = [500, 1000]; // Faster retry delays: 500ms, 1s

// Rate limiting - optimized for 10-second intervals
const requestQueue = new Map<string, Promise<any>>();
const RATE_LIMIT_DELAY = 50; // Reduced to 50ms for faster processing
const CONCURRENT_REQUESTS_LIMIT = 3; // Max concurrent requests per casino type

// Priority system for user-requested casino types
const activeCasinoTypes = new Set<string>();
const priorityQueue = new Set<string>();
const lastUpdateTime = new Map<string, number>();
const MIN_UPDATE_INTERVAL = 5000; // Minimum 5 seconds between updates for same casino type

// Circuit breaker functions
const getCircuitBreakerState = (casinoType: string): CircuitBreakerState => {
  if (!circuitBreakers.has(casinoType)) {
    circuitBreakers.set(casinoType, {
      failures: 0,
      lastFailureTime: 0,
      state: 'CLOSED'
    });
  }
  return circuitBreakers.get(casinoType)!;
};

const recordSuccess = (casinoType: string) => {
  const state = getCircuitBreakerState(casinoType);
  state.failures = 0;
  state.state = 'CLOSED';
};

const recordFailure = (casinoType: string) => {
  const state = getCircuitBreakerState(casinoType);
  state.failures++;
  state.lastFailureTime = Date.now();
  
  if (state.failures >= MAX_FAILURES) {
    state.state = 'OPEN';
    console.log(`[CIRCUIT] Circuit breaker OPEN for ${casinoType} after ${state.failures} failures`);
  }
};

const isCircuitOpen = (casinoType: string): boolean => {
  const state = getCircuitBreakerState(casinoType);
  
  if (state.state === 'CLOSED') return false;
  
  if (state.state === 'OPEN') {
    if (Date.now() - state.lastFailureTime > TIMEOUT_DURATION) {
      state.state = 'HALF_OPEN';
      console.log(`[CIRCUIT] Circuit breaker HALF_OPEN for ${casinoType}`);
      return false;
    }
    return true;
  }
  
  // HALF_OPEN state
  if (Date.now() - state.lastFailureTime > HALF_OPEN_TIMEOUT) {
    state.state = 'OPEN';
    return true;
  }
  
  return false;
};

// Retry function with exponential backoff
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  casinoType: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      recordSuccess(casinoType);
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on circuit breaker open
      if (isCircuitOpen(casinoType)) {
        throw new Error(`Circuit breaker OPEN for ${casinoType}`);
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        recordFailure(casinoType);
        break;
      }
      
      // Wait before retry
      const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      console.log(`[RETRY] Attempt ${attempt + 1} failed for ${casinoType}, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  recordFailure(casinoType);
  throw lastError;
};

// Rate limiting function
const rateLimitedRequest = async <T>(
  casinoType: string,
  requestFn: () => Promise<T>
): Promise<T> => {
  // Check if there's already a request in progress for this casino type
  if (requestQueue.has(casinoType)) {
    console.log(`[RATE_LIMIT] Request already in progress for ${casinoType}, waiting...`);
    return requestQueue.get(casinoType)!;
  }
  
  const requestPromise = (async () => {
    try {
      // Add small delay to prevent overwhelming the API
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      return await requestFn();
    } finally {
      // Clean up the queue
      requestQueue.delete(casinoType);
    }
  })();
  
  requestQueue.set(casinoType, requestPromise);
  return requestPromise;
};

// Health check function to monitor circuit breaker states
export const getCircuitBreakerHealth = () => {
  const health = {
    totalCasinos: circuitBreakers.size,
    openCircuits: 0,
    halfOpenCircuits: 0,
    closedCircuits: 0,
    details: {} as Record<string, any>
  };

  for (const [casinoType, state] of circuitBreakers.entries()) {
    health.details[casinoType] = {
      state: state.state,
      failures: state.failures,
      lastFailureTime: state.lastFailureTime,
      timeSinceLastFailure: Date.now() - state.lastFailureTime
    };

    switch (state.state) {
      case 'OPEN':
        health.openCircuits++;
        break;
      case 'HALF_OPEN':
        health.halfOpenCircuits++;
        break;
      case 'CLOSED':
        health.closedCircuits++;
        break;
    }
  }

  return health;
};

// Reset circuit breaker for a specific casino type (useful for manual recovery)
export const resetCircuitBreaker = (casinoType: string) => {
  if (circuitBreakers.has(casinoType)) {
    circuitBreakers.set(casinoType, {
      failures: 0,
      lastFailureTime: 0,
      state: 'CLOSED'
    });
    console.log(`[CIRCUIT] Reset circuit breaker for ${casinoType}`);
  }
};

// Priority system functions
export const markCasinoAsActive = (casinoType: string) => {
  activeCasinoTypes.add(casinoType);
  console.log(`[PRIORITY] Marked ${casinoType} as active`);
};

export const markCasinoAsInactive = (casinoType: string) => {
  activeCasinoTypes.delete(casinoType);
  console.log(`[PRIORITY] Marked ${casinoType} as inactive`);
};

export const requestImmediateUpdate = (casinoType: string) => {
  const now = Date.now();
  const lastUpdate = lastUpdateTime.get(casinoType) || 0;
  
  // Only add to priority queue if enough time has passed since last update
  if (now - lastUpdate >= MIN_UPDATE_INTERVAL) {
    priorityQueue.add(casinoType);
    console.log(`[PRIORITY] Added ${casinoType} to priority queue for immediate update`);
    return true;
  } else {
    console.log(`[PRIORITY] ${casinoType} updated recently, skipping immediate update`);
    return false;
  }
};

export const getPriorityCasinoTypes = (): string[] => {
  return Array.from(priorityQueue);
};

export const clearPriorityQueue = () => {
  priorityQueue.clear();
};

// Check if casino type should be updated immediately
const shouldUpdateImmediately = (casinoType: string): boolean => {
  const now = Date.now();
  const lastUpdate = lastUpdateTime.get(casinoType) || 0;
  
  return (
    activeCasinoTypes.has(casinoType) || 
    priorityQueue.has(casinoType)
  ) && (now - lastUpdate >= MIN_UPDATE_INTERVAL);
};

// export const fetchAndUpdateCasinoOdds = async (casinoType: string) => {
//   try {
//     // Check circuit breaker first
//     if (isCircuitOpen(casinoType)) {
//       console.log(`[CIRCUIT] Skipping ${casinoType} - circuit breaker OPEN`);
//       return null;
//     }

//     const redisPublisher = getRedisPublisher();
//     const redisClient = getRedisClient();
//     const matchRepo = CronDataSource.getRepository(CasinoMatchNew);
//     const casinoBetRepo = CronDataSource.getRepository(CasinoBet);

//     let apiUrl: string;
//     let params: any;

//     // if (ALTERNATIVE_API_CASINO_TYPES.includes(casinoType)) {
//     apiUrl = `${process.env.THIRD_PARTY_URL}/exchange/casino/CasinoData`;
//     params = { type: casinoType };
//     // } else {
//     //   apiUrl = `${process.env.THIRD_PARTY_URL}/api/new/casino`;
//     //   params = { casinoType };
//     // }

//     // Use rate limiting and retry logic
//     const response = await rateLimitedRequest(casinoType, () =>
//       retryWithBackoff(async () => {
//         return await axios.get(apiUrl, {
//           params,
//           timeout: 15000, // Reduced to 15 seconds for faster failure detection
//           headers: {
//             'User-Agent': 'GameStake-Server/1.0',
//             'Accept': 'application/json',
//             'Connection': 'keep-alive'
//           }
//         });
//       }, casinoType)
//     );

//     console.log("response.data", response.data,"casinoType",casinoType);

//     let apiData = response.data;
//     // if(casinoType=="teen"){
//     //   apiData = response.data;
//     // }else{
//     //   apiData = response.data;
//     // }
//     // const apiData = response.data;

//     let currentMid: string | null = null;
//     let currentData: any = null;

//     // if (ALTERNATIVE_API_CASINO_TYPES.includes(casinoType)) {
//     if (apiData?.mid) {
//       currentMid = String(apiData.mid);
//       currentData = apiData;
//     }
//     // } else if (DIFF_STRUCT_CASINO_TYPES.includes(casinoType)) {
//     //   if (apiData?.data?.mid) {
//     //     currentMid = String(apiData.data.mid);
//     //     currentData = apiData.data;
//     //   } else if (apiData?.data?.t1?.[0]?.mid) {
//     //     currentMid = String(apiData.data.t1[0].mid);
//     //     currentData = apiData.data;
//     //   }
//     // } else {
//     //   if (apiData?.data?.mid) {
//     //     currentMid = String(apiData.data.mid);
//     //     currentData = apiData?.data || apiData;
//     //   } else if (apiData?.data?.t1?.[0]?.mid) {
//     //     currentMid = String(apiData.data.t1[0].mid);
//     //     currentData = apiData.data;
//     //   }
//     // }

//     const pipeline = redisClient.pipeline();
//     if (currentMid && currentData) {
//       // Only upsert columns that exist in the database (excluding result column)
//       try {
//         await matchRepo.upsert(
//           {
//             mid: String(currentMid),
//             casinoType: casinoType,
//             winner: null,
//             data: currentData,
//             result: null as any,
//           },
//           ["mid"]
//         );
//       } catch (dbError: any) {
//         // Handle database schema mismatch gracefully
//         if (dbError.message.includes("column") && dbError.message.includes("does not exist")) {
//           console.log(`[CRON] Database schema mismatch for ${casinoType}, skipping database update but continuing with Redis`);
//         } else {
//           throw dbError; // Re-throw if it's not a schema issue
//         }
//       }

//       pipeline.set(
//         `casino:${casinoType}:current`,
//         JSON.stringify(currentData),
//         "EX",
//         600
//       );
//     } else {
//       console.log(`[CRON] already updated that match on the database for ${casinoType}`);
//     }

//     let results = [];

//     // if (ALTERNATIVE_API_CASINO_TYPES.includes(casinoType)) {
//     //   results = [];
//     // } else if (DIFF_STRUCT_CASINO_TYPES.includes(casinoType)) {
//     //   if (apiData?.result?.res && Array.isArray(apiData.result.res)) {
//     //     results = apiData.result.res;
//     //   } else if (apiData?.result && Array.isArray(apiData.result)) {
//     //     results = apiData.result;
//     //   }
//     // } else {
//     //   if (apiData?.result?.res && Array.isArray(apiData.result.res)) {
//     //     results = apiData.result.res;
//     //   } else if (apiData?.result && Array.isArray(apiData.result)) {
//     //     results = apiData.result;
//     //   }
//     // }

//     if (results.length <= 0) {
//       try {
//         // console.log(`[CRON] No results found, trying alternative endpoint for ${casinoType}`);
//         const resultsResponse = await retryWithBackoff(async () => {
//           return await axios.get(`${process.env.THIRD_PARTY_URL}/exchange/casino/CasinoResult`, {
//             params: { type: casinoType },
//             timeout: 10000, // Reduced timeout for faster processing
//             headers: {
//               'User-Agent': 'GameStake-Server/1.0',
//               'Accept': 'application/json',
//               'Connection': 'keep-alive'
//             }
//           });
//         }, casinoType, 1); // Single retry for alternative endpoint

//         if (resultsResponse.data && Array.isArray(resultsResponse.data)) {
//           results = resultsResponse.data;
//           console.log(`[CRON] Found ${results.length} results from third party api for ${casinoType}`);
//         } else if (resultsResponse.data?.res && Array.isArray(resultsResponse.data.res)) {
//           results = resultsResponse.data.res;
//           console.log(`[CRON] Found ${results.length} results from alternative endpoint for ${casinoType}`);
//         }
//       } catch (altErr: any) {
//         console.log(`[CRON] Failed to fetch results from alternative endpoint for ${casinoType}:`, altErr.message);
//       }
//     }

//     if (results.length > 0) {
//       for (const r of results) {
//         const resultMid = String(r.mid || r.matchId);
//         const winner = r.win || r.result || r.winner;

//         if (!resultMid) {
//           console.log(`[CRON] Skipping invalid result for ${casinoType}:`, r);
//           continue;
//         }
       
//           await matchRepo.update(
//             { mid: resultMid },
//             {
//               casinoType: casinoType,
//               winner: String(winner),
//               result: null as any,
//             }
//           );
//       }

//       pipeline.set(
//         `casino:${casinoType}:results`,
//         JSON.stringify(results),
//         "EX",
//         600
//       );
//     }

//     await pipeline.exec();

//     await redisPublisher.publish(
//       `casino_odds_updates:${casinoType}`,
//       JSON.stringify({
//         casinoType,
//         hasCurrent: !!currentData,
//         hasResults: results.length > 0,
//         timestamp: Date.now(),
//       })
//     );

//     console.log(
//       `[CRON] Updated Redis & published notification for ${casinoType}`
//     );

//     // Track update time and remove from priority queue
//     lastUpdateTime.set(casinoType, Date.now());
//     priorityQueue.delete(casinoType);

//     return apiData;
//   } catch (err: any) {
//     // Enhanced error handling with circuit breaker integration
//     if (err.message.includes("Circuit breaker OPEN")) {
//       console.log(`[CIRCUIT] ${casinoType} circuit breaker is OPEN, skipping request`);
//       return null;
//     }
    
//     if (
//       err.code === "ECONNRESET" ||
//       err.code === "ECONNABORTED" ||
//       err.code === "ETIMEDOUT" ||
//       err.message.includes("socket hang up") ||
//       err.message.includes("timeout")
//     ) {
//       console.log(
//         `[CRON] Network error for ${casinoType}, will retry on next cycle:`,
//         err.message
//       );
//     } else {
//       console.error(
//         `[CRON] Failed to fetch odds for ${casinoType}:`,
//         err.message
//       );
//     }
//     return null;
//   }
// };


// export const fetchAndUpdateCasinoOdds = async (casinoType: string) => {
//   try {
//     const redisPublisher = getRedisPublisher();
//     const redisClient = getRedisClient();
//     const matchRepo = CronDataSource.getRepository(CasinoMatch);
//     const casinoBetRepo = CronDataSource.getRepository(CasinoBet);

//     // Determine which API endpoint to use
//     let apiUrl: string;
//     let params: any;

//     if (ALTERNATIVE_API_CASINO_TYPES.includes(casinoType)) {
//       // Use alternative API endpoint
//       apiUrl = `${process.env.THIRD_PARTY_URL}/exchange/casino/CasinoData`;
//       params = { type: casinoType };
//     } else {
//       // Use default API endpoint
//       apiUrl = `${process.env.THIRD_PARTY_URL}/api/new/casino`;
//       params = { casinoType };
//     }

//     // Fetch from API with timeout and retry
//     const response = await axios.get(apiUrl, {
//       params,
//       timeout: 10000, // 10 second timeout
//     });
//     const apiData = response.data;

//     // Handle current match data - check for different structures
//     let currentMid: string | null = null;
//     let currentData: any = null;

//     // Handle different API structures based on casino type
//     if (ALTERNATIVE_API_CASINO_TYPES.includes(casinoType)) {
//       // Alternative API structure (like lucky5, joker20, joker1, ab4, lottcard)
//       // Data is direct, not wrapped in data object
//       if (apiData?.mid) {
//         currentMid = String(apiData.mid);
//         currentData = apiData;
//       }
//     } else if (DIFF_STRUCT_CASINO_TYPES.includes(casinoType)) {
//       // Different structure casinos (aaa, abj, dt20, lucky7eu, dt202, teenmuf, teen20c, btable2, goal, baccarat2, d16)
//       // These have specific data structures
//       if (apiData?.data?.mid) {
//         currentMid = String(apiData.data.mid);
//         currentData = apiData.data;
//       } else if (apiData?.data?.t1?.[0]?.mid) {
//         currentMid = String(apiData.data.t1[0].mid);
//         currentData = apiData.data;
//       }
//     } else {
//       // Default API structure (dt6, teen, poker, teen20, teen9, teen8, poker20, poker6, card32eu, war)
//       // Standard wrapped data structure
//       if (apiData?.data?.mid) {
//         currentMid = String(apiData.data.mid);
//         currentData = apiData.data;
//       } else if (apiData?.data?.t1?.[0]?.mid) {
//         currentMid = String(apiData.data.t1[0].mid);
//         currentData = apiData.data;
//       }
//     }

//     if (currentMid && currentData) {
//       await matchRepo.upsert(
//         {
//           mid: currentMid,
//           casinoType,
//           winner: null,
//           data: currentData,
//         },
//         ["mid"] // unique column for conflict
//       );

//       // Store current match separately in Redis
//       await redisClient.set(
//         `casino:${casinoType}:current`,
//         JSON.stringify(currentData),
//         "EX",
//         600
//       );
//     } else {
//       console.log(`[CRON] No live match for ${casinoType}`);
//     }

//     // Handle results - different structures for different casino types
//     let results = [];

//     if (ALTERNATIVE_API_CASINO_TYPES.includes(casinoType)) {
//       // Alternative API casinos (lucky5, joker20, joker1, ab4, lottcard)
//       // These don't include results in API response
//       results = [];
//     } else if (DIFF_STRUCT_CASINO_TYPES.includes(casinoType)) {
//       // Different structure casinos (aaa, abj, dt20, lucky7eu, dt202, teenmuf, teen20c, btable2, goal, baccarat2, d16)
//       // These have specific result structures
//       if (apiData?.result?.res && Array.isArray(apiData.result.res)) {
//         // Structure: apiData.result.res (for teenmuf, etc.)
//         results = apiData.result.res;
//       } else if (apiData?.result && Array.isArray(apiData.result)) {
//         // Structure: apiData.result (for aaa, dt20, etc.)
//         results = apiData.result;
//       }
//     } else {
//       // Default API structure (dt6, teen, poker, teen20, teen9, teen8, poker20, poker6, card32eu, war)
//       // Standard result structure
//       if (apiData?.result?.res && Array.isArray(apiData.result.res)) {
//         // Structure: apiData.result.res
//         results = apiData.result.res;
//       } else if (apiData?.result && Array.isArray(apiData.result)) {
//         // Structure: apiData.result
//         results = apiData.result;
//       }
//     }

//     if (results.length > 0) {
//       for (const r of results) {
//         const resultMid = String(r.mid || r.matchId);
//         // Handle both 'win' and 'result' fields, prefer 'win' if both exist
//         // For dt202, only 'result' field exists, so use it as winner
//         // For teenmuf, only 'win' field exists in result.res structure
//         const winner = r.win || r.result || r.winner;

//         if (!resultMid) {
//           console.log(`[CRON] Skipping invalid result for ${casinoType}:`, r);
//           continue;
//         }

//         // Update CasinoMatch with winner
//         await matchRepo.upsert(
//           {
//             mid: resultMid,
//             casinoType,
//             winner: String(winner),
//           },
//           ["mid"] // if mid already exists, update winner
//         );

//         // Update CasinoBet records for this match
//         await updateCasinoBetsWithResult(
//           resultMid,
//           String(winner),
//           casinoBetRepo
//         );
//       }

//       // Store results separately in Redis
//       await redisClient.set(
//         `casino:${casinoType}:results`,
//         JSON.stringify(results),
//         "EX",
//         600
//       );
//     }

//     // Publish update notification (only send Redis keys, not complete data)
//     await redisPublisher.publish(
//       `casino_odds_updates:${casinoType}`, // Channel specific to casinoType
//       JSON.stringify({
//         casinoType,
//         hasCurrent: !!currentData,
//         hasResults: results.length > 0,
//         timestamp: Date.now(),
//       })
//     );

//     console.log(
//       `[CRON] Updated Redis & published notification for ${casinoType}`
//     );

//     return apiData;
//   } catch (err: any) {
//     // Handle specific network errors
//     if (
//       err.code === "ECONNRESET" ||
//       err.code === "ECONNABORTED" ||
//       err.message.includes("socket hang up")
//     ) {
//       console.log(
//         `[CRON] Network error for ${casinoType}, will retry on next cycle:`,
//         err.message
//       );
//     } else {
//       console.error(
//         `[CRON] Failed to fetch odds for ${casinoType}:`,
//         err.message
//       );
//     }
//     return null;
//   }
// };

const updateCasinoBetsWithResult = async (mid: string, winner: string, casinoBetRepo: any) => {
  try {
    // Find all pending bets for this match ID
    const pendingBets = await casinoBetRepo.find({
      where: { matchId: mid, status: "pending" }
    });


    if (pendingBets.length === 0) {
      return; // No pending bets, exit silently
    }

    for (const bet of pendingBets) {
      // Check if bet is already settled to prevent double processing
      if (bet.betData?.result?.settled === true || bet.status !== "pending") {
        // console.log(`[CRON] Bet ${bet.id} already settled (status: ${bet.status}), skipping`);
        continue;
      }

      const betData = bet.betData || {};
      const betSid: String = betData.sid;

      if (!betSid) {
        console.log(`[CRON] Bet ${bet.id} has no SID, skipping result update`);
        continue;
      }

      // Get user repository
      const userRepo = CronDataSource.getRepository(USER_TABLES[bet.userType]);

      // Use a simple transaction for each bet
      await CronDataSource.transaction(async (transactionalEntityManager) => {
        // First, check if bet is still pending with a lock to prevent race conditions
        const currentBet = await transactionalEntityManager.findOne(CasinoBet, {
          where: { id: bet.id, status: "pending" },
          lock: { mode: "pessimistic_write" }
        });

        if (!currentBet) {
          console.log(`[CRON] Bet ${bet.id} no longer pending, skipping`);
          return;
        }

        // Find user with lock
        const user: any = await transactionalEntityManager.findOne(USER_TABLES[bet.userType], {
          where: { id: bet.userId },
          lock: { mode: "pessimistic_write" }
        });

        if (!user) {
          console.log(`[CRON] User ${bet.userId} not found for bet ${bet.id}`);
          return;
        }

        const stakeAmount = Number(betData.stake) || 0;
        let newStatus: "won" | "lost" = "lost";
        let profitLoss = 0;

        if (winner === betSid) {
          newStatus = "won";
          profitLoss = Number(betData.profit) || 0;
          user.balance = Number(user.balance) + profitLoss;
        } else {
          newStatus = "lost";
          profitLoss = Number(betData.loss) || 0;
          user.balance = Number(user.balance) - profitLoss;
        }

        user.exposure = Number(user.exposure) - stakeAmount;

        // Update user and bet - update status first to prevent re-processing
        await transactionalEntityManager.update(CasinoBet, { id: bet.id }, {
          status: newStatus,
          betData: {
            ...betData,
            result: {
              winner: winner,
              settledAt: new Date(),
              profitLoss: profitLoss,
              stake: stakeAmount,
              betRate: betData.betRate || betData.matchOdd || 1,
              status: newStatus,
              settled: true
            }
          }
        });

        // Update user balance after bet is marked as settled
        await transactionalEntityManager.save(user);

        console.log(`[CRON] Updated bet ${bet.id}: ${newStatus} with profit/loss: ${profitLoss}`);
      });
    }

  } catch (error) {
    console.error(`[CRON] Error updating bets for match ${mid}:`, error);
  }
};