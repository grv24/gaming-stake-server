import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { ExtendedError } from "socket.io/dist/namespace";

declare module "socket.io" {
  interface Server {
    getUserSocket(userId: string): Socket | undefined;
    isTechAdmin(userId: string): boolean;
    getActiveConnections(): Record<string, {
      socketId: string;
      userType: 'user' | 'techAdmin';
      lastActive: Date;
    }>;
  }
}

interface SocketConnection {
  socketId: string;
  userType: 'user' | 'techAdmin';
  lastActive: Date;
}

interface ConnectionMap {
  [userId: string]: SocketConnection;
}

export function setupSocket(server: HttpServer) {
  const activeConnections: ConnectionMap = {};

  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || []
        : "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 120000, // 2 minutes
      skipMiddlewares: true
    }
  });

  // Add custom methods to io instance
  io.getUserSocket = (userId: string) => {
    const conn = activeConnections[userId];
    return conn ? io.sockets.sockets.get(conn.socketId) : undefined;
  };

  io.isTechAdmin = (userId: string) => {
    return activeConnections[userId]?.userType === 'techAdmin';
  };

  io.getActiveConnections = () => {
    return { ...activeConnections };
  };

  // Authentication middleware
  io.use((socket: Socket, next: (err?: ExtendedError) => void) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }
    // Add your JWT verification logic here
    next();
  });

  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    /**
     * Enhanced login handler
     * Payload: { userId: string, userType?: 'user' | 'techAdmin' }
     */
    socket.on("login", ({ userId, userType = 'user' }) => {
      if (!userId) {
        return socket.emit('error', { message: 'userId is required' });
      }

      const existingConnection = activeConnections[userId];

      // Disconnect existing session of same type
      if (existingConnection?.userType === userType) {
        io.to(existingConnection.socketId).emit("forceLogout", {
          reason: "duplicate-login",
          message: "Logged in from another device"
        });
        io.sockets.sockets.get(existingConnection.socketId)?.disconnect();
      }

      // Store new connection
      activeConnections[userId] = {
        socketId: socket.id,
        userType,
        lastActive: new Date()
      };

      // Join user-specific room
      socket.join(`user_${userId}`);

      // Additional rooms for techAdmins
      if (userType === 'techAdmin') {
        socket.join('techAdmins');
        io.to('techAdmins').emit('adminActivity', {
          userId,
          action: 'login',
          timestamp: new Date().toISOString()
        });
      }

      console.log(`${userType} ${userId} connected with socket ${socket.id}`);
    });

    /**
     * Heartbeat handler
     */
    socket.on("ping", ({ userId }) => {
      if (userId && activeConnections[userId]) {
        activeConnections[userId].lastActive = new Date();
        socket.emit("pong", { timestamp: new Date().toISOString() });
      }
    });

    /**
     * Admin command handler
     */
    socket.on("adminCommand", (command, callback) => {
      const userId = Object.entries(activeConnections).find(
        ([_, conn]) => conn.socketId === socket.id
      )?.[0];

      if (!userId || !io.isTechAdmin(userId)) {
        return callback({ status: 'error', message: 'Unauthorized' });
      }

      console.log(`Admin command from ${userId}:`, command);

      // Process admin command
      io.to('techAdmins').emit('commandProcessed', {
        command,
        processedBy: userId,
        timestamp: new Date().toISOString()
      });

      callback({ status: 'success' });
    });

    /**
     * Logout handler
     */
    socket.on("logout", ({ userId }) => {
      if (userId && activeConnections[userId]?.socketId === socket.id) {
        const { userType } = activeConnections[userId];
        delete activeConnections[userId];

        socket.leave(`user_${userId}`);
        if (userType === 'techAdmin') {
          socket.leave('techAdmins');
          io.to('techAdmins').emit('adminActivity', {
            userId,
            action: 'logout',
            timestamp: new Date().toISOString()
          });
        }

        console.log(`${userType} ${userId} logged out`);
      }
    });

    /**
     * Disconnect handler
     */
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);

      for (const [userId, conn] of Object.entries(activeConnections)) {
        if (conn.socketId === socket.id) {
          delete activeConnections[userId];

          if (conn.userType === 'techAdmin') {
            io.to('techAdmins').emit('adminActivity', {
              userId,
              action: 'disconnect',
              timestamp: new Date().toISOString()
            });
          }

          console.log(`${conn.userType} ${userId} disconnected`);
          break;
        }
      }
    });
  });

  // Cleanup inactive connections every hour
  setInterval(() => {
    const now = new Date();
    Object.entries(activeConnections).forEach(([userId, conn]) => {
      if (now.getTime() - conn.lastActive.getTime() > 3600000) { // 1 hour
        io.sockets.sockets.get(conn.socketId)?.disconnect();
        delete activeConnections[userId];
        console.log(`Cleaned up inactive connection for ${userId}`);
      }
    });
  }, 3600000); // Run every hour

  return io;
}