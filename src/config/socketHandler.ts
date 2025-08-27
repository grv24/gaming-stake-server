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
  "ab4", "lottcard"
];

interface UserConnection {
  socketId: string;
  userType: "user" | "techAdmin";
}

const activeConnections: Record<string, UserConnection> = {};

// Function to discover casino types from Redis
const discoverCasinoTypesFromRedis = async () => {
  try {
    const { getRedisClient } = await import("../config/redisConfig");
    const redisClient = getRedisClient();

    console.log("[SOCKET] Discovering casino types from Redis...");

    // Get all keys matching casino:* pattern
    const keys = await redisClient.keys('casino:*');
    const discoveredCasinoTypes = new Set<string>();

    // Extract casino types from keys
    for (const key of keys) {
      // Key format: casino:{casinoType}:{current|results}
      const parts = key.split(':');
      if (parts.length === 3 && parts[0] === 'casino') {
        discoveredCasinoTypes.add(parts[1]);
      }
    }

    const casinoTypesArray = Array.from(discoveredCasinoTypes);
    console.log(`[SOCKET] Discovered ${casinoTypesArray.length} casino types from Redis:`, casinoTypesArray);

    return casinoTypesArray;
  } catch (error) {
    console.error("[SOCKET] Error discovering casino types from Redis:", error);
    return CASINO_TYPES; // Fallback to predefined list
  }
};

// Function to broadcast all casino data from Redis
const broadcastAllCasinoData = async (io: Server) => {
  try {
    const { getRedisClient } = await import("../config/redisConfig");
    const redisClient = getRedisClient();

    console.log("[SOCKET] Broadcasting all casino data from Redis cache...");

    // Discover casino types from Redis
    const casinoTypesToBroadcast = await discoverCasinoTypesFromRedis();

    let broadcastCount = 0;
    let activeCount = 0;

    for (const casinoType of casinoTypesToBroadcast) {
      const currentKey = `casino:${casinoType}:current`;
      const resultsKey = `casino:${casinoType}:results`;

      // Fetch current data from Redis
      let currentData = null;
      const currentRedisData = await redisClient.get(currentKey);
      if (currentRedisData) {
        currentData = JSON.parse(currentRedisData);
      }

      // Fetch results data from Redis
      let resultsData = [];
      const resultsRedisData = await redisClient.get(resultsKey);
      if (resultsRedisData) {
        resultsData = JSON.parse(resultsRedisData);
      }

      // Broadcast casino data
      io.emit("casinoOddsUpdate", {
        casinoType,
        data: {
          casinoType,
          current: currentData,
          results: resultsData,
          timestamp: Date.now(),
          source: "redis_cache",
          hasData: !!(currentData || resultsData.length > 0)
        }
      });

      broadcastCount++;
      if (currentData || resultsData.length > 0) {
        activeCount++;
        console.log(`[SOCKET] Broadcasted active data for: ${casinoType}`);
      } else {
        console.log(`[SOCKET] Broadcasted empty data for: ${casinoType}`);
      }
    }

    console.log(`[SOCKET] Completed broadcasting all casino data from cache`);
    console.log(`[SOCKET] Total broadcasted: ${broadcastCount} casino types`);
    console.log(`[SOCKET] Active with data: ${activeCount} casino types`);
    console.log(`[SOCKET] Inactive/empty: ${broadcastCount - activeCount} casino types`);
  } catch (error) {
    console.error("[SOCKET] Error broadcasting all casino data:", error);
  }
};

// Function to check what casino types are in Redis
const checkRedisCasinoData = async () => {
  try {
    const { getRedisClient } = await import("../config/redisConfig");
    const redisClient = getRedisClient();

    console.log("[DEBUG] Checking Redis for casino data...");

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
      const currentKey = `casino:${casinoType}:current`;
      const resultsKey = `casino:${casinoType}:results`;

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

    console.log("[DEBUG] Redis Casino Data Summary:");
    console.log(`Discovered Casino Types: ${discoveredCasinoTypes.join(', ')}`);
    console.log(`Total Casino Types: ${redisData.summary.totalCasinoTypes}`);
    console.log(`Active Casinos: ${redisData.summary.activeCasinos}`);
    console.log(`Inactive Casinos: ${redisData.summary.inactiveCasinos}`);
    console.log(`Total Redis Keys: ${redisData.summary.totalKeys}`);

    return redisData;
  } catch (error) {
    console.error("[DEBUG] Error checking Redis casino data:", error);
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
  });

  const redisSubscriber = getRedisSubscriber();

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Broadcast all casino data when user connects
    socket.on("requestAllCasinoData", async () => {
      console.log(`[SOCKET] User ${socket.id} requested all casino data`);
      await broadcastAllCasinoData(io);
    });

    // Debug endpoint to check Redis data
    socket.on("debugRedisData", async () => {
      console.log(`[SOCKET] User ${socket.id} requested Redis debug data`);
      const redisData = await checkRedisCasinoData();
      socket.emit("redisDebugData", redisData);
    });

    socket.on("checkLoginId", async ({ loginId, whiteListId }) => {
      try {
        console.log(
          `[SOCKET] Checking loginId: ${loginId}, whitelist: ${whiteListId}`
        );

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

          console.log("socket :", user);

          if (user) {
            exists = true;
            break;
          }
        }

        socket.emit("loginIdCheck", exists);
      } catch (error) {
        console.error("Error in checkLoginId socket handler:", error);
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

      // Store new connection
      activeConnections[userId] = { socketId: socket.id, userType };

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

  // Casino Odds listener
  redisSubscriber.psubscribe("casino_odds_updates:*", (err) => {
    if (err) console.error("Failed to subscribe to casino_odds_updates:*:", err);
    else console.log("Subscribed to casino_odds_updates:* pattern");
  });

  redisSubscriber.on("pmessage", async (pattern, channel, message) => {
    if (pattern === "casino_odds_updates:*") {
      try {
        const notification = JSON.parse(message);
        const casinoType = channel.split(":")[1]; // Extract casinoType from channel name

        // Get Redis client to fetch actual data
        const { getRedisClient } = await import("../config/redisConfig");
        const redisClient = getRedisClient();

        // Fetch current data from Redis
        let currentData = null;
        if (notification.hasCurrent) {
          const currentKey = `casino:${casinoType}:current`;
          const currentRedisData = await redisClient.get(currentKey);
          if (currentRedisData) {
            currentData = JSON.parse(currentRedisData);
          }
        }

        // Fetch results data from Redis
        let resultsData = [];
        if (notification.hasResults) {
          const resultsKey = `casino:${casinoType}:results`;
          const resultsRedisData = await redisClient.get(resultsKey);
          if (resultsRedisData) {
            resultsData = JSON.parse(resultsRedisData);
          }
        }

        // Broadcast complete data from Redis to ALL connected users
        io.emit("casinoOddsUpdate", {
          casinoType,
          data: {
            casinoType,
            current: currentData,
            results: resultsData,
            timestamp: notification.timestamp,
            source: "live_update"
          }
        });

        console.log(
          `[SOCKET] Broadcasted casino odds update for: ${casinoType} (from Redis)`
        );
      } catch (error) {
        console.error("Error processing casino odds update:", error);
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

        console.log(
          `[SOCKET] Broadcasted odds update for sport ${sport_id}, event ${event_id} (from Redis)`
        );
      } catch (error) {
        console.error("Error processing sports odds update:", error);
      }
    }
  });

  // Periodic broadcast of all casino data (every 5 minutes)
  setInterval(async () => {
    await broadcastAllCasinoData(io);
  }, 5 * 60 * 1000); // 5 minutes

  return io;
}

// Optional helpers
export const getUserSocket = (io: Server, userId: string) => {
  const conn = activeConnections[userId];
  return conn ? io.sockets.sockets.get(conn.socketId) : undefined;
};

export const isTechAdmin = (userId: string) =>
  activeConnections[userId]?.userType === "techAdmin";



