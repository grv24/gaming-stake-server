import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { getRedisSubscriber } from "../config/redisPubSub";

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

    // Login
    socket.on("login", ({ userId, userType = "user" }) => {
      if (!userId) return socket.emit("error", "userId is required");

      // Disconnect previous connection
      const existing = activeConnections[userId];
      if (existing) io.sockets.sockets.get(existing.socketId)?.disconnect();

      activeConnections[userId] = { socketId: socket.id, userType };

      // Join rooms
      socket.join(`user_${userId}`);
      if (userType === "techAdmin") socket.join("techAdmins");

      console.log(`${userType} ${userId} connected`);
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
