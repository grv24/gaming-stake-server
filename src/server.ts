import "reflect-metadata";
import dotenv from "dotenv";
import http from "http";
import { setupSocket } from "./config/socketHandler";
import { connectRedis } from "./config/redisConfig";
import { DataSource } from "typeorm";
import app from "./app";
import { Developer } from "./entities/users/DeveloperUser";
import { Whitelist } from "./entities/whitelist/Whitelist";
import { TechAdmin } from "./entities/users/TechAdminUser";
import { SoccerSettings } from "./entities/users/utils/SoccerSetting";
import { TennisSettings } from "./entities/users/utils/TennisSetting";
import { CricketSettings } from "./entities/users/utils/CricketSetting";
import { CasinoSettings } from "./entities/users/utils/CasinoSetting";
import { InternationalCasinoSettings } from "./entities/users/utils/InternationalCasino";
import { MatkaSettings } from "./entities/users/utils/MatkaSetting";
import { SuperMaster } from "./entities/users/SuperMasterUser";
import { Master } from "./entities/users/MasterUser";
import { SuperAgent } from "./entities/users/SuperAgentUser";
import { Agent } from "./entities/users/AgentUser";
import { MiniAdmin } from "./entities/users/MiniAdminUser";
import { Admin } from "./entities/users/AdminUser";
import { Client } from "./entities/users/ClientUser";
import { initRedisPubSub } from "./config/redisPubSub";
import { AccountTrasaction } from "./entities/Transactions/AccountTransactions";
import { DefaultCasino } from "./entities/casino/DefaultCasino";
import { CasinoMatch } from "./entities/casino/CasinoMatch";
import { CasinoBet } from "./entities/casino/CasinoBet";
import { Buttons } from "./entities/games/Buttons";

dotenv.config();

// Database Configuration
export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USERNAME,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  entities: [
    Developer,
    Whitelist,
    TechAdmin,
    SuperMaster,
    Master,
    SuperAgent,
    Agent,
    MiniAdmin,
    Admin,
    Client,
    SoccerSettings,
    TennisSettings,
    CricketSettings,
    CasinoSettings,
    InternationalCasinoSettings,
    MatkaSettings,
    AccountTrasaction,
    DefaultCasino,
    CasinoMatch,
    CasinoBet,
    Buttons
  ],
  synchronize: true,
  logging: process.env.NODE_ENV === "development",
});

const startServer = async () => {
  try {
    await AppDataSource.initialize();
    console.log("Database connected");

    await connectRedis();
    initRedisPubSub();

    const PORT = process.env.PORT || 4000;
    
    // Set trust proxy BEFORE creating server
    app.set("trust proxy", true);
    
    const server = http.createServer(app);

    // Setup Socket.IO
    const io = setupSocket(server, AppDataSource);

    // Make io accessible in routes
    app.set("socketio", io);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log("Shutting down gracefully...");
      server.close(() => {
        console.log("HTTP server closed");
        AppDataSource.destroy().then(() => {
          console.log("Database connection closed");
          process.exit(0);
        });
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
