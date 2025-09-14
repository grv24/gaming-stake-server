import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { getRedisSubscriber } from "../config/redisPubSub";
import { USER_TABLES } from "../Helpers/users/Roles";
import { DataSource } from "typeorm";

// Casino types from Validation.ts
const CASINO_TYPES = [
  "dt6", "teen", "poker", "teen20", "teen9", "teen8", "poker20", "poker6",
  "card32eu", "war", "aaa", "abj", "dt20", "lucky7eu", "dt202", "teenmuf",
  "teen20c", "btable2", "goal", "baccarat2", "lucky5", "joker20", "joker1",
  "ab4", "lottcard", "poison20"
];

interface UserConnection {
  socketId: string;
  userType: "user" | "techAdmin";
  casinoSubscriptions: Set<string>; // Track which casino types user is subscribed to
}

const activeConnections: Record<string, UserConnection> = {};

// Cache for tracking Redis key changes
const redisKeyCache: Record<string, { current: string | null, results: string | null }> = {};

// Function to check for Redis key changes and broadcast updates
const checkAndBroadcastChanges = async (io: Server, dataSource: DataSource) => {
  try {
    const { getRedisClient } = await import("../config/redisConfig");
    const redisClient = getRedisClient();

    const casinoTypes = await discoverCasinoTypesFromRedis();
    console.log(`[SOCKET] Checking ${casinoTypes.length} casino types for changes:`, casinoTypes);
    
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
      const cachedData = redisKeyCache[casinoType] || { current: null, results: null };
      const hasCurrentChanged = currentRedisData !== cachedData.current;
      const hasResultsChanged = resultsRedisData !== cachedData.results;

      if (hasCurrentChanged || hasResultsChanged) {
        // Update cache
        redisKeyCache[casinoType] = {
          current: currentRedisData,
          results: resultsRedisData
        };

        // Parse and broadcast data
        let currentData = null;
        if (currentRedisData) {
          try {
            const parsedCurrentData = JSON.parse(currentRedisData);
            currentData = parsedCurrentData?.data;
          } catch (error) {
            console.error(`[SOCKET] Failed to parse current data for ${casinoType}:`, error);
          }
        }

        let resultsData = [];
        if (resultsRedisData) {
          try {
            const parsedResultsData = JSON.parse(resultsRedisData);
            resultsData = parsedResultsData?.data?.res || [];
          } catch (error) {
            console.error(`[SOCKET] Failed to parse results data for ${casinoType}:`, error);
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
              timestamp: Date.now(),
              source: "change_detection",
              hasData: true
            }
          });

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
                source: "socket_change_detection"
              })
            );
            
            console.log(`[SOCKET] Published casino data update notification for: ${casinoType}`);
          } catch (pubError) {
            console.error(`[SOCKET] Error publishing casino data update notification for ${casinoType}:`, pubError);
          }

          // Also update casino match database directly
          try {
            console.log(`[SOCKET] Attempting to update casino match database for: ${casinoType}`);
            const { getCasinoMatchService } = await import("../services/casino/CasinoMatchService");
            const casinoMatchService = getCasinoMatchService(dataSource);
            const result = await casinoMatchService.updateCasinoMatchFromRedis(casinoType);
            console.log(`[SOCKET] Successfully updated casino match database for: ${casinoType}`, result);
          } catch (dbError) {
            console.error(`[SOCKET] Error updating casino match database for ${casinoType}:`, dbError);
          }

          console.log(
            `[SOCKET] Broadcasted change detection update for: ${casinoType} to ${room.size} users`
          );
        }
      }
    }
  } catch (error) {
    console.error("[SOCKET] Error in checkAndBroadcastChanges:", error);
  }
};

// Function to discover casino types from Redis
const discoverCasinoTypesFromRedis = async () => {
  try {
    const { getRedisClient } = await import("../config/redisConfig");
    const redisClient = getRedisClient();

    // console.log("[SOCKET] Discovering casino types from Redis...");

    // Get all keys matching casino_data:* pattern (provider's format)
    const casinoDataKeys = await redisClient.keys('casino_data:*');
    const discoveredCasinoTypes = new Set<string>();

    // Extract casino types from casino_data keys
    for (const key of casinoDataKeys) {
      // Key format: casino_data:{casinoType}
      const parts = key.split(':');
      if (parts.length === 2 && parts[0] === 'casino_data') {
        discoveredCasinoTypes.add(parts[1]);
      }
    }

    // Also check for results keys (r_* pattern)
    const resultsKeys = await redisClient.keys('r_*');
    for (const key of resultsKeys) {
      // Key format: r_{casinoType}
      if (key.startsWith('r_')) {
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
            hasData: true
          }
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
        totalKeys: 0
      }
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
        resultsSize: resultsData ? resultsData.length : 0
      };

      if (currentData || resultsData) {
        redisData.totalKeys += 2;
      }
    }

    // Calculate summary
    const activeCasinos = Object.values(redisData.casinoTypes).filter((c: CasinoData) => c.hasCurrent || c.hasResults).length;
    const inactiveCasinos = discoveredCasinoTypes.length - activeCasinos;

    redisData.summary = {
      totalCasinoTypes: discoveredCasinoTypes.length,
      activeCasinos,
      inactiveCasinos,
      totalKeys: redisData.totalKeys
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
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e8,
    path: '/socket.io/',
    serveClient: false,
    cookie: false,
    // Add these for proxy support
    allowRequest: (req, callback) => {
      callback(null, true); // Allow all requests
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
      if (!casinoType || typeof casinoType !== 'string') {
        // console.error(`Invalid casinoType received from socket ${socket.id}:`, casinoType);
        return;
      }
      
      socket.join(`casino:${casinoType}`);
      // console.log(`Socket ${socket.id} joined room casino:${casinoType}`);
      
      // Track user's casino subscriptions
      const userId = Object.keys(activeConnections).find(
        id => activeConnections[id].socketId === socket.id
      );
      
      if (userId && activeConnections[userId]) {
        activeConnections[userId].casinoSubscriptions.add(casinoType);
      }
    });

    // Handle casino unsubscriptions
    socket.on("leaveCasino", (casinoType) => {
      if (!casinoType || typeof casinoType !== 'string') {
        // console.error(`Invalid casinoType received from socket ${socket.id}:`, casinoType);
        return;
      }
      
      socket.leave(`casino:${casinoType}`);
      // console.log(`Socket ${socket.id} left room casino:${casinoType}`);
      
      // Remove from user's casino subscriptions
      const userId = Object.keys(activeConnections).find(
        id => activeConnections[id].socketId === socket.id
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
      
      casinoTypes.forEach(casinoType => {
        if (typeof casinoType === 'string') {
          socket.join(`casino:${casinoType}`);
        }
      });
      
      // console.log(`Socket ${socket.id} joined ${casinoTypes.length} casino rooms:`, casinoTypes);
      
      // Track user's casino subscriptions
      const userId = Object.keys(activeConnections).find(
        id => activeConnections[id].socketId === socket.id
      );
      
      if (userId && activeConnections[userId]) {
        casinoTypes.forEach(casinoType => {
          if (typeof casinoType === 'string') {
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
      
      casinoTypes.forEach(casinoType => {
        if (typeof casinoType === 'string') {
          socket.leave(`casino:${casinoType}`);
        }
      });
      
      // console.log(`Socket ${socket.id} left ${casinoTypes.length} casino rooms:`, casinoTypes);
      
      // Remove from user's casino subscriptions
      const userId = Object.keys(activeConnections).find(
        id => activeConnections[id].socketId === socket.id
      );
      
      if (userId && activeConnections[userId]) {
        casinoTypes.forEach(casinoType => {
          if (typeof casinoType === 'string') {
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
      if (!casinoType || typeof casinoType !== 'string') {
        socket.emit("error", "Invalid casinoType");
        return;
      }
      
      // console.log(`[SOCKET] User ${socket.id} triggered manual update for: ${casinoType}`);
      await checkAndBroadcastChanges(io, dataSource);
      socket.emit("casinoUpdateTriggered", { casinoType, timestamp: Date.now() });
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
        casinoSubscriptions: new Set<string>()
      };

      // Always join personal room
      socket.join(`user_${userId}`);

      // Join global rooms depending on userType
      if (userType === "client") socket.join("clients");
      if (userType === "admin") socket.join("admins");
      if (userType === "techAdmin") socket.join("techAdmins");

      console.log(`${userType} ${userId} connected`);

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
        activeConnections[userId].casinoSubscriptions.forEach(casinoType => {
          socket.leave(`casino:${casinoType}`);
        });
        
        delete activeConnections[userId];
        socket.leave(`user_${userId}`);
        socket.leave("techAdmins");
        console.log(`${userId} logged out`);
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      const userId = Object.keys(activeConnections).find(
        (id) => activeConnections[id].socketId === socket.id
      );
      if (userId) {
        delete activeConnections[userId];
        console.log(`${userId} disconnected`);
      }
    });
  });

  // Casino Odds listener - Listen to both old and new pub/sub patterns
  redisSubscriber.psubscribe("casino_odds_updates:*", (err) => {
    if (err) console.error("Failed to subscribe to casino_odds_updates:*:", err);
    else console.log("Subscribed to casino_odds_updates:* pattern");
  });

  // Also subscribe to provider-specific channels if they exist
  redisSubscriber.psubscribe("casino_data_updates:*", (err) => {
    if (err) console.error("Failed to subscribe to casino_data_updates:*:", err);
    else console.log("Subscribed to casino_data_updates:* pattern");
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
              source: "live_update"
            }
          });

          // console.log(
          //   `[SOCKET] Broadcasted casino odds update for: ${casinoType} to ${room.size} users`
          // );
        } else {
          // console.log(
          //   `[SOCKET] No data to broadcast for: ${casinoType} (room has ${room.size} users)`
          // );
        }
      } catch (error) {
        console.error("Error processing casino odds update:", error);
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
              source: "provider_update"
            }
          });

          console.log(
            `[SOCKET] Broadcasted provider casino update for: ${casinoType} to ${room.size} users`
          );
        }
      } catch (error) {
        console.error("Error processing provider casino update:", error);
      }
    }
  });

  // Sports Odds listener - OPTIMIZED VERSION
  redisSubscriber.subscribe("sports_odds_updates", (err) => {
    if (err) console.error("Failed to subscribe to sports_odds_updates:", err);
    else console.log("Subscribed to sports_odds_updates channel");
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
          type: 'sports_odds_updates',
          sport_id,
          event_id,
          data: data,
          timestamp: notification.timestamp
        });

        // console.log(
        //   `[SOCKET] Broadcasted odds update for sport ${sport_id}, event ${event_id} (from Redis)`
        // );
      } catch (error) {
        console.error("Error processing sports odds update:", error);
      }
    }
  });

  // Smart periodic broadcast - more frequent for provider data updates
  setInterval(async () => {
    console.log("[SOCKET] Periodic check triggered - updating all casino types");
    
    // Always update all casino types, regardless of subscribers
    for (const casinoType of CASINO_TYPES) {
      try {
        console.log(`[SOCKET] Updating casino match database for: ${casinoType}`);
        const { getCasinoMatchService } = await import("../services/casino/CasinoMatchService");
        const casinoMatchService = getCasinoMatchService(dataSource);
        const result = await casinoMatchService.updateCasinoMatchFromRedis(casinoType);
        console.log(`[SOCKET] Updated casino match database for: ${casinoType}`, result);
      } catch (error) {
        console.error(`[SOCKET] Error updating casino match database for ${casinoType}:`, error);
      }
    }
    
    // Also run change detection for broadcasting to subscribers
    await checkAndBroadcastChanges(io, dataSource);
  }, 10 * 1000); // 10 seconds for very frequent updates

  // Fallback periodic broadcast - less frequent but ensures all data is sent
  setInterval(async () => {
    // Check if any casino rooms have subscribers
    let hasSubscribers = false;
    const casinoTypes = await discoverCasinoTypesFromRedis();
    
    for (const casinoType of casinoTypes) {
      const room = io.sockets.adapter.rooms.get(`casino:${casinoType}`);
      if (room && room.size > 0) {
        hasSubscribers = true;
        break;
      }
    }
    
    if (hasSubscribers) {
      // console.log("[SOCKET] Fallback broadcast triggered - active subscribers found");
      await broadcastAllCasinoData(io);
    }
  }, 60 * 1000); // 1 minute fallback

  return io;
}

// Optional helpers
export const getUserSocket = (io: Server, userId: string) => {
  const conn = activeConnections[userId];
  return conn ? io.sockets.sockets.get(conn.socketId) : undefined;
};

export const isTechAdmin = (userId: string) =>
  activeConnections[userId]?.userType === "techAdmin";

// import { Server } from "socket.io";
// import { Server as HttpServer } from "http";
// import { getRedisSubscriber } from "../config/redisPubSub";
// import { USER_TABLES } from "../Helpers/users/Roles";
// import { DataSource } from "typeorm";

// // Casino types from Validation.ts
// const CASINO_TYPES = [
//   "dt6", "teen", "poker", "teen20", "teen9", "teen8", "poker20", "poker6",
//   "card32eu", "war", "aaa", "abj", "dt20", "lucky7eu", "dt202", "teenmuf",
//   "teen20c", "btable2", "goal", "baccarat2", "lucky5", "joker20", "joker1",
//   "ab4", "lottcard"
// ];

// interface UserConnection {
//   socketId: string;
//   userType: "user" | "techAdmin";
// }

// const activeConnections: Record<string, UserConnection> = {};

// // Function to discover casino types from Redis
// const discoverCasinoTypesFromRedis = async () => {
//   try {
//     const { getRedisClient } = await import("../config/redisConfig");
//     const redisClient = getRedisClient();

//     console.log("[SOCKET] Discovering casino types from Redis...");

//     // Get all keys matching casino:* pattern
//     const keys = await redisClient.keys('casino:*');
//     const discoveredCasinoTypes = new Set<string>();

//     // Extract casino types from keys
//     for (const key of keys) {
//       // Key format: casino:{casinoType}:{current|results}
//       const parts = key.split(':');
//       if (parts.length === 3 && parts[0] === 'casino') {
//         discoveredCasinoTypes.add(parts[1]);
//       }
//     }

//     const casinoTypesArray = Array.from(discoveredCasinoTypes);
//     console.log(`[SOCKET] Discovered ${casinoTypesArray.length} casino types from Redis:`, casinoTypesArray);

//     return casinoTypesArray;
//   } catch (error) {
//     console.error("[SOCKET] Error discovering casino types from Redis:", error);
//     return CASINO_TYPES; // Fallback to predefined list
//   }
// };

// // Function to broadcast all casino data from Redis
// const broadcastAllCasinoData = async (io: Server) => {
//   try {
//     const { getRedisClient } = await import("../config/redisConfig");
//     const redisClient = getRedisClient();

//     console.log("[SOCKET] Broadcasting all casino data from Redis cache...");

//     // Discover casino types from Redis
//     const casinoTypesToBroadcast = await discoverCasinoTypesFromRedis();

//     let broadcastCount = 0;
//     let activeCount = 0;

//     for (const casinoType of casinoTypesToBroadcast) {
//       const currentKey = `casino:${casinoType}:current`;
//       const resultsKey = `casino:${casinoType}:results`;

//       // Fetch current data from Redis
//       let currentData = null;
//       const currentRedisData = await redisClient.get(currentKey);
//       if (currentRedisData) {
//         currentData = JSON.parse(currentRedisData);
//       }

//       // Fetch results data from Redis
//       let resultsData = [];
//       const resultsRedisData = await redisClient.get(resultsKey);
//       if (resultsRedisData) {
//         resultsData = JSON.parse(resultsRedisData);
//       }

//       // Broadcast casino data
//       io.emit("casinoOddsUpdate", {
//         casinoType,
//         data: {
//           casinoType,
//           current: currentData,
//           results: resultsData,
//           timestamp: Date.now(),
//           source: "redis_cache",
//           hasData: !!(currentData || resultsData.length > 0)
//         }
//       });

//       broadcastCount++;
//       if (currentData || resultsData.length > 0) {
//         activeCount++;
//         console.log(`[SOCKET] Broadcasted active data for: ${casinoType}`);
//       } else {
//         console.log(`[SOCKET] Broadcasted empty data for: ${casinoType}`);
//       }
//     }

//     console.log(`[SOCKET] Completed broadcasting all casino data from cache`);
//     console.log(`[SOCKET] Total broadcasted: ${broadcastCount} casino types`);
//     console.log(`[SOCKET] Active with data: ${activeCount} casino types`);
//     console.log(`[SOCKET] Inactive/empty: ${broadcastCount - activeCount} casino types`);
//   } catch (error) {
//     console.error("[SOCKET] Error broadcasting all casino data:", error);
//   }
// };

// // Function to check what casino types are in Redis
// const checkRedisCasinoData = async () => {
//   try {
//     const { getRedisClient } = await import("../config/redisConfig");
//     const redisClient = getRedisClient();

//     console.log("[DEBUG] Checking Redis for casino data...");

//     interface CasinoData {
//       hasCurrent: boolean;
//       hasResults: boolean;
//       currentSize: number;
//       resultsSize: number;
//     }

//     interface RedisData {
//       totalKeys: number;
//       discoveredCasinoTypes: string[];
//       casinoTypes: Record<string, CasinoData>;
//       summary: {
//         totalCasinoTypes: number;
//         activeCasinos: number;
//         inactiveCasinos: number;
//         totalKeys: number;
//       };
//     }

//     // Discover casino types from Redis
//     const discoveredCasinoTypes = await discoverCasinoTypesFromRedis();

//     const redisData: RedisData = {
//       totalKeys: 0,
//       discoveredCasinoTypes,
//       casinoTypes: {},
//       summary: {
//         totalCasinoTypes: 0,
//         activeCasinos: 0,
//         inactiveCasinos: 0,
//         totalKeys: 0
//       }
//     };

//     for (const casinoType of discoveredCasinoTypes) {
//       const currentKey = `casino:${casinoType}:current`;
//       const resultsKey = `casino:${casinoType}:results`;

//       // Check current data
//       const currentData = await redisClient.get(currentKey);
//       const resultsData = await redisClient.get(resultsKey);

//       redisData.casinoTypes[casinoType] = {
//         hasCurrent: !!currentData,
//         hasResults: !!resultsData,
//         currentSize: currentData ? currentData.length : 0,
//         resultsSize: resultsData ? resultsData.length : 0
//       };

//       if (currentData || resultsData) {
//         redisData.totalKeys += 2;
//       }
//     }

//     // Calculate summary
//     const activeCasinos = Object.values(redisData.casinoTypes).filter((c: CasinoData) => c.hasCurrent || c.hasResults).length;
//     const inactiveCasinos = discoveredCasinoTypes.length - activeCasinos;

//     redisData.summary = {
//       totalCasinoTypes: discoveredCasinoTypes.length,
//       activeCasinos,
//       inactiveCasinos,
//       totalKeys: redisData.totalKeys
//     };

//     console.log("[DEBUG] Redis Casino Data Summary:");
//     console.log(`Discovered Casino Types: ${discoveredCasinoTypes.join(', ')}`);
//     console.log(`Total Casino Types: ${redisData.summary.totalCasinoTypes}`);
//     console.log(`Active Casinos: ${redisData.summary.activeCasinos}`);
//     console.log(`Inactive Casinos: ${redisData.summary.inactiveCasinos}`);
//     console.log(`Total Redis Keys: ${redisData.summary.totalKeys}`);

//     return redisData;
//   } catch (error) {
//     console.error("[DEBUG] Error checking Redis casino data:", error);
//     return null;
//   }
// };

// export function setupSocket(server: HttpServer, dataSource: DataSource) {
//   const io = new Server(server, {
//     cors: {
//       origin: "*",
//       methods: ["GET", "POST", "OPTIONS"],
//       credentials: true,
//       allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
//     },
//     transports: ['polling', 'websocket'],
//     allowEIO3: true,
//     pingTimeout: 60000,
//     pingInterval: 25000,
//     upgradeTimeout: 10000,
//     maxHttpBufferSize: 1e8,
//     path: '/socket.io/',
//     serveClient: false,
//     cookie: false,
//     // Add these for proxy support
//     allowRequest: (req, callback) => {
//       callback(null, true); // Allow all requests
//     },
//   });

//   const redisSubscriber = getRedisSubscriber();

//   // Add error handling
//   io.engine.on("connection_error", (err) => {
//     console.error("Socket.IO connection error:", err);
//   });

//   io.on("connection", (socket) => {
//     console.log("Socket connected:", socket.id);
//     console.log("Socket headers:", socket.handshake.headers);
//     console.log("Socket query:", socket.handshake.query);

//     //------------------------------------------------------- isko join karna h casinoType ke hisaab se ------------------------------------------

//     socket.on("joinCasino", (casinoType) => {
//       socket.join(`casino:${casinoType}`);
//       console.log(`Socket ${socket.id} joined room casino:${casinoType}`);
//     });

//     // --------------------------------------------------------------------------------------------------------------------------------------------------

//     // Broadcast all casino data when user connects
//     socket.on("requestAllCasinoData", async () => {
//       console.log(`[SOCKET] User ${socket.id} requested all casino data`);
//       await broadcastAllCasinoData(io);
//     });

//     // Debug endpoint to check Redis data
//     socket.on("debugRedisData", async () => {
//       console.log(`[SOCKET] User ${socket.id} requested Redis debug data`);
//       const redisData = await checkRedisCasinoData();
//       socket.emit("redisDebugData", redisData);
//     });

//     socket.on("checkLoginId", async ({ loginId, whiteListId }) => {
//       try {
//         console.log(
//           `[SOCKET] Checking loginId: ${loginId}, whitelist: ${whiteListId}`
//         );

//         // Validate inputs
//         if (!loginId) {
//           socket.emit("loginIdCheck", false);
//           return;
//         }

//         const AllUserTypes = [
//           "techAdmin",
//           "admin",
//           "miniAdmin",
//           "superMaster",
//           "master",
//           "superAgent",
//           "agent",
//           "client",
//         ];

//         let user: any = null;
//         let exists = false;

//         for (const role of AllUserTypes) {
//           const userRepository = dataSource.getRepository(USER_TABLES[role]);

//           // Build where condition based on whether whiteListId is provided
//           const whereCondition: any = { loginId };

//           // Only add whiteListId to query if it's a valid non-empty string
//           if (whiteListId && whiteListId.trim() !== "") {
//             whereCondition.whiteListId = whiteListId;
//           }

//           user = await userRepository.findOne({
//             where: whereCondition,
//           });

//           console.log("socket :", user);

//           if (user) {
//             exists = true;
//             break;
//           }
//         }

//         socket.emit("loginIdCheck", exists);
//       } catch (error) {
//         console.error("Error in checkLoginId socket handler:", error);
//         socket.emit("loginIdCheck", false);
//       }
//     });

//     // Login
//     socket.on("login", async ({ userId, userType }) => {
//       if (!userId) return socket.emit("error", "userId is required");

//       // Check for existing connection and force logout
//       const existing = activeConnections[userId];
//       if (existing) {
//         const existingSocket = io.sockets.sockets.get(existing.socketId);
//         if (existingSocket) {
//           // Send forceLogout event to existing session
//           existingSocket.emit("forceLogout", {
//             reason: "DUPLICATE_LOGIN",
//             message: "Logged in from another device",
//             timestamp: new Date().toISOString(),
//           });

//           // Disconnect after sending the event
//           setTimeout(() => {
//             existingSocket.disconnect();
//           }, 100); // Small delay to ensure event is sent
//         }
//       }

//       // Store new connection
//       activeConnections[userId] = { socketId: socket.id, userType };

//       // Always join personal room
//       socket.join(`user_${userId}`);

//       // Join global rooms depending on userType
//       if (userType === "client") socket.join("clients");
//       if (userType === "admin") socket.join("admins");
//       if (userType === "techAdmin") socket.join("techAdmins");

//       console.log(`${userType} ${userId} connected`);

//       // Broadcast all casino data to newly connected user
//       await broadcastAllCasinoData(io);

//       // Notify other users of the same type about new login
//       if (userType === "techAdmin") {
//         socket.to("techAdmins").emit("adminLogin", {
//           adminId: userId,
//           timestamp: new Date().toISOString(),
//         });
//       }
//     });

//     // Heartbeat
//     socket.on("ping", () => socket.emit("pong"));

//     // Logout
//     socket.on("logout", ({ userId }) => {
//       if (userId && activeConnections[userId]?.socketId === socket.id) {
//         delete activeConnections[userId];
//         socket.leave(`user_${userId}`);
//         socket.leave("techAdmins");
//         console.log(`${userId} logged out`);
//       }
//     });

//     // Disconnect
//     socket.on("disconnect", () => {
//       const userId = Object.keys(activeConnections).find(
//         (id) => activeConnections[id].socketId === socket.id
//       );
//       if (userId) {
//         delete activeConnections[userId];
//         console.log(`${userId} disconnected`);
//       }
//     });
//   });

//   // Casino Odds listener
//   redisSubscriber.psubscribe("casino_odds_updates:*", (err) => {
//     if (err) console.error("Failed to subscribe to casino_odds_updates:*:", err);
//     else console.log("Subscribed to casino_odds_updates:* pattern");
//   });

//   redisSubscriber.on("pmessage", async (pattern, channel, message) => {
//     if (pattern === "casino_odds_updates:*") {
//       try {
//         const notification = JSON.parse(message);
//         const casinoType = channel.split(":")[1]; // Extract casinoType from channel name

//         // Get Redis client to fetch actual data
//         const { getRedisClient } = await import("../config/redisConfig");
//         const redisClient = getRedisClient();

//         // Fetch current data from Redis
//         let currentData = null;
//         if (notification.hasCurrent) {
//           const currentKey = `casino:${casinoType}:current`;
//           const currentRedisData = await redisClient.get(currentKey);
//           if (currentRedisData) {
//             currentData = JSON.parse(currentRedisData);
//           }
//         }

//         // Fetch results data from Redis
//         let resultsData = [];
//         if (notification.hasResults) {
//           const resultsKey = `casino:${casinoType}:results`;
//           const resultsRedisData = await redisClient.get(resultsKey);
//           if (resultsRedisData) {
//             resultsData = JSON.parse(resultsRedisData);
//           }
//         }

//         // Broadcast complete data from Redis to ALL connected users
//         io.emit("casinoOddsUpdate", {
//           casinoType,
//           data: {
//             casinoType,
//             current: currentData,
//             results: resultsData,
//             timestamp: notification.timestamp,
//             source: "live_update"
//           }
//         });

//         console.log(
//           `[SOCKET] Broadcasted casino odds update for: ${casinoType} (from Redis)`
//         );
//       } catch (error) {
//         console.error("Error processing casino odds update:", error);
//       }
//     }
//   });

//   // Sports Odds listener - OPTIMIZED VERSION
//   redisSubscriber.subscribe("sports_odds_updates", (err) => {
//     if (err) console.error("Failed to subscribe to sports_odds_updates:", err);
//     else console.log("Subscribed to sports_odds_updates channel");
//   });

//   redisSubscriber.on("message", async (channel, message) => {
//     if (channel === "sports_odds_updates") {
//       try {
//         const notification = JSON.parse(message);
//         const { sport_id, event_id, hasData } = notification;

//         // Get Redis client to fetch actual data
//         const { getRedisClient } = await import("../config/redisConfig");
//         const redisClient = getRedisClient();

//         // Fetch data from Redis
//         let data = null;
//         if (hasData) {
//           const redisKey = `odds:sport:${sport_id}:event:${event_id}`;
//           const redisData = await redisClient.get(redisKey);
//           if (redisData) {
//             data = JSON.parse(redisData);
//           }
//         }

//         // Broadcast complete data from Redis to ALL connected users
//         io.emit("sportsOddsUpdate", {
//           type: 'sports_odds_updates',
//           sport_id,
//           event_id,
//           data: data,
//           timestamp: notification.timestamp
//         });

//         console.log(
//           `[SOCKET] Broadcasted odds update for sport ${sport_id}, event ${event_id} (from Redis)`
//         );
//       } catch (error) {
//         console.error("Error processing sports odds update:", error);
//       }
//     }
//   });

//   // Periodic broadcast of all casino data (every 5 minutes)
//   setInterval(async () => {
//     await broadcastAllCasinoData(io);
//   }, 5 * 60 * 1000); // 5 minutes

//   return io;
// }

// // Optional helpers
// export const getUserSocket = (io: Server, userId: string) => {
//   const conn = activeConnections[userId];
//   return conn ? io.sockets.sockets.get(conn.socketId) : undefined;
// };

// export const isTechAdmin = (userId: string) =>
//   activeConnections[userId]?.userType === "techAdmin";



