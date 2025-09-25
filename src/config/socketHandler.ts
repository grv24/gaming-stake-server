import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { getRedisSubscriber } from "../config/redisPubSub";
import { USER_TABLES } from "../Helpers/users/Roles";
import { DataSource } from "typeorm";
import * as fs from "fs";
import * as path from "path";
import { config } from "./env";

// Casino Socket Handler Logging System
const LOG_DIRECTORY = path.join(process.cwd(), "logs", "casino-socket");

// Get current date string for log file naming
const getCurrentDateString = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD format
};

const LOG_FILE_PATH = path.join(LOG_DIRECTORY, `casino-socket-${getCurrentDateString()}.log`);

// Ensure log directory exists
const ensureLogDirectory = (): void => {
  if (!fs.existsSync(LOG_DIRECTORY)) {
    fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
  }
};

// Write to log file
const writeToLogFile = (message: string): void => {
  try {
    ensureLogDirectory();
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(LOG_FILE_PATH, logMessage);
  } catch (error) {
    console.error("[CASINO-SOCKET] Error writing to log file:", error);
  }
};

// Logging methods
const logInfo = (message: string, data?: any): void => {
  const logMessage = `[CASINO-SOCKET-INFO] ${message}`;
  console.log(logMessage, data || "");
  writeToLogFile(logMessage + (data ? ` | Data: ${JSON.stringify(data)}` : ""));
};

const logError = (message: string, data?: any): void => {
  const logMessage = `[CASINO-SOCKET-ERROR] ${message}`;
  console.error(logMessage, data || "");
  writeToLogFile(logMessage + (data ? ` | Data: ${JSON.stringify(data)}` : ""));
};

const logWarn = (message: string, data?: any): void => {
  const logMessage = `[CASINO-SOCKET-WARN] ${message}`;
  console.warn(logMessage, data || "");
  writeToLogFile(logMessage + (data ? ` | Data: ${JSON.stringify(data)}` : ""));
};

const logDebug = (message: string, data?: any): void => {
  const logMessage = `[CASINO-SOCKET-DEBUG] ${message}`;
  console.log(logMessage, data || "");
  writeToLogFile(logMessage + (data ? ` | Data: ${JSON.stringify(data)}` : ""));
};

// Casino types from Validation.ts
const CASINO_TYPES = [
  "dt6",
  "teen",
  "poker",
  "teen20",
  "teen9",
  "teen8",
  "poker20",
  "poker6",
  "card32eu",
  "war",
  "aaa",
  "abj",
  "dt20",
  "lucky7eu",
  "dt202",
  "teenmuf",
  "teen20c",
  "btable2",
  "goal",
  "baccarat2",
  "lucky5",
  "joker20",
  "joker1",
  "ab4",
  "lottcard",
  "poison20",
];

interface UserConnection {
  socketId: string;
  userType: "user" | "techAdmin";
  casinoSubscriptions: Set<string>; // Track which casino types user is subscribed to
}

const activeConnections: Record<string, UserConnection> = {};

// Cache for tracking Redis key changes
const redisKeyCache: Record<
  string,
  { current: string | null; results: string | null }
> = {};

// Cache for tracking game states and timing
const gameStateCache: Record<string, {
  mid: string | null;
  lt: number | null;
  ft: number | null;
  phase: string;
  lastUpdate: number;
}> = {};

/**
 * ANALYZE GAME TIMING AND STATE
 * 
 * Purpose: Determine game phase and actions based on timing fields
 * 
 * Game Phases:
 * - RUNNING: Game is active (lt > 0)
 * - FINISHING: Game is about to end (lt <= 5)
 * - FINISHED: Game has ended (lt = 0)
 * - SUSPENDED: Game is paused
 * 
 * Actions:
 * - shouldBroadcast: Always broadcast changes
 * - shouldSettle: Only when game is finished
 */
const analyzeGameTiming = (casinoType: string, gameData: any): {
  phase: string;
  shouldBroadcast: boolean;
  shouldSettle: boolean;
  timeRemaining: number;
  gameProgress: number;
} => {
  try {
    const mid = gameData.mid?.toString();
    const lt = Number(gameData.lt) || 0; // Last time (seconds remaining)
    const ft = Number(gameData.ft) || 0; // Finish time (total duration)
    const currentTime = Date.now();
    
    // Get previous state
    const previousState = gameStateCache[casinoType] || {
      mid: null,
      lt: null,
      ft: null,
      phase: 'UNKNOWN',
      lastUpdate: 0
    };
    
    // Calculate game progress
    const gameProgress = ft > 0 ? ((ft - lt) / ft) * 100 : 0;
    
    // Determine game phase
    let phase = 'UNKNOWN';
    let shouldBroadcast = true;
    let shouldSettle = false;
    
    if (lt > 5) {
      phase = 'RUNNING';
    } else if (lt > 0 && lt <= 5) {
      phase = 'FINISHING';
    } else if (lt === 0) {
      phase = 'FINISHED';
      shouldSettle = true;
    } else {
      phase = 'SUSPENDED';
    }
    
    // Check if this is a new game (different mid)
    const isNewGame = mid && mid !== previousState.mid;
    
    // Check if game just finished
    const justFinished = (previousState.lt || 0) > 0 && lt === 0;
    
    // Update cache
    gameStateCache[casinoType] = {
      mid,
      lt,
      ft,
      phase,
      lastUpdate: currentTime
    };
    
    logInfo(`Game timing analysis for ${casinoType}`, {
      mid,
      lt,
      ft,
      phase,
      gameProgress: Math.round(gameProgress),
      isNewGame,
      justFinished,
      shouldBroadcast,
      shouldSettle
    });
    
    return {
      phase,
      shouldBroadcast,
      shouldSettle: shouldSettle || justFinished,
      timeRemaining: lt,
      gameProgress: Math.round(gameProgress)
    };
    
  } catch (error: any) {
    logError(`Error analyzing game timing for ${casinoType}`, { error: error.message, stack: error.stack });
    return {
      phase: 'ERROR',
      shouldBroadcast: true,
      shouldSettle: false,
      timeRemaining: 0,
      gameProgress: 0
    };
  }
};

/**
 * TRIGGER CASINO SETTLEMENT
 * 
 * Purpose: Trigger immediate settlement for finished games
 */
const triggerCasinoSettlement = async (casinoType: string, mid: string, dataSource: DataSource) => {
  try {
    logInfo(`Triggering immediate settlement for ${casinoType} mid: ${mid}`);
    
    // Import settlement service dynamically
    const { getCasinoSettlementService } = await import("../services/casino/CasinoSettlementService");
    const casinoSettlementService = getCasinoSettlementService(dataSource);
    
    // Settle the specific match
    const result = await casinoSettlementService.settleCasinoMatch(casinoType, mid);
    
    logInfo(`Settlement result for ${casinoType} mid: ${mid}`, {
      success: result.success,
      settledCount: result.settledCount,
      message: result.message
    });
    
    return result;
    
  } catch (error: any) {
    logError(`Error triggering settlement for ${casinoType} mid: ${mid}`, { error: error.message, stack: error.stack });
    return { success: false, error: error.message };
  }
};

/**
 * CHECK PENDING CASINO BETS
 * 
 * Purpose: Check and log all pending casino bets for debugging
 */
const checkPendingCasinoBets = async (dataSource: DataSource, matchId?: string, casinoType?: string) => {
  try {
    logInfo(`Checking pending casino bets${matchId ? ` for match ${matchId}` : casinoType ? ` for casino type ${casinoType}` : ''}`);
    
    // Import settlement service dynamically
    const { getCasinoSettlementService } = await import("../services/casino/CasinoSettlementService");
    const casinoSettlementService = getCasinoSettlementService(dataSource);
    
    // Check pending bets
    const result = await casinoSettlementService.checkPendingCasinoBets(matchId, casinoType);
    
    logInfo(`Pending casino bets check result:`, {
      success: result.success,
      totalPendingBets: result.totalPendingBets,
      totalPendingBetsAll: result.totalPendingBetsAll,
      betsByMatch: result.betsByMatch
    });
    
    return result;
    
  } catch (error: any) {
    logError(`Error checking pending casino bets:`, { error: error.message, stack: error.stack });
    return { success: false, error: error.message };
  }
};

// Function to check for Redis key changes and broadcast updates
const checkAndBroadcastChanges = async (io: Server, dataSource: DataSource) => {
  try {
    const { getRedisClient } = await import("../config/redisConfig");
    const redisClient = getRedisClient();

    const casinoTypes = await discoverCasinoTypesFromRedis();
    logDebug(`Checking ${casinoTypes.length} casino types for changes`, { casinoTypes });

    for (const casinoType of casinoTypes) {
      // Check if room has any subscribers before proceeding
      const room = io.sockets.adapter.rooms.get(`casino:${casinoType}`);
      if (!room || room.size === 0) {
        continue; // Skip if no subscribers
      }

      const currentKey = `casino_data:${casinoType}`;
      const resultsKey = `r_${casinoType}`;

      // Get current Redis values
      const currentRedisData = await redisClient.get(currentKey);
      const resultsRedisData = await redisClient.get(resultsKey);

      // Check if data has changed
      const cachedData = redisKeyCache[casinoType] || {
        current: null,
        results: null,
      };
      const hasCurrentChanged = currentRedisData !== cachedData.current;
      const hasResultsChanged = resultsRedisData !== cachedData.results;

      if (hasCurrentChanged || hasResultsChanged) {
        logInfo(`Data change detected for ${casinoType}`, {
          hasCurrentChanged,
          hasResultsChanged,
          currentDataExists: !!currentRedisData,
          resultsDataExists: !!resultsRedisData
        });
        
        // Update cache
        redisKeyCache[casinoType] = {
          current: currentRedisData,
          results: resultsRedisData,
        };

        // Parse and analyze current data for time-based handling
        let currentData = null;
        let gameState = null;
        let shouldBroadcast = false;
        let shouldSettle = false;

        if (currentRedisData) {
          try {
            const parsedCurrentData = JSON.parse(currentRedisData);
            currentData = parsedCurrentData?.data;
            
            // Analyze game timing and state
            if (currentData) {
              gameState = analyzeGameTiming(casinoType, currentData);
              shouldBroadcast = gameState.shouldBroadcast;
              shouldSettle = gameState.shouldSettle;
              
              logInfo(`Game state for ${casinoType}`, {
                mid: currentData.mid,
                lt: currentData.lt,
                ft: currentData.ft,
                gamePhase: gameState.phase,
                shouldBroadcast,
                shouldSettle
              });
            }
          } catch (error: any) {
            logError(`Failed to parse current data for ${casinoType}`, { error: error.message });
          }
        }

        let resultsData = [];
        if (resultsRedisData) {
          try {
            const parsedResultsData = JSON.parse(resultsRedisData);
            resultsData = parsedResultsData?.data?.res || [];
          } catch (error: any) {
            logError(`Failed to parse results data for ${casinoType}`, { error: error.message });
          }
        }

        // Broadcast based on game state and timing
        if (shouldBroadcast && (currentData || resultsData.length > 0)) {
          io.to(`casino:${casinoType}`).emit("casinoOddsUpdate", {
            casinoType,
            data: {
              casinoType,
              current: currentData,
              results: resultsData,
              timestamp: Date.now(),
              source: "change_detection",
              hasData: true,
              gameState: gameState
            },
          });

          logInfo(`Broadcasted ${casinoType} update`, { phase: gameState?.phase, hasCurrent: !!currentData, hasResults: resultsData.length > 0 });

          // Publish notification to Redis for casino match service to pick up
          try {
            const { getRedisClient } = await import("../config/redisConfig");
            const redisClient = getRedisClient();

            await redisClient.publish(
              `casino_data_updates:${casinoType}`,
              JSON.stringify({
                casinoType,
                hasCurrent: !!currentData,
                hasResults: resultsData.length > 0,
                timestamp: Date.now(),
                source: "socket_change_detection",
                gameState: gameState,
                shouldSettle: shouldSettle
              })
            );

            logInfo(`Published casino data update notification for ${casinoType}`, { gameState, shouldSettle });
          } catch (pubError: any) {
            logError(`Error publishing casino data update notification for ${casinoType}`, { error: pubError.message });
          }

          // Trigger settlement if game is finished
          if (shouldSettle && currentData?.mid) {
            logInfo(`Game finished - triggering settlement for ${casinoType} mid: ${currentData.mid}`);
            await triggerCasinoSettlement(casinoType, currentData.mid, dataSource);
          }

          // Also update casino match database directly
          try {
            logDebug(`Attempting to update casino match database for ${casinoType}`);
            const { getCasinoMatchService } = await import(
              "../services/casino/CasinoMatchService"
            );
            const casinoMatchService = getCasinoMatchService(dataSource);
            const result = await casinoMatchService.updateCasinoMatchFromRedis(
              casinoType
            );
            logInfo(`Successfully updated casino match database for ${casinoType}`, result);
          } catch (dbError: any) {
            logError(`Error updating casino match database for ${casinoType}`, { error: dbError.message });
          }

          logInfo(`Broadcasted change detection update for ${casinoType} to ${room.size} users`);
        }
      }
    }
  } catch (error: any) {
    logError("Error in checkAndBroadcastChanges", { error: error.message, stack: error.stack });
  }
};

// Function to discover casino types from Redis
const discoverCasinoTypesFromRedis = async () => {
  try {
    const { getRedisClient } = await import("../config/redisConfig");
    const redisClient = getRedisClient();

    // console.log("[SOCKET] Discovering casino types from Redis...");

    // Get all keys matching casino_data:* pattern (provider's format)
    const casinoDataKeys = await redisClient.keys("casino_data:*");
    const discoveredCasinoTypes = new Set<string>();

    // Extract casino types from casino_data keys
    for (const key of casinoDataKeys) {
      // Key format: casino_data:{casinoType}
      const parts = key.split(":");
      if (parts.length === 2 && parts[0] === "casino_data") {
        discoveredCasinoTypes.add(parts[1]);
      }
    }

    // Also check for results keys (r_* pattern)
    const resultsKeys = await redisClient.keys("r_*");
    for (const key of resultsKeys) {
      // Key format: r_{casinoType}
      if (key.startsWith("r_")) {
        const casinoType = key.substring(2); // Remove 'r_' prefix
        discoveredCasinoTypes.add(casinoType);
      }
    }

    const casinoTypesArray = Array.from(discoveredCasinoTypes);
    // console.log(`[SOCKET] Discovered ${casinoTypesArray.length} casino types from Redis:`, casinoTypesArray);

    return casinoTypesArray;
  } catch (error) {
    // console.error("[SOCKET] Error discovering casino types from Redis:", error);
    return CASINO_TYPES; // Fallback to predefined list
  }
};

// Function to broadcast all casino data from Redis
const broadcastAllCasinoData = async (io: Server) => {
  try {
    const { getRedisClient } = await import("../config/redisConfig");
    const redisClient = getRedisClient();

    // console.log("[SOCKET] Broadcasting all casino data from Redis cache...");

    // Discover casino types from Redis
    const casinoTypesToBroadcast = await discoverCasinoTypesFromRedis();

    let broadcastCount = 0;
    let activeCount = 0;
    let skippedCount = 0;

    for (const casinoType of casinoTypesToBroadcast) {
      // Check if room has any subscribers before proceeding
      const room = io.sockets.adapter.rooms.get(`casino:${casinoType}`);
      if (!room || room.size === 0) {
        skippedCount++;
        continue; // Skip broadcasting to empty rooms
      }

      const currentKey = `casino_data:${casinoType}`;
      const resultsKey = `r_${casinoType}`;

      // Fetch current data from Redis
      let currentData = null;
      const currentRedisData = await redisClient.get(currentKey);
      if (currentRedisData) {
        const parsedCurrentData = JSON.parse(currentRedisData);
        currentData = parsedCurrentData?.data; // Extract data from provider format
      }

      // Fetch results data from Redis
      let resultsData = [];
      const resultsRedisData = await redisClient.get(resultsKey);
      if (resultsRedisData) {
        const parsedResultsData = JSON.parse(resultsRedisData);
        resultsData = parsedResultsData?.data?.res || []; // Extract results from provider format
      }

      // Only broadcast if there's actual data
      if (currentData || resultsData.length > 0) {
        io.to(`casino:${casinoType}`).emit("casinoOddsUpdate", {
          casinoType,
          data: {
            casinoType,
            current: currentData,
            results: resultsData,
            timestamp: Date.now(),
            source: "redis_cache",
            hasData: true,
          },
        });

        broadcastCount++;
        activeCount++;
        // console.log(`[SOCKET] Broadcasted active data for: ${casinoType} to ${room.size} users`);
      } else {
        // console.log(`[SOCKET] No data to broadcast for: ${casinoType} (room has ${room.size} users)`);
      }
    }

    // console.log(`[SOCKET] Completed broadcasting casino data from cache`);
    // console.log(`[SOCKET] Total broadcasted: ${broadcastCount} casino types`);
    // console.log(`[SOCKET] Skipped (empty rooms): ${skippedCount} casino types`);
    // console.log(`[SOCKET] Active with data: ${activeCount} casino types`);
  } catch (error) {
    // console.error("[SOCKET] Error broadcasting all casino data:", error);
  }
};

// Function to check what casino types are in Redis
const checkRedisCasinoData = async () => {
  try {
    const { getRedisClient } = await import("../config/redisConfig");
    const redisClient = getRedisClient();

    // console.log("[DEBUG] Checking Redis for casino data...");

    interface CasinoData {
      hasCurrent: boolean;
      hasResults: boolean;
      currentSize: number;
      resultsSize: number;
    }

    interface RedisData {
      totalKeys: number;
      discoveredCasinoTypes: string[];
      casinoTypes: Record<string, CasinoData>;
      summary: {
        totalCasinoTypes: number;
        activeCasinos: number;
        inactiveCasinos: number;
        totalKeys: number;
      };
    }

    // Discover casino types from Redis
    const discoveredCasinoTypes = await discoverCasinoTypesFromRedis();

    const redisData: RedisData = {
      totalKeys: 0,
      discoveredCasinoTypes,
      casinoTypes: {},
      summary: {
        totalCasinoTypes: 0,
        activeCasinos: 0,
        inactiveCasinos: 0,
        totalKeys: 0,
      },
    };

    for (const casinoType of discoveredCasinoTypes) {
      const currentKey = `casino_data:${casinoType}`;
      const resultsKey = `r_${casinoType}`;

      // Check current data
      const currentData = await redisClient.get(currentKey);
      const resultsData = await redisClient.get(resultsKey);

      redisData.casinoTypes[casinoType] = {
        hasCurrent: !!currentData,
        hasResults: !!resultsData,
        currentSize: currentData ? currentData.length : 0,
        resultsSize: resultsData ? resultsData.length : 0,
      };

      if (currentData || resultsData) {
        redisData.totalKeys += 2;
      }
    }

    // Calculate summary
    const activeCasinos = Object.values(redisData.casinoTypes).filter(
      (c: CasinoData) => c.hasCurrent || c.hasResults
    ).length;
    const inactiveCasinos = discoveredCasinoTypes.length - activeCasinos;

    redisData.summary = {
      totalCasinoTypes: discoveredCasinoTypes.length,
      activeCasinos,
      inactiveCasinos,
      totalKeys: redisData.totalKeys,
    };

    // console.log("[DEBUG] Redis Casino Data Summary:");
    // console.log(`Discovered Casino Types: ${discoveredCasinoTypes.join(', ')}`);
    // console.log(`Total Casino Types: ${redisData.summary.totalCasinoTypes}`);
    // console.log(`Active Casinos: ${redisData.summary.activeCasinos}`);
    // console.log(`Inactive Casinos: ${redisData.summary.inactiveCasinos}`);
    // console.log(`Total Redis Keys: ${redisData.summary.totalKeys}`);

    return redisData;
  } catch (error) {
    // console.error("[DEBUG] Error checking Redis casino data:", error);
    return null;
  }
};

export function setupSocket(server: HttpServer, dataSource: DataSource) {
  const io = new Server(server, {
    cors: {
      origin: config.socket.cors.origin,
      methods: config.socket.cors.methods,
      credentials: config.socket.cors.credentials,
      allowedHeaders: config.socket.cors.allowedHeaders,
    },
    transports: ["polling", "websocket"],
    allowEIO3: true,
    pingTimeout: config.socket.pingTimeout,
    pingInterval: config.socket.pingInterval,
    upgradeTimeout: config.socket.upgradeTimeout,
    maxHttpBufferSize: config.socket.maxHttpBufferSize,
    path: "/socket.io/",
    serveClient: false,
    cookie: false,
    // Add these for proxy support
    allowRequest: (req, callback) => {
      // Enhanced request validation
      const origin = req.headers.origin;
      const allowedOrigins = config.socket.cors.origin;
      
      if (allowedOrigins === "*" || (Array.isArray(allowedOrigins) && origin && allowedOrigins.includes(origin))) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
  });

  const redisSubscriber = getRedisSubscriber();

  // Add error handling
  io.engine.on("connection_error", (err) => {
    // console.error("Socket.IO connection error:", err);
  });

  io.on("connection", (socket) => {
    // console.log("Socket connected:", socket.id);
    // console.log("Socket headers:", socket.handshake.headers);
    // console.log("Socket query:", socket.handshake.query);

    // Handle casino subscriptions
    socket.on("joinCasino", (casinoType) => {
      if (!casinoType || typeof casinoType !== "string") {
        // console.error(`Invalid casinoType received from socket ${socket.id}:`, casinoType);
        return;
      }
      
      socket.join(`casino:${casinoType}`);
      // console.log(`Socket ${socket.id} joined room casino:${casinoType}`);
      
      // Track user's casino subscriptions
      const userId = Object.keys(activeConnections).find(
        (id) => activeConnections[id].socketId === socket.id
      );
      
      if (userId && activeConnections[userId]) {
        activeConnections[userId].casinoSubscriptions.add(casinoType);
      }
    });

    // Handle casino unsubscriptions
    socket.on("leaveCasino", (casinoType) => {
      if (!casinoType || typeof casinoType !== "string") {
        // console.error(`Invalid casinoType received from socket ${socket.id}:`, casinoType);
        return;
      }
      
      socket.leave(`casino:${casinoType}`);
      // console.log(`Socket ${socket.id} left room casino:${casinoType}`);
      
      // Remove from user's casino subscriptions
      const userId = Object.keys(activeConnections).find(
        (id) => activeConnections[id].socketId === socket.id
      );
      
      if (userId && activeConnections[userId]) {
        activeConnections[userId].casinoSubscriptions.delete(casinoType);
      }
    });

    // Handle bulk casino subscriptions
    socket.on("joinCasinos", (casinoTypes: string[]) => {
      if (!Array.isArray(casinoTypes)) {
        // console.error(`Invalid casinoTypes array received from socket ${socket.id}:`, casinoTypes);
        return;
      }
      
      casinoTypes.forEach((casinoType) => {
        if (typeof casinoType === "string") {
          socket.join(`casino:${casinoType}`);
        }
      });
      
      // console.log(`Socket ${socket.id} joined ${casinoTypes.length} casino rooms:`, casinoTypes);
      
      // Track user's casino subscriptions
      const userId = Object.keys(activeConnections).find(
        (id) => activeConnections[id].socketId === socket.id
      );
      
      if (userId && activeConnections[userId]) {
        casinoTypes.forEach((casinoType) => {
          if (typeof casinoType === "string") {
            activeConnections[userId].casinoSubscriptions.add(casinoType);
          }
        });
      }
    });

    // Handle bulk casino unsubscriptions
    socket.on("leaveCasinos", (casinoTypes: string[]) => {
      if (!Array.isArray(casinoTypes)) {
        // console.error(`Invalid casinoTypes array received from socket ${socket.id}:`, casinoTypes);
        return;
      }
      
      casinoTypes.forEach((casinoType) => {
        if (typeof casinoType === "string") {
          socket.leave(`casino:${casinoType}`);
        }
      });
      
      // console.log(`Socket ${socket.id} left ${casinoTypes.length} casino rooms:`, casinoTypes);
      
      // Remove from user's casino subscriptions
      const userId = Object.keys(activeConnections).find(
        (id) => activeConnections[id].socketId === socket.id
      );
      
      if (userId && activeConnections[userId]) {
        casinoTypes.forEach((casinoType) => {
          if (typeof casinoType === "string") {
            activeConnections[userId].casinoSubscriptions.delete(casinoType);
          }
        });
      }
    });

    // Broadcast all casino data when user connects
    socket.on("requestAllCasinoData", async () => {
      // console.log(`[SOCKET] User ${socket.id} requested all casino data`);
      await broadcastAllCasinoData(io);
    });

    // Debug endpoint to check Redis data
    socket.on("debugRedisData", async () => {
      // console.log(`[SOCKET] User ${socket.id} requested Redis debug data`);
      const redisData = await checkRedisCasinoData();
      socket.emit("redisDebugData", redisData);
    });

    // Manual trigger for casino data updates (for testing)
    socket.on("triggerCasinoUpdate", async (casinoType) => {
      if (!casinoType || typeof casinoType !== "string") {
        socket.emit("error", "Invalid casinoType");
        return;
      }

      // console.log(`[SOCKET] User ${socket.id} triggered manual update for: ${casinoType}`);
      await checkAndBroadcastChanges(io, dataSource);
      socket.emit("casinoUpdateTriggered", {
        casinoType,
        timestamp: Date.now(),
      });
    });

    socket.on("checkLoginId", async ({ loginId, whiteListId }) => {
      try {
        // console.log(
        //   `[SOCKET] Checking loginId: ${loginId}, whitelist: ${whiteListId}`
        // );

        // Validate inputs
        if (!loginId) {
          socket.emit("loginIdCheck", false);
          return;
        }

        const AllUserTypes = [
          "techAdmin",
          "admin",
          "miniAdmin",
          "superMaster",
          "master",
          "superAgent",
          "agent",
          "client",
        ];

        let user: any = null;
        let exists = false;

        for (const role of AllUserTypes) {
          const userRepository = dataSource.getRepository(USER_TABLES[role]);

          // Build where condition based on whether whiteListId is provided
          const whereCondition: any = { loginId };

          // Only add whiteListId to query if it's a valid non-empty string
          if (whiteListId && whiteListId.trim() !== "") {
            whereCondition.whiteListId = whiteListId;
          }

          user = await userRepository.findOne({
            where: whereCondition,
          });

          // console.log("socket :", user);

          if (user) {
            exists = true;
            break;
          }
        }

        socket.emit("loginIdCheck", exists);
      } catch (error) {
        // console.error("Error in checkLoginId socket handler:", error);
        socket.emit("loginIdCheck", false);
      }
    });

    // Login
    socket.on("login", async ({ userId, userType }) => {
      if (!userId) return socket.emit("error", "userId is required");

      // Check for existing connection and force logout
      const existing = activeConnections[userId];
      if (existing) {
        const existingSocket = io.sockets.sockets.get(existing.socketId);
        if (existingSocket) {
          // Send forceLogout event to existing session
          existingSocket.emit("forceLogout", {
            reason: "DUPLICATE_LOGIN",
            message: "Logged in from another device",
            timestamp: new Date().toISOString(),
          });

          // Disconnect after sending the event
          setTimeout(() => {
            existingSocket.disconnect();
          }, 100); // Small delay to ensure event is sent
        }
      }

      // Store new connection with empty casino subscriptions
      activeConnections[userId] = { 
        socketId: socket.id, 
        userType,
        casinoSubscriptions: new Set<string>(),
      };

      // Always join personal room
      socket.join(`user_${userId}`);

      // Join global rooms depending on userType
      if (userType === "client") socket.join("clients");
      if (userType === "admin") socket.join("admins");
      if (userType === "techAdmin") socket.join("techAdmins");

      logInfo(`${userType} ${userId} connected`);

      // Broadcast all casino data to newly connected user
      await broadcastAllCasinoData(io);

      // Notify other users of the same type about new login
      if (userType === "techAdmin") {
        socket.to("techAdmins").emit("adminLogin", {
          adminId: userId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Heartbeat
    socket.on("ping", () => socket.emit("pong"));

    // Logout
    socket.on("logout", ({ userId }) => {
      if (userId && activeConnections[userId]?.socketId === socket.id) {
        // Leave all casino rooms this user was subscribed to
        activeConnections[userId].casinoSubscriptions.forEach((casinoType) => {
          socket.leave(`casino:${casinoType}`);
        });
        
        delete activeConnections[userId];
        socket.leave(`user_${userId}`);
        socket.leave("techAdmins");
        logInfo(`${userId} logged out`);
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      const userId = Object.keys(activeConnections).find(
        (id) => activeConnections[id].socketId === socket.id
      );
      if (userId) {
        delete activeConnections[userId];
        logInfo(`${userId} disconnected`);
      }
    });
  });

  // Casino Odds listener - Listen to both old and new pub/sub patterns
  redisSubscriber.psubscribe("casino_odds_updates:*", (err) => {
    if (err)
      logError("Failed to subscribe to casino_odds_updates:*", { error: err.message });
    else logInfo("Subscribed to casino_odds_updates:* pattern");
  });

  // Also subscribe to provider-specific channels if they exist
  redisSubscriber.psubscribe("casino_data_updates:*", (err) => {
    if (err)
      logError("Failed to subscribe to casino_data_updates:*", { error: err.message });
    else logInfo("Subscribed to casino_data_updates:* pattern");
  });

  redisSubscriber.on("pmessage", async (pattern, channel, message) => {
    if (pattern === "casino_odds_updates:*") {
      try {
        const notification = JSON.parse(message);
        const casinoType = channel.split(":")[1]; // Extract casinoType from channel name

        // Check if room has any subscribers before proceeding
        const room = io.sockets.adapter.rooms.get(`casino:${casinoType}`);
        if (!room || room.size === 0) {
          // console.log(`[SOCKET] Skipping update for ${casinoType} - no subscribers`);
          return; // Skip processing if no subscribers
        }

        // Get Redis client to fetch actual data
        const { getRedisClient } = await import("../config/redisConfig");
        const redisClient = getRedisClient();

        // Fetch current data from Redis
        let currentData = null;
        if (notification.hasCurrent) {
          const currentKey = `casino_data:${casinoType}`;
          const currentRedisData = await redisClient.get(currentKey);
          if (currentRedisData) {
            const parsedCurrentData = JSON.parse(currentRedisData);
            currentData = parsedCurrentData?.data; // Extract data from provider format
          }
        }

        // Fetch results data from Redis
        let resultsData = [];
        if (notification.hasResults) {
          const resultsKey = `r_${casinoType}`;
          const resultsRedisData = await redisClient.get(resultsKey);
          if (resultsRedisData) {
            const parsedResultsData = JSON.parse(resultsRedisData);
            resultsData = parsedResultsData?.data?.res || []; // Extract results from provider format
          }
        }

        // Only broadcast if there's actual data
        if (currentData || resultsData.length > 0) {
          io.to(`casino:${casinoType}`).emit("casinoOddsUpdate", {
            casinoType,
            data: {
              casinoType,
              current: currentData,
              results: resultsData,
              timestamp: notification.timestamp,
              source: "live_update",
            },
          });

          // console.log(
          //   `[SOCKET] Broadcasted casino odds update for: ${casinoType} to ${room.size} users`
          // );
        } else {
          // console.log(
          //   `[SOCKET] No data to broadcast for: ${casinoType} (room has ${room.size} users)`
          // );
        }
      } catch (error: any) {
        logError("Error processing casino odds update", { error: error.message, stack: error.stack });
      }
    } else if (pattern === "casino_data_updates:*") {
      // Handle provider-specific updates
      try {
        const notification = JSON.parse(message);
        const casinoType = channel.split(":")[1]; // Extract casinoType from channel name

        // Check if room has any subscribers before proceeding
        const room = io.sockets.adapter.rooms.get(`casino:${casinoType}`);
        if (!room || room.size === 0) {
          return; // Skip processing if no subscribers
        }

        // Get Redis client to fetch actual data
        const { getRedisClient } = await import("../config/redisConfig");
        const redisClient = getRedisClient();

        // Fetch current data from Redis
        let currentData = null;
        const currentKey = `casino_data:${casinoType}`;
        const currentRedisData = await redisClient.get(currentKey);
        if (currentRedisData) {
          const parsedCurrentData = JSON.parse(currentRedisData);
          currentData = parsedCurrentData?.data; // Extract data from provider format
        }

        // Fetch results data from Redis
        let resultsData = [];
        const resultsKey = `r_${casinoType}`;
        const resultsRedisData = await redisClient.get(resultsKey);
        if (resultsRedisData) {
          const parsedResultsData = JSON.parse(resultsRedisData);
          resultsData = parsedResultsData?.data?.res || []; // Extract results from provider format
        }

        // Only broadcast if there's actual data
        if (currentData || resultsData.length > 0) {
          io.to(`casino:${casinoType}`).emit("casinoOddsUpdate", {
            casinoType,
            data: {
              casinoType,
              current: currentData,
              results: resultsData,
              timestamp: notification.timestamp || Date.now(),
              source: "provider_update",
            },
          });

          console.log(
            `[SOCKET] Broadcasted provider casino update for: ${casinoType} to ${room.size} users`
          );
        }
      } catch (error: any) {
        logError("Error processing provider casino update", { error: error.message, stack: error.stack });
      }
    }
  });

  // Sports Odds listener - OPTIMIZED VERSION
  redisSubscriber.subscribe("sports_odds_updates", (err) => {
    if (err) logError("Failed to subscribe to sports_odds_updates", { error: err.message });
    else logInfo("Subscribed to sports_odds_updates channel");
  });

  redisSubscriber.on("message", async (channel, message) => {
    if (channel === "sports_odds_updates") {
      try {
        const notification = JSON.parse(message);
        const { sport_id, event_id, hasData } = notification;

        // Get Redis client to fetch actual data
        const { getRedisClient } = await import("../config/redisConfig");
        const redisClient = getRedisClient();

        // Fetch data from Redis
        let data = null;
        if (hasData) {
          const redisKey = `odds:sport:${sport_id}:event:${event_id}`;
          const redisData = await redisClient.get(redisKey);
          if (redisData) {
            data = JSON.parse(redisData);
          }
        }

        // Broadcast complete data from Redis to ALL connected users
        io.emit("sportsOddsUpdate", {
          type: "sports_odds_updates",
          sport_id,
          event_id,
          data: data,
          timestamp: notification.timestamp,
        });

        // console.log(
        //   `[SOCKET] Broadcasted odds update for sport ${sport_id}, event ${event_id} (from Redis)`
        // );
      } catch (error: any) {
        logError("Error processing sports odds update", { error: error.message, stack: error.stack });
      }
    }
  });

  /**
   * DATABASE UPDATE INTERVAL - Configurable
   *
   * Purpose: Updates casino_match_new table with current match data and winner information
   * Frequency: Configurable via CASINO_SETTLEMENT_INTERVAL (default: 60 seconds)
   *
   * What it does:
   * - Fetches all casino data from Redis (casino_data:* and r_* keys)
   * - Batch upserts current matches to avoid individual DB calls
   * - Updates winner fields for completed matches
   * - Maintains data consistency between Redis and PostgreSQL
   *
   * Performance: Single batch operation reduces DB load by 95%
   */
  setInterval(async () => {
    logInfo("Database update triggered - single batch update");

    try {
      // Import service dynamically to avoid circular dependencies
      const { getCasinoMatchService } = await import(
        "../services/casino/CasinoMatchService"
      );
      const casinoMatchService = getCasinoMatchService(dataSource);

      // Execute optimized batch update for all casino types
      const result = await casinoMatchService.updateAllCasinoMatchesFromRedis();
      logInfo("Completed single batch update", result);
    } catch (error: any) {
      logError("Error in single batch update", { error: error.message, stack: error.stack });
      // Continue execution - database errors shouldn't crash the socket service
    }
  }, config.casino.settlementInterval);

  /**
   * CHANGE DETECTION INTERVAL - Configurable
   *
   * Purpose: Real-time broadcasting of casino data changes with time-based game state analysis
   * Frequency: Configurable via CASINO_CHANGE_DETECTION_INTERVAL (default: 10 seconds)
   *
   * What it does:
   * - Monitors Redis keys for casino data changes using cache comparison
   * - Analyzes game timing fields (lt, ft, mid) to determine game phase
   * - Broadcasts updates based on game state (RUNNING, FINISHING, FINISHED)
   * - Triggers immediate settlement when games finish (lt = 0)
   * - Sends updates to subscribed casino rooms only (smart filtering)
   * - Publishes notifications to Redis pub/sub channels with game state
   * - Updates casino match database with latest data
   * - Provides comprehensive change detection and settlement logging
   *
   * Game Phases:
   * - RUNNING: Game is active (lt > 5 seconds)
   * - FINISHING: Game is about to end (lt <= 5 seconds)
   * - FINISHED: Game has ended (lt = 0) → Triggers settlement
   * - SUSPENDED: Game is paused
   *
   * Performance: 
   * - Smart filtering prevents unnecessary broadcasts
   * - Only broadcasts to rooms with active subscribers
   * - Fast response time for casino data changes
   * - Immediate settlement when games finish
   * - Optimized for real-time user experience
   */
  setInterval(async () => {
    logDebug("Change detection triggered");
    await checkAndBroadcastChanges(io, dataSource);
  }, config.casino.changeDetectionInterval);

  /**
   * FALLBACK BROADCAST INTERVAL - Configurable
   *
   * Purpose: Ensures all casino data is delivered to clients even if change detection misses updates
   * Frequency: Configurable via CASINO_FALLBACK_BROADCAST_INTERVAL (default: 30 seconds)
   *
   * What it does:
   * - Checks for active subscribers before broadcasting
   * - Sends complete casino data to all subscribed rooms
   * - Acts as a safety net for missed real-time updates
   * - Prevents data staleness for connected clients
   *
   * Performance: Only broadcasts when subscribers are present
   */
  setInterval(async () => {
    logDebug("Fallback broadcast triggered");

    // Check if any casino rooms have active subscribers
    let hasSubscribers = false;
    const casinoTypes = await discoverCasinoTypesFromRedis();
    
    for (const casinoType of casinoTypes) {
      const room = io.sockets.adapter.rooms.get(`casino:${casinoType}`);
      if (room && room.size > 0) {
        hasSubscribers = true;
        break; // Exit early if subscribers found
      }
    }
    
    if (hasSubscribers) {
      logInfo("Fallback broadcast - active subscribers found");
      await broadcastAllCasinoData(io);
    } else {
      logDebug("Fallback broadcast - no active subscribers, skipping");
    }
  }, config.casino.fallbackBroadcastInterval);

  /**
   * AUTOMATIC SETTLEMENT INTERVAL - Configurable
   *
   * Purpose: Automatically settle completed casino matches using pub/sub pattern
   * Frequency: Configurable via CASINO_SETTLEMENT_INTERVAL (default: 60 seconds)
   *
   * What it does:
   * - Monitors Redis results data for completed matches
   * - Automatically fetches result data from third-party API
   * - Updates casino_match_new table with result data
   * - Settles all pending bets for completed matches
   * - Provides comprehensive settlement statistics
   *
   * Performance: Batch settlement operations with smart filtering
   */
  setInterval(async () => {
    logDebug("Automatic settlement triggered");

    try {
      // Import settlement service dynamically to avoid circular dependencies
      const { getCasinoSettlementService } = await import(
        "../services/casino/CasinoSettlementService"
      );
      const casinoSettlementService = getCasinoSettlementService(dataSource);

      // Get all casino types from predefined list
      const casinoTypes = [
        "dt6",
        "teen",
        "poker",
        "teen20",
        "teen9",
        "teen8",
        "poker20",
        "poker6",
        "card32eu",
        "war",
        "aaa",
        "abj",
        "dt20",
        "lucky7eu",
        "dt202",
        "teenmuf",
        "teen20c",
        "btable2",
        "goal",
        "baccarat2",
        "lucky5",
        "joker20",
        "joker1",
        "ab4",
        "lottcard",
        "poison20",
      ];

      // ULTRA-OPTIMIZED: Collect all potential matches first, then batch check for bets
      const potentialMatches = [];
      const { getRedisClient } = await import("../config/redisConfig");
      const redisClient = getRedisClient();

      // Collect all potential matches from Redis results
      for (const casinoType of casinoTypes) {
        try {
          const resultsKey = `r_${casinoType}`;
          const resultsRedisData = await redisClient.get(resultsKey);

          if (resultsRedisData) {
            const parsedResultsData = JSON.parse(resultsRedisData);
            const resultsData = parsedResultsData?.data?.res || [];

            for (const result of resultsData) {
              const resultMid = String(result.mid || result.matchId);
              const winner = result.win || result.result || result.winner;

              if (resultMid && winner) {
                potentialMatches.push({ casinoType, mid: resultMid });
              }
            }
          }
        } catch (error: any) {
          logError(`Error collecting potential matches for ${casinoType}`, { error: error.message, stack: error.stack });
        }
      }

      logInfo(`Found ${potentialMatches.length} potential matches from Redis`);

      if (potentialMatches.length === 0) {
        logInfo("No potential matches found - skipping settlement check");
        return;
      }

      // SINGLE BATCH QUERY: Check all potential matches for pending bets at once
      const { CasinoBet } = await import("../entities/casino/CasinoBet");
      const { In } = await import("typeorm");

      const allMatchIds = potentialMatches.map((m) => m.mid);
      const allPendingBets = await dataSource.getRepository(CasinoBet).find({
        where: {
          matchId: In(allMatchIds),
          status: "pending",
        },
      });

      logInfo(`Found ${allPendingBets.length} total pending bets across all potential matches`);

      // Group bets by match ID
      const betsByMatch = new Map<string, any[]>();
      for (const bet of allPendingBets) {
        if (!betsByMatch.has(bet.matchId)) {
          betsByMatch.set(bet.matchId, []);
        }
        betsByMatch.get(bet.matchId)!.push(bet);
      }

      // Filter matches that have pending bets
      const matchesToSettle = potentialMatches.filter((match) => {
        const hasBets = betsByMatch.has(match.mid);
        if (hasBets) {
          logDebug(`Match ${match.mid} has ${betsByMatch.get(match.mid)!.length} pending bets - added to settlement queue`);
        }
        return hasBets;
      });

      if (matchesToSettle.length > 0) {
        logInfo(`Found ${matchesToSettle.length} matches requiring settlement`);

        // Execute batch settlement
        const settlementResult =
          await casinoSettlementService.batchSettleMatches(matchesToSettle);
        logInfo("Automatic settlement completed", settlementResult);

        // Publish settlement notification for other services
        const { getRedisClient: getRedisClientForPublish } = await import(
          "../config/redisConfig"
        );
        const redisClientForPublish = getRedisClientForPublish();
        await redisClientForPublish.publish(
          "casino_settlement_completed",
          JSON.stringify({
            timestamp: new Date().toISOString(),
            matchesSettled: matchesToSettle.length,
            totalBetsSettled: settlementResult.totalSettledCount,
            errors: settlementResult.totalErrors,
            matches: matchesToSettle,
          })
        );
      } else {
        logInfo("No matches requiring settlement found");
      }
    } catch (error: any) {
      logError("Error in automatic settlement", { error: error.message, stack: error.stack });
      // Continue execution - settlement errors shouldn't crash the socket service
    }
  }, config.casino.settlementInterval);

  /**
   * AUTOMATIC SPORT SETTLEMENT INTERVAL - Configurable
   *
   * Purpose: Automatically settle completed sport matches using third-party APIs
   * Frequency: Configurable via SPORTS_SETTLEMENT_INTERVAL (default: 60 seconds)
   *
   * What it does:
   * - Monitors SportMatch table for events with null result data
   * - Fetches result data from fancy and diamond APIs
   * - Updates SportMatch result data when null
   * - Settles all pending sport bets for completed matches
   * - Provides comprehensive settlement statistics
   *
   * Performance: Batch settlement operations with smart filtering
   */
  setInterval(async () => {
    logDebug("Automatic sport settlement triggered");

    try {
      // Check database connection
      if (!dataSource.isInitialized) {
        logWarn("Database not initialized, skipping sport settlement");
        return;
      }

      // Import sport settlement service dynamically to avoid circular dependencies
      const { SportSettlementService } = await import(
        "../services/sports/SportSettlementService"
      );
      const sportSettlementService = new SportSettlementService(dataSource);

      // Get all sport events with pending bets AND events with null result data
      const sportBetRepo = dataSource.getRepository("SportBet");
      const sportMatchRepo = dataSource.getRepository("SportMatch");

      // Find all events with pending bets
      const pendingBets = await sportBetRepo.find({
        where: { status: "pending" },
        select: ["eventId"]
      });

      // Find all SportMatch records with null result data
      const sportMatchesWithNullResults = await sportMatchRepo.find({
        select: ["eventId"]
      });

      // Filter for matches with null result data (post-query filtering for JSON fields)
      const matchesWithNullResults = sportMatchesWithNullResults.filter((match: any) => {
        return match.categories && match.categories.some((cat: any) => cat.resultData === null);
      });

      // Combine both sets of event IDs
      const pendingBetEventIds = [...new Set(pendingBets.map(bet => bet.eventId))];
      const nullResultEventIds = [...new Set(matchesWithNullResults.map(match => match.eventId))];
      const allEventIds = [...new Set([...pendingBetEventIds, ...nullResultEventIds])];

      if (allEventIds.length === 0) {
        logInfo("No sport events found - skipping settlement");
        return;
      }

      logInfo(`Found ${allEventIds.length} sport events to process`, {
        pendingBets: pendingBetEventIds.length,
        nullResults: nullResultEventIds.length,
        total: allEventIds.length
      });

      // Execute batch settlement
      const settlementResult = await sportSettlementService.batchSettleMatches(allEventIds);
      logInfo("Automatic sport settlement completed", settlementResult);

      // Publish settlement notification for other services
      const { getRedisClient: getRedisClientForPublish } = await import(
        "../config/redisConfig"
      );
      const redisClientForPublish = getRedisClientForPublish();
      await redisClientForPublish.publish(
        "sport_settlement_completed",
        JSON.stringify({
          timestamp: new Date().toISOString(),
          eventsSettled: allEventIds.length,
          totalBetsSettled: settlementResult.settledCount,
          errors: settlementResult.errorCount,
          events: allEventIds,
        })
      );

    } catch (error: any) {
      logError("Error in automatic sport settlement", { error: error.message, stack: error.stack });
      
      // If it's a database connection error, try to reinitialize
      if (error.message && error.message.includes("Driver not Connected")) {
        logWarn("Database connection lost, attempting to reconnect");
        try {
          if (!dataSource.isInitialized) {
            await dataSource.initialize();
            logInfo("Database reconnected successfully");
          }
        } catch (reconnectError: any) {
          logError("Failed to reconnect to database", { error: reconnectError.message });
        }
      }
      
      // Continue execution - settlement errors shouldn't crash the socket service
    }
  }, config.sports.settlementInterval);

  return io;
}

// Optional helpers
export const getUserSocket = (io: Server, userId: string) => {
  const conn = activeConnections[userId];
  return conn ? io.sockets.sockets.get(conn.socketId) : undefined;
};

export const isTechAdmin = (userId: string) =>
  activeConnections[userId]?.userType === "techAdmin";
