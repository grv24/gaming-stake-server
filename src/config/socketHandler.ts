import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { getRedisSubscriber } from "../config/redisPubSub";
import { USER_TABLES } from "../Helpers/users/Roles";
import { AppDataSource } from "../server";

interface UserConnection {
  socketId: string;
  userType: "user" | "techAdmin";
}

const activeConnections: Record<string, UserConnection> = {};

export function setupSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === "production"
        ? process.env.ALLOWED_ORIGINS?.split(",") || []
        : "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const redisSubscriber = getRedisSubscriber();

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("checkLoginId", async ({loginId, whiteListId}) => {
      try {
        console.log(`[SOCKET] Checking loginId: ${loginId}, whitelist: ${whiteListId}`);

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
          const userRepository = AppDataSource.getRepository(USER_TABLES[role]);

          user = await userRepository.findOne({
            where: { loginId, whiteListId },
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
    socket.on("login", ({ userId, userType }) => {
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
            timestamp: new Date().toISOString()
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

      // Notify other users of the same type about new login
      if (userType === "techAdmin") {
        socket.to("techAdmins").emit("adminLogin", {
          adminId: userId,
          timestamp: new Date().toISOString()
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
  redisSubscriber.subscribe("casino_odds_updates", (err) => {
    if (err) console.error("Failed to subscribe to casino_odds_updates:", err);
    else console.log("Subscribed to casino_odds_updates");
  });

  redisSubscriber.on("message", (channel, message) => {
    if (channel === "casino_odds_updates") {
      const update = JSON.parse(message);

      // Broadcast to ALL connected users
      io.emit("casinoOddsUpdate", update);
      // io.to("techAdmins").emit("casinoOddsUpdate", update);

      console.log(`[SOCKET] Broadcasted casino odds update: ${update.casinoType}`);
    }
  });

  return io;
}

// Optional helpers
export const getUserSocket = (io: Server, userId: string) => {
  const conn = activeConnections[userId];
  return conn ? io.sockets.sockets.get(conn.socketId) : undefined;
};

export const isTechAdmin = (userId: string) =>
  activeConnections[userId]?.userType === "techAdmin";
